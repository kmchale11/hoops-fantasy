/**
 * The contract every data source must meet. Everything feed-specific lives
 * behind this interface; ingestion, scoring and the game never see raw feed data.
 * External IDs are the feed's own identifiers and are what we upsert on.
 */

export type FixtureStatus = "scheduled" | "live" | "final" | "postponed";

export interface FeedCompetition {
  externalId: string;
  name: string;
  season: string;
}

export interface FeedTeam {
  externalId: string;
  name: string;
  shortName: string;
}

export interface FeedPlayer {
  externalId: string;
  fullName: string;
  /** Null when the feed doesn't supply positions; admins can set them later. */
  position: string | null;
}

export interface FeedFixture {
  externalId: string;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  /** ISO 8601 timestamp with offset. */
  tipOff: string;
  status: FixtureStatus;
}

export interface FeedStatLine {
  playerExternalId: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
}

export interface FeedBoxScore {
  fixtureExternalId: string;
  lines: FeedStatLine[];
}

export interface FeedAdapter {
  /** Identifies the source in the ingestion run log, e.g. "mock" or "nbn23". */
  readonly source: string;
  listCompetitions(): Promise<FeedCompetition[]>;
  listTeams(competitionExternalId: string): Promise<FeedTeam[]>;
  /** Current roster of a team. A player appearing on a new team is a transfer. */
  listPlayers(teamExternalId: string): Promise<FeedPlayer[]>;
  listFixtures(competitionExternalId: string, from: Date, to: Date): Promise<FeedFixture[]>;
  getBoxScore(fixtureExternalId: string): Promise<FeedBoxScore>;
}

export const STAT_KEYS = [
  "minutes",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fgm",
  "fga",
  "ftm",
  "fta",
] as const satisfies readonly (keyof FeedStatLine)[];

export type StatKey = (typeof STAT_KEYS)[number];
export type StatValues = Pick<FeedStatLine, StatKey>;
