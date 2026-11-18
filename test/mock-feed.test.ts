import { describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import {
  CORRECTED_FIXTURE_ID,
  POSTPONED_FIXTURE_ID,
  RESCHEDULED_TIP_OFF,
  TRANSFERRED_PLAYER_ID,
  TRANSFER_TO_TEAM_ID,
} from "@/ingestion/feed/mock/season";
import { statLineProblems } from "@/ingestion/validate";

const ALL_TIME: [Date, Date] = [new Date("2026-01-01"), new Date("2027-12-31")];

async function everything(adapter: MockFeedAdapter) {
  const [competition] = await adapter.listCompetitions();
  const teams = await adapter.listTeams(competition.externalId);
  const players = (await Promise.all(teams.map((t) => adapter.listPlayers(t.externalId)))).flat();
  const fixtures = await adapter.listFixtures(competition.externalId, ...ALL_TIME);
  return { competition, teams, players, fixtures };
}

describe("MockFeedAdapter", () => {
  it("serves a ten-team league with about 120 players", async () => {
    const { teams, players, fixtures } = await everything(new MockFeedAdapter(1));
    expect(teams).toHaveLength(10);
    expect(players).toHaveLength(120);
    expect(new Set(players.map((p) => p.externalId)).size).toBe(120);
    expect(fixtures).toHaveLength(20); // 4 rounds × 5 games
  });

  it("schedules every team exactly once per round", async () => {
    const { fixtures } = await everything(new MockFeedAdapter(1));
    for (let round = 1; round <= 4; round++) {
      const games = fixtures.filter((f) => f.externalId.startsWith(`mock-f-r${round}-`));
      const sides = games.flatMap((g) => [g.homeTeamExternalId, g.awayTeamExternalId]);
      expect(new Set(sides).size).toBe(10);
    }
  });

  it("returns valid box scores for every played fixture", async () => {
    const adapter = new MockFeedAdapter(3);
    const { fixtures } = await everything(adapter);
    const played = fixtures.filter((f) => f.status === "final" || f.status === "live");
    expect(played.length).toBeGreaterThan(0);
    for (const fixture of played) {
      const box = await adapter.getBoxScore(fixture.externalId);
      expect(box.lines).toHaveLength(20);
      for (const line of box.lines) expect(statLineProblems(line)).toEqual([]);
    }
  });

  it("filters fixtures by tip-off window", async () => {
    const adapter = new MockFeedAdapter(1);
    const fixtures = await adapter.listFixtures(
      "mock-sl",
      new Date("2026-10-09T00:00:00Z"),
      new Date("2026-10-11T00:00:00Z"),
    );
    expect(fixtures.map((f) => f.externalId)).toEqual(
      expect.arrayContaining(["mock-f-r2-g1"]),
    );
    expect(fixtures).toHaveLength(5);
  });

  it("includes a postponement, a correction and a transfer across stages", async () => {
    const stage1 = await everything(new MockFeedAdapter(1));
    const stage2Adapter = new MockFeedAdapter(2);
    const stage2 = await everything(stage2Adapter);
    const stage3 = await everything(new MockFeedAdapter(3));

    const find = (s: typeof stage1, id: string) => s.fixtures.find((f) => f.externalId === id)!;
    expect(find(stage1, POSTPONED_FIXTURE_ID).status).toBe("scheduled");
    expect(find(stage2, POSTPONED_FIXTURE_ID).status).toBe("postponed");
    expect(find(stage3, POSTPONED_FIXTURE_ID)).toMatchObject({
      status: "scheduled",
      tipOff: RESCHEDULED_TIP_OFF,
    });

    const before = await new MockFeedAdapter(1).getBoxScore(CORRECTED_FIXTURE_ID);
    const after = await stage2Adapter.getBoxScore(CORRECTED_FIXTURE_ID);
    expect(after.lines[0].reb).toBe(before.lines[0].reb + 2);

    const newTeam = await stage2Adapter.listPlayers(TRANSFER_TO_TEAM_ID);
    expect(newTeam.map((p) => p.externalId)).toContain(TRANSFERRED_PLAYER_ID);
    expect(stage2.players).toHaveLength(120);
  });

  it("returns copies so callers can't change the season", async () => {
    const adapter = new MockFeedAdapter(1);
    const [team] = await adapter.listTeams("mock-sl");
    team.name = "Changed";
    const [again] = await adapter.listTeams("mock-sl");
    expect(again.name).toBe("Ballina Braves");
  });
});

describe("statLineProblems", () => {
  const valid = { minutes: 30, pts: 21, reb: 5, ast: 3, stl: 1, blk: 0, tov: 2, fgm: 8, fga: 15, ftm: 4, fta: 5 };

  it("accepts a consistent line", () => {
    expect(statLineProblems(valid)).toEqual([]);
  });

  it("rejects negative and non-integer values", () => {
    expect(statLineProblems({ ...valid, reb: -1 })).toContain("reb must be a whole number of 0 or more");
    expect(statLineProblems({ ...valid, ast: 2.5 })).toContain("ast must be a whole number of 0 or more");
  });

  it("rejects makes above attempts and impossible points", () => {
    expect(statLineProblems({ ...valid, fgm: 16 })).toContain("fgm cannot be more than fga");
    expect(statLineProblems({ ...valid, pts: 40 })[0]).toMatch(/pts \(40\)/);
  });
});
