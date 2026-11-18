import { describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import { buildMockSeason, POSTPONED_FIXTURE_ID } from "@/ingestion/feed/mock/season";
import { runIngestion } from "@/ingestion/ingest";
import type { Db } from "@/lib/db";
import { scoreStatLine } from "@/scoring/score";
import { createTestDb } from "./helpers/db";

const AFTER_ROUND_2 = new Date("2026-10-12T10:00:00Z");
const AFTER_ROUND_3 = new Date("2026-10-19T10:00:00Z");
const DURING_ROUND_4 = new Date("2026-10-24T19:15:00Z");

interface PointsRow {
  player: string;
  points: number;
  is_final: boolean;
  round: number | null;
}

async function pointsFor(db: Db, fixtureExternalId: string): Promise<Map<string, PointsRow>> {
  const rows = await db.query<Omit<PointsRow, "points"> & { points: string }>(
    `select p.external_id as player, fp.points, fp.is_final, r.number as round
       from player_fantasy_points fp
       join players p on p.id = fp.player_id
       join fixtures f on f.id = fp.fixture_id
       left join rounds r on r.id = fp.round_id
      where f.external_id = $1`,
    [fixtureExternalId],
  );
  return new Map(rows.map((r) => [r.player, { ...r, points: Number(r.points) }]));
}

describe("fantasy points during ingestion", () => {
  it("scores every player on both teams, giving 0 to those with no stat line", async () => {
    const { db } = await createTestDb();
    const result = await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });

    const season = buildMockSeason(1);
    const box = season.boxScores.get("mock-f-r1-g1")!;
    const points = await pointsFor(db, "mock-f-r1-g1");

    // 12 per roster; slots 10–11 never get minutes.
    expect(points.size).toBe(24);
    for (const line of box.lines) {
      expect(points.get(line.playerExternalId)).toMatchObject({ points: scoreStatLine(line), is_final: true });
    }
    const benched = [...points.values()].filter((p) => !box.lines.some((l) => l.playerExternalId === p.player));
    expect(benched).toHaveLength(4);
    expect(benched.every((p) => p.points === 0)).toBe(true);
    expect(result.counts.fantasyPoints.fixtures).toBe(20);
  });

  it("scores a stat line with 0 minutes as 0", async () => {
    const { db } = await createTestDb();
    const season = buildMockSeason(1);
    const box = season.boxScores.get("mock-f-r1-g1")!;
    box.lines[0] = { ...box.lines[0], minutes: 0, pts: 2, fgm: 1, fga: Math.max(1, box.lines[0].fga) };
    await runIngestion(db, new MockFeedAdapter(season), { now: AFTER_ROUND_2 });

    expect((await pointsFor(db, "mock-f-r1-g1")).get(box.lines[0].playerExternalId)?.points).toBe(0);
  });

  it("marks live points provisional, then final with the full stats when the game ends", async () => {
    const { db } = await createTestDb();
    const live = buildMockSeason(1);
    live.fixtures.find((f) => f.externalId === "mock-f-r2-g2")!.status = "live";
    const finalBox = live.boxScores.get("mock-f-r2-g2")!;
    live.boxScores.set("mock-f-r2-g2", {
      ...finalBox,
      lines: finalBox.lines.map((l) => ({ ...l, pts: Math.max(2 * l.fgm + l.ftm, l.pts - 2) })),
    });
    await runIngestion(db, new MockFeedAdapter(live), { now: AFTER_ROUND_2 });

    const during = await pointsFor(db, "mock-f-r2-g2");
    expect([...during.values()].every((p) => !p.is_final)).toBe(true);

    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });

    const after = await pointsFor(db, "mock-f-r2-g2");
    expect([...after.values()].every((p) => p.is_final)).toBe(true);
    for (const line of buildMockSeason(1).boxScores.get("mock-f-r2-g2")!.lines) {
      expect(after.get(line.playerExternalId)?.points).toBe(scoreStatLine(line));
    }
  });

  it("recalculates in the same run when a stat line is corrected", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    const player = buildMockSeason(1).boxScores.get("mock-f-r1-g3")!.lines[2].playerExternalId;
    const before = (await pointsFor(db, "mock-f-r1-g3")).get(player)!.points;

    // The scorer adds a steal after the game.
    const corrected = buildMockSeason(1);
    const line = corrected.boxScores.get("mock-f-r1-g3")!.lines[2];
    line.stl += 1;
    const result = await runIngestion(db, new MockFeedAdapter(corrected), { now: AFTER_ROUND_3 });

    expect(result.counts.statLines.corrected).toBe(1);
    const after = (await pointsFor(db, "mock-f-r1-g3")).get(player)!;
    expect(after.points).toBeCloseTo(before + 3, 5);
    expect(after.is_final).toBe(true);
  });

  it("gives everyone 0 for a postponed fixture, and clears it once rescheduled", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });

    const postponed = await pointsFor(db, POSTPONED_FIXTURE_ID);
    expect(postponed.size).toBeGreaterThanOrEqual(22);
    expect([...postponed.values()].every((p) => p.points === 0 && !p.is_final)).toBe(true);

    await runIngestion(db, new MockFeedAdapter(3), { now: DURING_ROUND_4 });
    expect((await pointsFor(db, POSTPONED_FIXTURE_ID)).size).toBe(0);
  });

  it("is idempotent: re-running with the same data changes no points", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    const second = await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    expect(second.counts.fantasyPoints).toMatchObject({ changed: 0, removed: 0 });
  });
});

describe("round totals", () => {
  it("adds up both games when a player plays twice in one round", async () => {
    const { db } = await createTestDb();
    // One long window covering the mock season's first two Saturdays.
    await db.query(
      `insert into rounds (number, name, starts_at, ends_at)
       values (1, 'Opening fortnight', '2026-10-01T00:00:00Z', '2026-10-12T00:00:00Z')`,
    );
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });

    const season = buildMockSeason(1);
    const games = season.fixtures.filter((f) => f.status === "final");
    const lines = games.flatMap((f) => season.boxScores.get(f.externalId)!.lines);
    const player = lines[0].playerExternalId;
    const own = lines.filter((l) => l.playerExternalId === player);
    expect(own).toHaveLength(2);

    const [total] = await db.query<{ points: string; fixtures: number; is_final: boolean }>(
      `select rp.points, rp.fixtures, rp.is_final
         from player_round_points rp join players p on p.id = rp.player_id
        where p.external_id = $1`,
      [player],
    );
    expect(Number(total.points)).toBeCloseTo(scoreStatLine(own[0]) + scoreStatLine(own[1]), 5);
    expect(total).toMatchObject({ fixtures: 2, is_final: true });
    expect((await pointsFor(db, games[0].externalId)).get(player)?.round).toBe(1);
  });

  it("totals a 20.0 and a 15.5 as 35.5", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    await db.query(
      `insert into rounds (number, name, starts_at, ends_at)
       values (9, 'Round 9', '2026-12-04T00:00:00Z', '2026-12-07T00:00:00Z')`,
    );
    await db.query(`delete from player_fantasy_points where player_id = 1`);
    await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values (1, 1, 1, 20.0, true, now()), (1, 2, 1, 15.5, true, now())`,
    );
    const [total] = await db.query<{ points: string }>(
      `select points from player_round_points where player_id = 1 and round_id = 1`,
    );
    expect(total.points).toBe("35.5");
  });
});
