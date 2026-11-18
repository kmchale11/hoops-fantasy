import type {
  FeedAdapter,
  FeedBoxScore,
  FeedCompetition,
  FeedFixture,
  FeedPlayer,
  FeedTeam,
} from "../types";
import { buildMockSeason, type MockSeason, type MockStage } from "./season";

/** Serves the mock season. Makes no network requests. */
export class MockFeedAdapter implements FeedAdapter {
  readonly source = "mock";
  private season: MockSeason;

  constructor(seasonOrStage: MockSeason | MockStage = 3) {
    this.season =
      typeof seasonOrStage === "number" ? buildMockSeason(seasonOrStage) : seasonOrStage;
  }

  async listCompetitions(): Promise<FeedCompetition[]> {
    return [structuredClone(this.season.competition)];
  }

  async listTeams(competitionExternalId: string): Promise<FeedTeam[]> {
    this.assertCompetition(competitionExternalId);
    return structuredClone(this.season.teams);
  }

  async listPlayers(teamExternalId: string): Promise<FeedPlayer[]> {
    const roster = this.season.rosters.get(teamExternalId);
    if (!roster) throw new Error(`Mock feed has no team ${teamExternalId}`);
    return structuredClone(roster);
  }

  async listFixtures(competitionExternalId: string, from: Date, to: Date): Promise<FeedFixture[]> {
    this.assertCompetition(competitionExternalId);
    return structuredClone(
      this.season.fixtures.filter((f) => {
        const t = new Date(f.tipOff).getTime();
        return t >= from.getTime() && t <= to.getTime();
      }),
    );
  }

  async getBoxScore(fixtureExternalId: string): Promise<FeedBoxScore> {
    const box = this.season.boxScores.get(fixtureExternalId);
    if (!box) throw new Error(`Mock feed has no box score for ${fixtureExternalId}`);
    return structuredClone(box);
  }

  private assertCompetition(id: string) {
    if (id !== this.season.competition.externalId) {
      throw new Error(`Mock feed has no competition ${id}`);
    }
  }
}
