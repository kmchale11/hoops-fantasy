import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { count, createTestDbBefore } from "./helpers/db";
import { addFixture, addManager, addRound, saveSquadAt, seedLeague } from "./helpers/league";

const MIGRATION = "20261123000001_positional_squads.sql";
const DAY = 24 * 60 * 60 * 1000;

describe("positions migration", () => {
  it("maps existing positions to Guard, Forward or Centre, and then rejects anything else", async () => {
    const { db, applyRest } = await createTestDbBefore(MIGRATION);
    const given = ["PG", "Forward", "centre", " g ", "Wing", null];
    for (const [i, position] of given.entries()) {
      await db.query(`insert into players (external_id, full_name, position) values ($1, $1, $2)`, [`p${i}`, position]);
    }

    await applyRest();
    const rows = await db.query<{ position: string | null }>(`select position from players order by id`);
    expect(rows.map((r) => r.position)).toEqual(["G", "F", "C", "G", null, null]);

    await expect(db.query(`update players set position = 'PG' where external_id = 'p0'`)).rejects.toThrow(
      /players_position/,
    );
    await db.query(`update players set position = 'C' where external_id = 'p0'`);
    await db.query(`update players set position = null where external_id = 'p0'`);
  });
});

describe("clearing squads under the old rules", () => {
  /** Squads of 8 (the old rules) for a finished round and the round still open for picking. */
  async function oldSquads(db: Db) {
    await seedLeague(db);
    const niamh = await addManager(db, "Niamh");
    const now = Date.now();
    const finished = await addRound(db, 1, new Date(now - 10 * DAY), new Date(now - 7 * DAY));
    const fixture = await addFixture(db, 1, 2, new Date(now - 9 * DAY), "final");
    await addRound(db, 2, new Date(now + 1 * DAY), new Date(now + 4 * DAY));
    await addFixture(db, 3, 4, new Date(now + 2 * DAY));

    const eight = [1, 2, 5, 6, 9, 10, 13, 14];
    await saveSquadAt(db, niamh, eight, 1, new Date(now - 11 * DAY));
    await saveSquadAt(db, niamh, eight, 2, new Date(now));
    await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values (1, $1, $2, 30.5, true, now()), (5, $1, $2, 12.0, true, now())`,
      [fixture, finished],
    );
    await db.query(`select refresh_user_round_scores()`);
    return niamh;
  }

  it("clears squads for the round that hasn't locked, keeping finished rounds' squads and scores", async () => {
    const { db, applyRest } = await createTestDbBefore(MIGRATION);
    const niamh = await oldSquads(db);
    const scores = () =>
      db.query<{ round: number; points: string }>(
        `select r.number as round, u.points::text as points
           from user_round_scores u join rounds r on r.id = u.round_id where u.user_id = $1 order by r.number`,
        [niamh],
      );
    // Round 1: the captain's 30.5 doubled, plus 12.0. Round 2 has no points yet.
    expect(await scores()).toEqual([{ round: 1, points: "73.0" }, { round: 2, points: "0" }]);
    expect(await count(db, "squads")).toBe(2);

    await applyRest();
    const left = await db.query<{ number: number; players: number }>(
      `select r.number, (select count(*)::int from squad_players sp where sp.squad_id = s.id) as players
         from squads s join rounds r on r.id = s.round_id`,
    );
    expect(left).toEqual([{ number: 1, players: 8 }]);
    expect(await scores()).toEqual([{ round: 1, points: "73.0" }]);
  });
});
