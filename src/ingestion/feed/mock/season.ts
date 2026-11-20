import type {
  FeedBoxScore,
  FeedCompetition,
  FeedFixture,
  FeedPlayer,
  FeedStatLine,
  FeedTeam,
} from "../types";

/**
 * A deterministic, fictional Irish Super League season used for development and tests.
 * Players and most teams are invented. The season moves through three stages so that
 * repeated ingestion runs can exercise the awkward cases:
 *
 *  Stage 1  Rounds 1–2 final; rounds 3–4 scheduled.
 *  Stage 2  Round 3 played, except one fixture that is postponed.
 *           A round 2 stat line is corrected (rebounds +2).
 *           One Ballina Braves player transfers to Westport Waves.
 *  Stage 3  The postponed fixture is rescheduled; round 4's first game is live.
 */
export type MockStage = 1 | 2 | 3;

export interface MockSeason {
  competition: FeedCompetition;
  teams: FeedTeam[];
  rosters: Map<string, FeedPlayer[]>;
  fixtures: FeedFixture[];
  boxScores: Map<string, FeedBoxScore>;
}

export const MOCK_COMPETITION: FeedCompetition = {
  externalId: "mock-sl",
  name: "Super League (mock)",
  season: "2026-27",
};

const TEAM_NAMES: [string, string][] = [
  ["Ballina Braves", "BAL"],
  ["Westport Waves", "WES"],
  ["Castlebar Comets", "CAS"],
  ["Sligo Surge", "SLI"],
  ["Galway Gales", "GAL"],
  ["Limerick Lynx", "LIM"],
  ["Cork Harbour Hawks", "COR"],
  ["Dublin Docklands", "DUB"],
  ["Athlone Arrows", "ATH"],
  ["Tralee Titans", "TRA"],
];

const FIRST_NAMES = [
  "Aaron", "Conor", "Darragh", "Eoin", "Fionn", "Jamal", "Kieran", "Liam", "Marcus", "Niall",
  "Oisín", "Pádraig", "Rory", "Seán", "Tadhg", "Andre", "Cian", "Dylan", "Ronan", "Shane",
];
const LAST_NAMES = [
  "Brennan", "Byrne", "Carey", "Doherty", "Duffy", "Flynn", "Gallagher", "Hughes", "Joyce", "Kelly",
  "Lynch", "Moran", "Murphy", "Nolan", "O'Brien", "Quinn", "Reilly", "Ryan", "Walsh", "Williams",
];

const PLAYERS_PER_TEAM = 12;
/** Roster slots 0–9 get minutes; 10–11 are DNPs, which later changes rely on. */
const PLAYERS_WHO_PLAY = 10;

/** Round tip-offs in UTC (all Saturdays at 19:30 Irish time). */
const ROUND_TIP_OFFS = [
  "2026-10-03T18:30:00Z",
  "2026-10-10T18:30:00Z",
  "2026-10-17T18:30:00Z",
  "2026-10-24T18:30:00Z",
];

export const POSTPONED_FIXTURE_ID = "mock-f-r3-g3";
export const RESCHEDULED_TIP_OFF = "2026-10-28T19:30:00Z";
export const CORRECTED_FIXTURE_ID = "mock-f-r2-g1";
export const TRANSFERRED_PLAYER_ID = "mock-p-bal-01";
export const TRANSFER_TO_TEAM_ID = "mock-t-wes";
export const LIVE_FIXTURE_ID = "mock-f-r4-g1";

const teamId = (shortName: string) => `mock-t-${shortName.toLowerCase()}`;

