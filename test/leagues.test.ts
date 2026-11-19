import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { getLeaderboard, getLeaderboardPosition } from "@/leagues/leaderboard";
import {
  createLeague,
  getLeague,
  joinLeague,
  leagueNameError,
  leaveLeague,
  myLeagues,
  regenerateInviteCode,
  removeMember,
} from "@/leagues/leagues";
import type { Db } from "@/lib/db";
import { refreshUserScores } from "@/squads/squads";
import { asUser, count, createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, seedLeague } from "./helpers/league";

const DAY = 24 * 3600 * 1000;

let db: Db;
let pg: PGlite;
let now: Date;
let rounds: number[];
let fixtures: number[];
let nextPlayer: number;

/**
 * Rounds 1 and 2 are over and round 3 is in progress, so round 2 is the latest completed
 * round. Each scoring player is used once, so every user's points are their own.
 */
beforeEach(async () => {
  ({ db, pg } = await createTestDb());
  await seedLeague(db);
  now = new Date();
  rounds = [];
  fixtures = [];
  for (const n of [1, 2, 3]) {
    const start = new Date(now.getTime() - (4 - n) * 7 * DAY);
    rounds.push(await addRound(db, n, start, new Date(start.getTime() + 3 * DAY)));
    fixtures.push(await addFixture(db, 1, 2, new Date(start.getTime() + DAY), n < 3 ? "final" : "live"));
  }
  // Round 3's window runs until 4 days after it started, so it's still on.
  await db.query(`update rounds set ends_at = $1 where id = $2`, [new Date(now.getTime() + DAY), rounds[2]]);
  nextPlayer = 1;
});

/** Gives a user a squad in each round scoring the given points (captain player 16 scores 0). */
async function score(userId: string, pointsByRound: number[]) {
  for (const [i, points] of pointsByRound.entries()) {
    const player = nextPlayer++;
    await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values ($1, $2, $3, $4, true, now())`,
      [player, fixtures[i], rounds[i], points],
    );
    const [{ id }] = await db.query<{ id: number }>(
      `insert into squads (user_id, round_id, captain_player_id, saved_at) values ($1, $2, 16, now())
       returning id::int as id`,
      [userId, rounds[i]],
    );
    await db.query(
      `insert into squad_players (squad_id, player_id, price_at_pick) values ($1, 16, 4), ($1, $2, 4)`,
      [id, player],
    );
  }
  await refreshUserScores(db);
}

async function newLeague(adminId: string, name = "Ballina Braves Members") {
  const result = await createLeague(db, adminId, name);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("overall leaderboard", () => {
  it("gives tied totals the same rank and skips the next", async () => {
    const [aoife, brian, ciara, dara] = await Promise.all(["Aoife", "Brian", "Ciara", "Dara"].map((n) => addManager(db, n)));
    await addManager(db, "Eimear"); // no squad, so not ranked
    await score(aoife, [200, 212.5]);
    await score(brian, [400, 12.5]);
    await score(ciara, [300]);
    await score(dara, [250, 250]);

    const { rows, users } = await getLeaderboard(db, 1);
    expect(users).toBe(4);
    expect(rows.map((r) => [r.rank, r.teamName, r.seasonTotal])).toEqual([
      [1, "Dara's Team", 500],
      [2, "Aoife's Team", 412.5],
      [2, "Brian's Team", 412.5],
      [4, "Ciara's Team", 300],
    ]);
  });

  it("pages the table and finds the user's page", async () => {
    const users = [];
    for (const [i, name] of ["Aoife", "Brian", "Ciara", "Dara", "Eimear"].entries()) {
      const id = await addManager(db, name);
      await score(id, [100 - i * 10]);
      users.push(id);
    }
    const page2 = await getLeaderboard(db, 2, 2);
    expect(page2).toMatchObject({ page: 2, pages: 3, users: 5 });
    expect(page2.rows.map((r) => r.rank)).toEqual([3, 4]);
    expect((await getLeaderboard(db, 99, 2)).page).toBe(3);

    expect(await getLeaderboardPosition(db, users[4], 2)).toMatchObject({ rank: 5, page: 3, seasonTotal: 60 });
    expect(await getLeaderboardPosition(db, await addManager(db, "Fiadh"), 2)).toBeNull();
  });
});

describe("creating and joining a league", () => {
  let aoife: string;
  let brian: string;
  beforeEach(async () => {
    aoife = await addManager(db, "Aoife");
    brian = await addManager(db, "Brian");
  });

  it("makes the creator admin and first member, with a 6-character code", async () => {
    const { leagueId, inviteCode } = await newLeague(aoife);
    expect(inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await myLeagues(db, aoife)).toEqual([
      { id: leagueId, name: "Ballina Braves Members", members: 1, isAdmin: true },
    ]);
  });

  it("checks the name length", async () => {
    expect(leagueNameError("ab")).toBe("League names must be 3–40 characters");
    expect(leagueNameError("x".repeat(40))).toBeNull();
    expect(await createLeague(db, aoife, "  ab ")).toEqual({ ok: false, error: "League names must be 3–40 characters" });
    expect(await createLeague(db, aoife, "x".repeat(41))).toMatchObject({ ok: false });
    expect(await count(db, "mini_leagues")).toBe(0);
  });

  it("joins with a valid code, ignoring case and spaces", async () => {
    const { leagueId, inviteCode } = await newLeague(aoife);
    const typed = ` ${inviteCode.slice(0, 3).toLowerCase()} ${inviteCode.slice(3)}`;
    expect(await joinLeague(db, brian, typed)).toEqual({ ok: true, leagueId });
    expect(await myLeagues(db, brian)).toEqual([
      { id: leagueId, name: "Ballina Braves Members", members: 2, isAdmin: false },
    ]);
  });

  it("says when a code isn't recognised", async () => {
    await newLeague(aoife);
    expect(await joinLeague(db, brian, "ZZZZZZ")).toEqual({
      ok: false,
      error: "That invite code wasn't recognised. Check it with whoever sent it.",
    });
    expect(await myLeagues(db, brian)).toEqual([]);
  });

  it("won't let a user join the same league twice", async () => {
    const { inviteCode } = await newLeague(aoife);
    await joinLeague(db, brian, inviteCode);
    expect(await joinLeague(db, brian, inviteCode)).toEqual({
      ok: false,
      error: "You're already in Ballina Braves Members",
    });
    expect(await count(db, "league_members")).toBe(2);
    // The primary key backs this up for any other way in.
    await expect(
      db.query(`insert into league_members (league_id, user_id) select league_id, user_id from league_members`),
    ).rejects.toThrow(/duplicate key/);
  });

  it("needs a finished sign-up", async () => {
    const { inviteCode } = await newLeague(aoife);
    const [{ id: halfway }] = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('half@example.ie') returning id`,
    );
    expect(await joinLeague(db, halfway, inviteCode)).toEqual({
      ok: false,
      error: "Finish signing up before joining leagues",
    });
  });
});

