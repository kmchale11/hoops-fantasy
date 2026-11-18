import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { listPlayers } from "@/squads/players";
import { squadRuleErrors } from "@/squads/rules";
import { getLatestSquad, getSquadWindow, lockRounds, saveSquad } from "@/squads/squads";
import { asUser, count, createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, saveSquadAt, seedLeague, VALID_SQUAD } from "./helpers/league";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let db: Db;
let pg: PGlite;
let niamh: string;
let now: Date;
const at = (ms: number) => new Date(now.getTime() + ms);

beforeEach(async () => {
  ({ db, pg } = await createTestDb());
  await seedLeague(db);
  niamh = await addManager(db, "Niamh");
  now = new Date();
});

/** Round 4 finished last weekend; round 5 starts tomorrow with its first game at `firstTipOff`. */
async function roundsAroundNow(firstTipOff: Date, status: "scheduled" | "live" = "scheduled") {
  await addRound(db, 4, at(-8 * DAY), at(-5 * DAY));
  await addFixture(db, 1, 2, at(-7 * DAY), "final");
  await addRound(db, 5, at(-1 * DAY), at(2 * DAY));
  await addFixture(db, 1, 2, firstTipOff, status);
  await addFixture(db, 3, 4, at(1 * DAY));
}

describe("player prices", () => {
  it("shows an unpriced player as unavailable, and won't save them", async () => {
    await db.query(
      `insert into players (external_id, full_name, current_team_id) values ('new', 'Seán Newman', 1)`,
    );
    const listing = (await listPlayers(db, null)).find((p) => p.name === "Seán Newman")!;
    expect(listing).toMatchObject({ price: null, available: false });

    await roundsAroundNow(at(2 * HOUR));
    const squad = [listing.id, ...VALID_SQUAD.slice(1)];
    const result = await saveSquad(db, niamh, squad, squad[1]);
    expect(result).toEqual({ ok: false, errors: ["Seán Newman isn't available to pick yet"] });
  });
});