/** Small seeded PRNG so every run produces identical data. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, min: number, max: number) =>
  min + Math.floor(r() * (max - min + 1));

function buildTeams(): FeedTeam[] {
  return TEAM_NAMES.map(([name, shortName]) => ({
    externalId: teamId(shortName),
    name,
    shortName,
  }));
}

function buildRosters(teams: FeedTeam[]): Map<string, FeedPlayer[]> {
  // By roster slot: 5 guards, 5 forwards and 2 centres per team, so every team can supply each slot.
  const positions = ["G", "G", "F", "F", "C", "G", "F", "C", "G", "F", "G", "F"];
  const rosters = new Map<string, FeedPlayer[]>();
  for (const team of teams) {
    const r = rng(team.externalId);
    const players: FeedPlayer[] = [];
    for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
      players.push({
        externalId: `mock-p-${team.shortName.toLowerCase()}-${String(i).padStart(2, "0")}`,
        fullName: `${FIRST_NAMES[between(r, 0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[between(r, 0, LAST_NAMES.length - 1)]}`,
        position: positions[i],
      });
    }
    rosters.set(team.externalId, players);
  }
  return rosters;
}

/** Circle-method round robin: each round pairs all ten teams. */
function pairingsForRound(teamIds: string[], round: number): [string, string][] {
  const fixed = teamIds[0];
  const rotating = teamIds.slice(1);
  const shift = (round - 1) % rotating.length;
  const order = [fixed, ...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairs: [string, string][] = [];
  for (let i = 0; i < order.length / 2; i++) {
    const a = order[i];
    const b = order[order.length - 1 - i];
    pairs.push(round % 2 === 0 ? [b, a] : [a, b]);
  }
  return pairs;
}

function statLine(seed: string, playerExternalId: string, rosterSlot: number, scale = 1): FeedStatLine {
  const r = rng(`${seed}:${playerExternalId}`);
  const starter = rosterSlot < 5;
  const minutes = Math.round((starter ? between(r, 26, 36) : between(r, 8, 20)) * scale);
  const fga = Math.round((starter ? between(r, 8, 18) : between(r, 1, 7)) * scale);
  const fgm = Math.min(fga, Math.round(fga * (0.35 + r() * 0.25)));
  const threes = between(r, 0, Math.min(fgm, 4));
  const fta = Math.round(between(r, 0, starter ? 8 : 3) * scale);
  const ftm = Math.min(fta, Math.round(fta * (0.6 + r() * 0.3)));
  return {
    playerExternalId,
    minutes,
    pts: 2 * fgm + threes + ftm,
    reb: Math.round(between(r, starter ? 3 : 0, starter ? 11 : 5) * scale),
    ast: Math.round(between(r, 0, starter ? 8 : 3) * scale),
    stl: Math.round(between(r, 0, 3) * scale),
    blk: Math.round(between(r, 0, 2) * scale),
    tov: Math.round(between(r, 0, 4) * scale),
    fgm,
    fga,
    ftm,
    fta,
  };
}

function boxScoreFor(
  fixture: FeedFixture,
  rosters: Map<string, FeedPlayer[]>,
  scale = 1,
): FeedBoxScore {
  const lines: FeedStatLine[] = [];
  for (const side of [fixture.homeTeamExternalId, fixture.awayTeamExternalId]) {
    const roster = rosters.get(side) ?? [];
    roster.slice(0, PLAYERS_WHO_PLAY).forEach((player, slot) => {
      lines.push(statLine(fixture.externalId, player.externalId, slot, scale));
    });
  }
  return { fixtureExternalId: fixture.externalId, lines };
}

export function buildMockSeason(stage: MockStage): MockSeason {
  const teams = buildTeams();
  const preTransferRosters = buildRosters(teams);
  const rosters = new Map([...preTransferRosters].map(([k, v]) => [k, [...v]]));

  if (stage >= 2) {
    const fromTeam = rosters.get(teamId("BAL"))!;
    const index = fromTeam.findIndex((p) => p.externalId === TRANSFERRED_PLAYER_ID);
    const [moved] = fromTeam.splice(index, 1);
    rosters.get(TRANSFER_TO_TEAM_ID)!.push(moved);
  }

  const teamIds = teams.map((t) => t.externalId);
  const fixtures: FeedFixture[] = [];
  ROUND_TIP_OFFS.forEach((tipOff, i) => {
    const round = i + 1;
    pairingsForRound(teamIds, round).forEach(([home, away], g) => {
      fixtures.push({
        externalId: `mock-f-r${round}-g${g + 1}`,
        homeTeamExternalId: home,
        awayTeamExternalId: away,
        tipOff,
        status: statusFor(stage, round),
      });
    });
  });

  const postponed = fixtures.find((f) => f.externalId === POSTPONED_FIXTURE_ID)!;
  if (stage === 2) postponed.status = "postponed";
  if (stage === 3) {
    postponed.status = "scheduled";
    postponed.tipOff = RESCHEDULED_TIP_OFF;
  }
  if (stage === 3) {
    fixtures.find((f) => f.externalId === LIVE_FIXTURE_ID)!.status = "live";
  }

  const boxScores = new Map<string, FeedBoxScore>();
  for (const fixture of fixtures) {
    if (fixture.status !== "final" && fixture.status !== "live") continue;
    const round = Number(fixture.externalId.split("-")[2].slice(1));
    // Games before the transfer used the original rosters.
    const rostersAtTheTime = round <= 2 ? preTransferRosters : rosters;
    const scale = fixture.status === "live" ? 0.5 : 1;
    boxScores.set(fixture.externalId, boxScoreFor(fixture, rostersAtTheTime, scale));
  }

  if (stage >= 2) {
    // The scorer fixes a rebound count after the game.
    const corrected = boxScores.get(CORRECTED_FIXTURE_ID)!;
    corrected.lines[0] = { ...corrected.lines[0], reb: corrected.lines[0].reb + 2 };
  }

  return { competition: MOCK_COMPETITION, teams, rosters, fixtures, boxScores };
}

function statusFor(stage: MockStage, round: number): FeedFixture["status"] {
  const lastFinalRound = stage === 1 ? 2 : 3;
  return round <= lastFinalRound ? "final" : "scheduled";
}
