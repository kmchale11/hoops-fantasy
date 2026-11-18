import { beforeEach, describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import { buildMockSeason, CORRECTED_FIXTURE_ID, POSTPONED_FIXTURE_ID } from "@/ingestion/feed/mock/season";
import { runIngestion } from "@/ingestion/ingest";
import type { Db } from "@/lib/db";
import { getSeasonResults, lockRounds, refreshUserScores } from "@/squads/squads";
import { createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, seedLeague } from "./helpers/league";

const AFTER_ROUND_2 = new Date("2026-10-12T10:00:00Z");
const AFTER_ROUND_3 = new Date("2026-10-19T10:00:00Z");

let db: Db;
let niamh: string;

/** Puts a squad straight into a round, as carry-forward or an earlier save would have. */
async function insertSquad(roundNumber: number, players: number[], captain: number) {
  const [{ id }] = await db.query<{ id: number }>(
    `insert into squads (user_id, round_id, captain_player_id, saved_at)
     select $1, id, $2, now() from rounds where number = $3 returning id::int as id`,
    [niamh, captain, roundNumber],
  );
  for (const player of players) {
    await db.query(`insert into squad_players (squad_id, player_id, price_at_pick) values ($1, $2, 10)`, [id, player]);
  }
}

async function roundScore(roundNumber: number): Promise<number | null> {
  const [row] = await db.query<{ points: string }>(
    `select s.points from user_round_scores s join rounds r on r.id = s.round_id
      where s.user_id = $1 and r.number = $2`,
    [niamh, roundNumber],
  );
  return row ? Number(row.points) : null;
}

/** Player IDs and round points for everyone in a mock fixture, best first. */
async function playersIn(fixtureExternalId: string) {
  const rows = await db.query<{ id: number; points: string }>(
    `select fp.player_id::int as id, fp.points
       from player_fantasy_points fp join fixtures f on f.id = fp.fixture_id
      where f.external_id = $1 order by fp.points desc, fp.player_id`,
    [fixtureExternalId],
  );
  return rows.map((r) => ({ id: r.id, points: Number(r.points) }));
}

describe("user round scores", () => {
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  describe("with a hand-made round", () => {
    beforeEach(async () => {
      await seedLeague(db);
      niamh = await addManager(db, "Niamh");
      await addRound(db, 1, new Date("2026-10-02T00:00:00Z"), new Date("2026-10-05T00:00:00Z"));
      const fixture = await addFixture(db, 1, 2, new Date("2026-10-03T18:30:00Z"), "final");
      await db.query(
        `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
         values (1, $1, 1, 25.0, true, now()), (5, $1, 1, 10.5, true, now())`,
        [fixture],
      );
    });

    it("doubles the captain's points", async () => {
      await insertSquad(1, [1, 2, 5, 6, 9, 10, 13, 14], 1);
      await refreshUserScores(db);
      // Captain 25.0 counts 50.0, plus 10.5; players with no game score 0.
      expect(await roundScore(1)).toBe(60.5);
    });

    it("gives 0 for rounds before a mid-season joiner's first squad", async () => {
      for (let n = 2; n <= 6; n++) {
        const start = new Date(Date.UTC(2026, 9, 2 + (n - 1) * 7));
        await addRound(db, n, start, new Date(start.getTime() + 3 * 24 * 3600 * 1000));
      }
      await insertSquad(6, [1, 2, 5, 6, 9, 10, 13, 14], 5);
      await lockRounds(db, new Date("2026-11-20T00:00:00Z"));

      const results = await getSeasonResults(db, niamh, new Date("2026-11-20T00:00:00Z"));
      expect(results.map((r) => [r.round.number, r.points])).toEqual([
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
        [5, 0],
        [6, 0],
      ]);
      // Nothing was carried backwards into rounds 1–5.
      expect(results.slice(0, 5).every((r) => r.players.length === 0)).toBe(true);
      expect(results[5].players).toHaveLength(8);
    });
  });

  describe("with the mock season", () => {
    beforeEach(async () => {
      niamh = "";
      // Friday to Monday around each Saturday of the mock season.
      for (const [n, day] of [
        [1, 2],
        [2, 9],
        [3, 16],
        [4, 23],
      ]) {
        await addRound(db, n, new Date(Date.UTC(2026, 9, day)), new Date(Date.UTC(2026, 9, day + 3)));
      }
      await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
      niamh = await addManager(db, "Niamh");
    });

    it("recalculates the round score and season total after a stat correction", async () => {
      // Stage 2 corrects the fixture's first stat line.
      const fixturePlayers = await playersIn(CORRECTED_FIXTURE_ID);
      const [{ id: correctedId }] = await db.query<{ id: number }>(
        `select id::int as id from players where external_id = $1`,
        [buildMockSeason(1).boxScores.get(CORRECTED_FIXTURE_ID)!.lines[0].playerExternalId],
      );
      const corrected = fixturePlayers.find((p) => p.id === correctedId)!;
      const others = fixturePlayers.filter((p) => p.id !== correctedId);
      const squad = [corrected, ...others.slice(0, 7)];
      await insertSquad(2, squad.map((p) => p.id), corrected.id);
      await refreshUserScores(db);
      const before = (await roundScore(2))!;
      expect(before).toBeCloseTo(squad.reduce((s, p) => s + p.points, 0) + corrected.points, 5);

      // Stage 2 adds 2 rebounds (2 × 1.2 = 2.4), doubled for the captain.
      await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });
      expect(await roundScore(2)).toBeCloseTo(before + 4.8, 5);
      const results = await getSeasonResults(db, niamh, AFTER_ROUND_3);
      expect(results.reduce((s, r) => s + r.points, 0)).toBeCloseTo(before + 4.8, 5);
    });

    it("scores 0 for a player whose only game in the round is postponed", async () => {
      await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });
      const postponed = await playersIn(POSTPONED_FIXTURE_ID);
      expect(postponed.every((p) => p.points === 0)).toBe(true);
      const played = await playersIn("mock-f-r3-g1");

      await insertSquad(3, [postponed[0].id, ...played.slice(0, 7).map((p) => p.id)], postponed[0].id);
      await refreshUserScores(db);
      expect(await roundScore(3)).toBeCloseTo(
        played.slice(0, 7).reduce((s, p) => s + p.points, 0),
        5,
      );
    });
  });
});