describe("league privacy", () => {
  it("shows a league, its members and standings to members only", async () => {
    const [aoife, brian, ciara] = await Promise.all(["Aoife", "Brian", "Ciara"].map((n) => addManager(db, n)));
    const { leagueId, inviteCode } = await newLeague(aoife);
    await joinLeague(db, brian, inviteCode);

    expect(await getLeague(db, brian, leagueId, now)).not.toBeNull();
    expect(await getLeague(db, ciara, leagueId, now)).toBeNull();
    await asUser(pg, ciara, async (q) => {
      expect(await q(`select * from mini_leagues`)).toEqual([]);
      expect(await q(`select * from league_members`)).toEqual([]);
      expect(await q(`select * from league_standings($1, null)`, [leagueId])).toEqual([]);
    });
    await asUser(pg, brian, async (q) => {
      expect(await q(`select user_id from league_members order by joined_at`)).toHaveLength(2);
    });
    // Nobody can write to the tables directly, and signed-out visitors can't read them or join.
    const denied = (userId: string | null, sql: string, params: unknown[] = []) =>
      expect(asUser(pg, userId, (q) => q(sql, params))).rejects.toThrow(/permission denied/);
    await denied(ciara, `insert into league_members (league_id, user_id) values ($1, $2)`, [leagueId, ciara]);
    await denied(brian, `update mini_leagues set admin_user_id = $1`, [brian]);
    await denied(null, `select * from mini_leagues`);
    await denied(null, `select join_league($1)`, [inviteCode]);
  });
});

describe("league standings", () => {
  it("ranks members by season total with the latest completed round's score", async () => {
    const [aoife, brian, ciara, dara] = await Promise.all(["Aoife", "Brian", "Ciara", "Dara"].map((n) => addManager(db, n)));
    const { leagueId, inviteCode } = await newLeague(aoife);
    for (const id of [brian, ciara]) await joinLeague(db, id, inviteCode);
    await score(aoife, [50, 60, 99]); // round 3 is still going, so it isn't the round shown
    await score(brian, [150, 20]);
    await score(dara, [500]); // not a member
    // Ciara joined but has no squad yet.

    const league = (await getLeague(db, aoife, leagueId, now))!;
    expect(league).toMatchObject({ name: "Ballina Braves Members", isAdmin: true, round: { name: "Round 2" } });
    expect(league.standings.map((s) => [s.rank, s.teamName, s.seasonTotal, s.roundPoints])).toEqual([
      [1, "Aoife's Team", 209, 60],
      [2, "Brian's Team", 170, 20],
      [3, "Ciara's Team", 0, 0],
    ]);
  });

  it("has no round column before any round has finished", async () => {
    const aoife = await addManager(db, "Aoife");
    const { leagueId } = await newLeague(aoife);
    expect((await getLeague(db, aoife, leagueId, new Date(now.getTime() - 30 * DAY)))!.round).toBeNull();
  });
});

