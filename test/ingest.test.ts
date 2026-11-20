import { describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import {
  buildMockSeason,
  CORRECTED_FIXTURE_ID,
  POSTPONED_FIXTURE_ID,
  RESCHEDULED_TIP_OFF,
  TRANSFERRED_PLAYER_ID,
} from "@/ingestion/feed/mock/season";
import type { FeedAdapter } from "@/ingestion/feed/types";
import { irishDate, runIngestion } from "@/ingestion/ingest";
import type { Db } from "@/lib/db";
import { count, createTestDb } from "./helpers/db";

// Mid-season clock times that line up with the mock stages.
const AFTER_ROUND_2 = new Date("2026-10-12T10:00:00Z");
const AFTER_ROUND_3 = new Date("2026-10-19T10:00:00Z");
const DURING_ROUND_4 = new Date("2026-10-24T19:15:00Z");

async function fixture(db: Db, externalId: string) {
  const [row] = await db.query<{ id: number; status: string; tip_off: Date }>(
    `select id, status, tip_off from fixtures where external_id = $1`,
    [externalId],
  );
  return row;
}

async function statLinesFor(db: Db, fixtureExternalId: string) {
  return db.query<{ player: string; reb: number; corrected_at: Date | null }>(
    `select p.external_id as player, s.reb, s.corrected_at
       from player_game_stats s
       join players p on p.id = s.player_id
       join fixtures f on f.id = s.fixture_id
      where f.external_id = $1
      order by s.id`,
    [fixtureExternalId],
  );
}

describe("runIngestion", () => {
  it("loads teams, players, fixtures and box scores from the mock feed", async () => {
    const { db } = await createTestDb();
    const result = await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });

    expect(result.status).toBe("succeeded");
    expect(await count(db, "teams")).toBe(10);
    expect(await count(db, "players")).toBe(120);
    expect(await count(db, "fixtures")).toBe(20);
    // Rounds 1–2 are final: 10 fixtures × 20 players with minutes.
    expect(await count(db, "player_game_stats")).toBe(200);
    expect(await count(db, "player_team_history")).toBe(120);
  });

  it("is idempotent: the same data twice creates no duplicates", async () => {
    const { db } = await createTestDb();
    const adapter = new MockFeedAdapter(1);
    await runIngestion(db, adapter, { now: AFTER_ROUND_2 });
    const second = await runIngestion(db, adapter, { now: AFTER_ROUND_2 });

    expect(second.status).toBe("succeeded");
    expect(await count(db, "players")).toBe(120);
    expect(await count(db, "fixtures")).toBe(20);
    expect(await count(db, "player_game_stats")).toBe(200);
    expect(await count(db, "player_team_history")).toBe(120);
    expect(second.counts.statLines).toEqual({ added: 0, updated: 200, corrected: 0, removed: 0 });
  });

  it("overwrites corrected stats and flags the correction", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    const [before] = await statLinesFor(db, CORRECTED_FIXTURE_ID);
    expect(before.corrected_at).toBeNull();

    const result = await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });

    const [after] = await statLinesFor(db, CORRECTED_FIXTURE_ID);
    expect(after.player).toBe(before.player);
    expect(after.reb).toBe(before.reb + 2);
    expect(after.corrected_at?.toISOString()).toBe(AFTER_ROUND_3.toISOString());
    expect(result.counts.statLines.corrected).toBe(1);

    const others = (await statLinesFor(db, CORRECTED_FIXTURE_ID)).slice(1);
    expect(others.every((l) => l.corrected_at === null)).toBe(true);
  });

  it("does not treat a live game finishing as a correction", async () => {
    const { db } = await createTestDb();
    const season = buildMockSeason(1);
    const game = season.fixtures.find((f) => f.externalId === "mock-f-r2-g2")!;
    const finalBox = season.boxScores.get(game.externalId)!;

    game.status = "live";
    season.boxScores.set(game.externalId, {
      ...finalBox,
      lines: finalBox.lines.map((l) => ({ ...l, reb: Math.max(0, l.reb - 1) })),
    });
    await runIngestion(db, new MockFeedAdapter(season), { now: AFTER_ROUND_2 });

    const finished = buildMockSeason(1);
    const result = await runIngestion(db, new MockFeedAdapter(finished), { now: AFTER_ROUND_2 });

    expect(result.counts.statLines.corrected).toBe(0);
    const lines = await statLinesFor(db, "mock-f-r2-g2");
    expect(lines.every((l) => l.corrected_at === null)).toBe(true);
  });

  it("marks a postponed fixture and ignores any stats for it", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });

    const season = buildMockSeason(2);
    // A feed that sends a box score for a postponed game anyway.
    season.boxScores.set(POSTPONED_FIXTURE_ID, season.boxScores.get("mock-f-r3-g1")!);
    await runIngestion(db, new MockFeedAdapter(season), { now: AFTER_ROUND_3 });

    expect((await fixture(db, POSTPONED_FIXTURE_ID)).status).toBe("postponed");
    expect(await statLinesFor(db, POSTPONED_FIXTURE_ID)).toEqual([]);
  });

  it("reschedules a postponed fixture with its new tip-off", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });
    await runIngestion(db, new MockFeedAdapter(3), { now: DURING_ROUND_4 });

    const rescheduled = await fixture(db, POSTPONED_FIXTURE_ID);
    expect(rescheduled.status).toBe("scheduled");
    expect(rescheduled.tip_off.toISOString()).toBe(new Date(RESCHEDULED_TIP_OFF).toISOString());
  });

  it("records a player's transfer in their team history", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    const result = await runIngestion(db, new MockFeedAdapter(2), { now: AFTER_ROUND_3 });

    const history = await db.query<{ team: string; started_on: string; ended_on: string | null }>(
      `select t.name as team, h.started_on::text, h.ended_on::text
         from player_team_history h
         join players p on p.id = h.player_id
         join teams t on t.id = h.team_id
        where p.external_id = $1
        order by h.id`,
      [TRANSFERRED_PLAYER_ID],
    );
    expect(history).toEqual([
      { team: "Ballina Braves", started_on: "2026-10-12", ended_on: "2026-10-19" },
      { team: "Westport Waves", started_on: "2026-10-19", ended_on: null },
    ]);
    expect(result.counts.players.transferred).toBe(1);

    const [player] = await db.query<{ team: string }>(
      `select t.name as team from players p join teams t on t.id = p.current_team_id where p.external_id = $1`,
      [TRANSFERRED_PLAYER_ID],
    );
    expect(player.team).toBe("Westport Waves");
  });

  it("maps feed positions to Guard, Forward or Centre, keeping an admin-set one otherwise", async () => {
    const { db } = await createTestDb();
    // The mock season, with the first three players' positions as a real feed might send them.
    const feedPositions = new Map([["mock-p-bal-00", "PG"], ["mock-p-bal-01", "Center"], ["mock-p-bal-02", "G/F"]]);
    const mock = new MockFeedAdapter(1);
    const feed: FeedAdapter = Object.assign(Object.create(mock), {
      listPlayers: async (team: string) =>
        (await mock.listPlayers(team)).map((p) => ({ ...p, position: feedPositions.get(p.externalId) ?? p.position })),
    });
    const positions = async () =>
      (
        await db.query<{ position: string | null }>(
          `select position from players where external_id in ('mock-p-bal-00', 'mock-p-bal-01', 'mock-p-bal-02')
            order by external_id`,
        )
      ).map((p) => p.position);

    await runIngestion(db, feed, { now: AFTER_ROUND_2 });
    expect(await positions()).toEqual(["G", "C", null]);

    await db.query(`update players set position = 'F' where external_id = 'mock-p-bal-02'`);
    await runIngestion(db, feed, { now: AFTER_ROUND_2 });
    expect(await positions()).toEqual(["G", "C", "F"]);
  });

  it("logs a failed run and leaves each fixture fully written or untouched", async () => {
    const { db } = await createTestDb();
    const mock = new MockFeedAdapter(1);
    let boxScoreCalls = 0;
    const flaky: FeedAdapter = {
      source: "mock",
      listCompetitions: () => mock.listCompetitions(),
      listTeams: (id) => mock.listTeams(id),
      listPlayers: (id) => mock.listPlayers(id),
      listFixtures: (id, from, to) => mock.listFixtures(id, from, to),
      getBoxScore: async (id) => {
        boxScoreCalls++;
        if (boxScoreCalls === 4) throw new Error("Feed request timed out");
        return mock.getBoxScore(id);
      },
    };

    const result = await runIngestion(db, flaky, { now: AFTER_ROUND_2 });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Feed request timed out");
    const [run] = await db.query<{ status: string; error: string; finished_at: Date | null }>(
      `select status, error, finished_at from ingestion_runs where id = $1`,
      [result.runId],
    );
    expect(run).toMatchObject({ status: "failed", error: "Feed request timed out" });
    expect(run.finished_at).not.toBeNull();

    const perFixture = await db.query<{ n: number }>(
      `select count(s.id)::int as n from fixtures f
         left join player_game_stats s on s.fixture_id = f.id
        where f.status = 'final' group by f.id`,
    );
    expect(perFixture.filter((r) => r.n === 20)).toHaveLength(3);
    expect(perFixture.every((r) => r.n === 0 || r.n === 20)).toBe(true);
  });

  it("rolls back a whole box score when one line is invalid", async () => {
    const { db } = await createTestDb();
    const season = buildMockSeason(1);
    const box = season.boxScores.get("mock-f-r1-g1")!;
    box.lines[5] = { ...box.lines[5], fgm: box.lines[5].fga + 1 };

    const result = await runIngestion(db, new MockFeedAdapter(season), { now: AFTER_ROUND_2 });

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/fgm cannot be more than fga/);
    expect(await statLinesFor(db, "mock-f-r1-g1")).toEqual([]);
  });

  it("logs a successful run with its counts", async () => {
    const { db } = await createTestDb();
    const result = await runIngestion(db, new MockFeedAdapter(1), { now: AFTER_ROUND_2 });
    const [run] = await db.query<{ source: string; status: string; counts: { boxScores: number } }>(
      `select source, status, counts from ingestion_runs where id = $1`,
      [result.runId],
    );
    expect(run).toMatchObject({ source: "mock", status: "succeeded" });
    expect(run.counts.boxScores).toBe(10);
  });
});

describe("irishDate", () => {
  it("uses Irish time, not UTC", () => {
    // 23:30 UTC on 10 Oct is 00:30 on 11 Oct in Irish Summer Time.
    expect(irishDate(new Date("2026-10-10T23:30:00Z"))).toBe("2026-10-11");
    // After the clocks go back, Irish time equals UTC.
    expect(irishDate(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-10");
  });
});