describe("saving a squad", () => {
  it("saves a valid change before the deadline", async () => {
    await roundsAroundNow(at(2 * HOUR));
    expect(await saveSquad(db, niamh, VALID_SQUAD, 1)).toMatchObject({ ok: true });

    const swapped = [...VALID_SQUAD.slice(0, 7), 15];
    expect(await saveSquad(db, niamh, swapped, 15)).toMatchObject({ ok: true });
    expect(await getLatestSquad(db, niamh)).toMatchObject({
      roundNumber: 5,
      captainId: 15,
      playerIds: [...swapped].sort((a, b) => a - b),
      carriedForward: false,
    });
    expect(await count(db, "squads")).toBe(1);
  });

  it("rejects a change after the first tip-off, showing the deadline", async () => {
    const tipOff = new Date(Math.floor(at(-10 * MIN).getTime() / MIN) * MIN);
    await roundsAroundNow(tipOff, "live");
    expect((await getSquadWindow(db, now)).locked?.number).toBe(5);

    const result = await saveSquad(db, niamh, VALID_SQUAD, 1);
    const shown = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Dublin",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(tipOff);
    expect(result).toEqual({
      ok: false,
      errors: [expect.stringMatching(new RegExp(`^Round 5 locked at \\w{3} \\d{1,2} \\w{3}, ${shown}\\.`))],
    });
    expect(await count(db, "squads")).toBe(0);
  });

  it("stays locked until the round's last game is final, then opens the next round", async () => {
    await roundsAroundNow(at(-2 * HOUR), "live");
    await addRound(db, 6, at(6 * DAY), at(9 * DAY));
    expect(await getSquadWindow(db, now)).toMatchObject({ open: { number: 6 }, locked: { number: 5 } });

    await db.query(`update fixtures set status = 'final' where tip_off <= $1`, [now]);
    await db.query(`update fixtures set status = 'final', tip_off = $1 where tip_off > $1`, [at(-1 * HOUR)]);
    expect(await getSquadWindow(db, now)).toMatchObject({ open: { number: 6 }, locked: null });
    expect(await saveSquad(db, niamh, VALID_SQUAD, 1)).toMatchObject({ ok: true });
    expect(await getLatestSquad(db, niamh)).toMatchObject({ roundNumber: 6 });
  });

  it("returns the same rule errors as the shared rules module", async () => {
    await roundsAroundNow(at(2 * HOUR));
    await db.query(`update player_prices set price = 14.0 where player_id in (1, 5)`);
    await db.query(`update players set current_team_id = null where id = 16`);
    const players = await listPlayers(db, null);
    const pick = (ids: number[]) => ids.map((id) => players.find((p) => p.id === id)!);

    const cases: [number[], number | null][] = [
      [VALID_SQUAD, 1], // over budget by 3.0
      [VALID_SQUAD.slice(0, 7), 1], // 7 players
      [[1, 2, 3, 4, 5, 9, 13, 16], 9], // 4 from one team, one with no team, no captain issue
      [[2, 2, 6, 7, 10, 11, 14, 15], null], // duplicate, 7 unique, no captain
      [[1, 2, 3, 4, 5, 6, 7, 8], 99], // two crowded teams, captain not in squad
    ];
    for (const [ids, captain] of cases) {
      const expected = squadRuleErrors(pick(ids), captain);
      expect(expected.length).toBeGreaterThan(0);
      expect(await saveSquad(db, niamh, ids, captain)).toEqual({ ok: false, errors: expected });
    }
  });

  it("blocks writing squads directly, and hides other users' squads", async () => {
    await roundsAroundNow(at(2 * HOUR));
    const ciarán = await addManager(db, "Ciaran");
    await saveSquad(db, ciarán, VALID_SQUAD, 1);

    await expect(
      asUser(pg, niamh, (q) =>
        q(`insert into squads (user_id, round_id, captain_player_id, saved_at) values ($1, 2, 1, now())`, [niamh]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(pg, niamh, (q) => q(`update squads set captain_player_id = 2`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asUser(pg, niamh, (q) => q(`select save_squad_at($1, $2::bigint[], 1, now() - interval '1 day')`, [niamh, VALID_SQUAD])),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(pg, niamh, (q) => q(`select carry_forward_squads(now())`))).rejects.toThrow(/permission denied/);

    expect(await asUser(pg, niamh, (q) => q(`select * from squads`))).toHaveLength(0);
    expect(await asUser(pg, ciarán, (q) => q(`select * from squad_players`))).toHaveLength(8);
    expect(await asUser(pg, null, (q) => q(`select * from player_prices`))).toHaveLength(16);
  });

  it("is deleted along with the user's account", async () => {
    await roundsAroundNow(at(2 * HOUR));
    await saveSquad(db, niamh, VALID_SQUAD, 1);
    await db.query(`delete from auth.users where id = $1`, [niamh]);
    expect(await count(db, "squads")).toBe(0);
    expect(await count(db, "squad_players")).toBe(0);
  });
});

describe("carry-forward when a round locks", () => {
  it("uses the round 4 squad and captain for round 5 if the user made no changes", async () => {
    await roundsAroundNow(at(2 * HOUR));
    await saveSquadAt(db, niamh, VALID_SQUAD, 9, at(-9 * DAY));
    expect(await getLatestSquad(db, niamh)).toMatchObject({ roundNumber: 4 });

    expect(await lockRounds(db, at(1 * HOUR))).toBe(0); // round 5 hasn't locked yet
    expect(await lockRounds(db, at(3 * HOUR))).toBe(1);
    expect(await getLatestSquad(db, niamh)).toMatchObject({
      roundNumber: 5,
      captainId: 9,
      playerIds: VALID_SQUAD,
      carriedForward: true,
    });
    expect(await lockRounds(db, at(4 * HOUR))).toBe(0);
  });

  it("keeps a squad the user changed for the new round", async () => {
    await roundsAroundNow(at(2 * HOUR));
    await saveSquadAt(db, niamh, VALID_SQUAD, 9, at(-9 * DAY));
    await saveSquad(db, niamh, VALID_SQUAD, 13);
    expect(await lockRounds(db, at(3 * HOUR))).toBe(0);
    expect(await getLatestSquad(db, niamh)).toMatchObject({ roundNumber: 5, captainId: 13, carriedForward: false });
  });
});