describe("leaving and removal", () => {
  let aoife: string;
  let brian: string;
  let ciara: string;
  let leagueId: number;
  let inviteCode: string;
  beforeEach(async () => {
    [aoife, brian, ciara] = await Promise.all(["Aoife", "Brian", "Ciara"].map((n) => addManager(db, n)));
    ({ leagueId, inviteCode } = await newLeague(aoife));
    await joinLeague(db, brian, inviteCode);
    await joinLeague(db, ciara, inviteCode);
  });

  const members = async () => (await getLeague(db, aoife, leagueId, now))!.standings.map((s) => s.managerName).sort();

  it("lets a member leave", async () => {
    expect(await leaveLeague(db, brian, leagueId)).toEqual({ ok: true });
    expect(await members()).toEqual(["Aoife", "Ciara"]);
    expect(await getLeague(db, brian, leagueId, now)).toBeNull();
    expect(await leaveLeague(db, brian, leagueId)).toEqual({ ok: false, error: "You're not in that league" });
  });

  it("hands the league to the longest-standing member when the admin leaves", async () => {
    await leaveLeague(db, aoife, leagueId);
    expect(await getLeague(db, brian, leagueId, now)).toMatchObject({ isAdmin: true });
    await leaveLeague(db, brian, leagueId);
    await leaveLeague(db, ciara, leagueId);
    expect(await count(db, "mini_leagues")).toBe(0);
  });

  it("lets the admin remove a member, and nobody else", async () => {
    expect(await removeMember(db, brian, leagueId, ciara)).toEqual({
      ok: false,
      error: "Only the league admin can do that",
    });
    expect(await removeMember(db, aoife, leagueId, ciara)).toEqual({ ok: true });
    expect(await members()).toEqual(["Aoife", "Brian"]);
    expect(await getLeague(db, ciara, leagueId, now)).toBeNull();
    // A removed member can come back with the code.
    expect(await joinLeague(db, ciara, inviteCode)).toMatchObject({ ok: true });
  });

  it("rejects the old code after the admin regenerates it, keeping members", async () => {
    expect(await regenerateInviteCode(db, brian, leagueId)).toMatchObject({ ok: false });
    const result = await regenerateInviteCode(db, aoife, leagueId);
    if (!result.ok) throw new Error(result.error);
    expect(result.inviteCode).not.toBe(inviteCode);

    const dara = await addManager(db, "Dara");
    expect(await joinLeague(db, dara, inviteCode)).toMatchObject({ ok: false });
    expect(await members()).toEqual(["Aoife", "Brian", "Ciara"]);
    expect(await joinLeague(db, dara, result.inviteCode)).toEqual({ ok: true, leagueId });
  });
});

describe("account deletion", () => {
  it("takes a deleted user out of every league", async () => {
    const [aoife, brian, ciara] = await Promise.all(["Aoife", "Brian", "Ciara"].map((n) => addManager(db, n)));
    const first = await newLeague(aoife, "Moycullen Masters");
    const second = await newLeague(brian, "Tralee Office");
    const solo = await newLeague(aoife, "Just Me");
    await joinLeague(db, brian, first.inviteCode);
    await joinLeague(db, ciara, first.inviteCode);
    await joinLeague(db, aoife, second.inviteCode);

    await db.query(`delete from auth.users where id = $1`, [aoife]);

    const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from league_members where user_id = $1`, [aoife]);
    expect(n).toBe(0);
    // Brian joined Moycullen Masters before Ciara, so he runs it now.
    expect(await getLeague(db, brian, first.leagueId, now)).toMatchObject({ isAdmin: true });
    expect((await getLeague(db, brian, first.leagueId, now))!.standings).toHaveLength(2);
    expect((await getLeague(db, brian, second.leagueId, now))!.standings).toHaveLength(1);
    // Her own one-person league goes with her.
    expect(await db.query(`select 1 from mini_leagues where id = $1`, [solo.leagueId])).toEqual([]);
  });
});
