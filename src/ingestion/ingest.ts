import type { Db } from "@/lib/db";
import type {
  FeedAdapter,
  FeedBoxScore,
  FeedFixture,
  FeedPlayer,
  FeedTeam,
  FixtureStatus,
  StatValues,
} from "./feed/types";
import { STAT_KEYS } from "./feed/types";
import { FeedDataError, statLineProblems } from "./validate";

export interface IngestionCounts {
  competitions: number;
  teams: number;
  players: { added: number; updated: number; transferred: number };
  fixtures: { added: number; updated: number };
  boxScores: number;
  statLines: { added: number; updated: number; corrected: number; removed: number };
}

export interface IngestionResult {
  runId: number;
  status: "succeeded" | "failed";
  counts: IngestionCounts;
  error?: string;
}

export interface IngestionOptions {
  /** Defaults to the current time. Injected in tests. */
  now?: Date;
  /** How many days either side of now to sync fixtures for. Box scores are re-read for
   *  every live or final fixture in this window, which is how corrections get picked up. */
  windowDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyCounts(): IngestionCounts {
  return {
    competitions: 0,
    teams: 0,
    players: { added: 0, updated: 0, transferred: 0 },
    fixtures: { added: 0, updated: 0 },
    boxScores: 0,
    statLines: { added: 0, updated: 0, corrected: 0, removed: 0 },
  };
}

/** Today's date in Ireland, as YYYY-MM-DD, used for player team history. */
export function irishDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(now);
}

/**
 * Syncs everything the feed knows into the database. Safe to re-run: every record is
 * upserted by external ID. Each fixture's box score is written in one transaction, so a
 * failure part-way through leaves every fixture either fully written or untouched.
 */
export async function runIngestion(
  db: Db,
  adapter: FeedAdapter,
  options: IngestionOptions = {},
): Promise<IngestionResult> {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? 21;
  const counts = emptyCounts();

  const [run] = await db.query<{ id: number }>(
    `insert into ingestion_runs (source, started_at, status) values ($1, $2, 'running') returning id`,
    [adapter.source, now],
  );

  try {
    for (const competition of await adapter.listCompetitions()) {
      const [comp] = await db.query<{ id: number }>(
        `insert into competitions (external_id, name, season, updated_at)
         values ($1, $2, $3, $4)
         on conflict (external_id) do update
           set name = excluded.name, season = excluded.season, updated_at = excluded.updated_at
         returning id`,
        [competition.externalId, competition.name, competition.season, now],
      );
      counts.competitions++;

      const teamIds = new Map<string, number>();
      for (const team of await adapter.listTeams(competition.externalId)) {
        teamIds.set(team.externalId, await upsertTeam(db, comp.id, team, now));
        counts.teams++;
      }

      const today = irishDate(now);
      for (const [teamExternalId, teamId] of teamIds) {
        for (const player of await adapter.listPlayers(teamExternalId)) {
          await upsertPlayer(db, player, teamId, today, now, counts);
        }
      }

      const fixtures = await adapter.listFixtures(
        competition.externalId,
        new Date(now.getTime() - windowDays * DAY_MS),
        new Date(now.getTime() + windowDays * DAY_MS),
      );

      for (const fixture of fixtures) {
        const { id, previousStatus } = await upsertFixture(db, comp.id, fixture, teamIds, now, counts);

        // Postponed and scheduled games have no stats worth reading yet.
        if (fixture.status !== "live" && fixture.status !== "final") continue;

        const box = await adapter.getBoxScore(fixture.externalId);
        // Only a change to an already-final game is a correction; live games change constantly.
        const flagCorrections = previousStatus === "final" && fixture.status === "final";
        await writeBoxScore(db, id, box, { now, flagCorrections, counts });
        counts.boxScores++;
      }
    }

    await finishRun(db, run.id, "succeeded", counts, now);
    return { runId: run.id, status: "succeeded", counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(db, run.id, "failed", counts, now, message);
    return { runId: run.id, status: "failed", counts, error: message };
  }
}

async function finishRun(
  db: Db,
  runId: number,
  status: "succeeded" | "failed",
  counts: IngestionCounts,
  now: Date,
  error?: string,
) {
  // finished_at uses the wall clock where available so run durations are real.
  const finishedAt = new Date(Math.max(Date.now(), now.getTime()));
  await db.query(
    `update ingestion_runs set status = $2, counts = $3, finished_at = $4, error = $5 where id = $1`,
    [runId, status, JSON.stringify(counts), finishedAt, error ?? null],
  );
}

async function upsertTeam(db: Db, competitionId: number, team: FeedTeam, now: Date) {
  const [row] = await db.query<{ id: number }>(
    `insert into teams (external_id, competition_id, name, short_name, updated_at)
     values ($1, $2, $3, $4, $5)
     on conflict (external_id) do update
       set competition_id = excluded.competition_id, name = excluded.name,
           short_name = excluded.short_name, updated_at = excluded.updated_at
     returning id`,
    [team.externalId, competitionId, team.name, team.shortName, now],
  );
  return row.id;
}

async function upsertPlayer(
  db: Db,
  player: FeedPlayer,
  teamId: number,
  today: string,
  now: Date,
  counts: IngestionCounts,
) {
  const [existing] = await db.query<{ id: number; current_team_id: number | null }>(
    `select id, current_team_id from players where external_id = $1`,
    [player.externalId],
  );

  if (!existing) {
    await db.transaction(async (tx) => {
      const [created] = await tx.query<{ id: number }>(
        `insert into players (external_id, full_name, position, current_team_id, updated_at)
         values ($1, $2, $3, $4, $5) returning id`,
        [player.externalId, player.fullName, player.position, teamId, now],
      );
      await tx.query(
        `insert into player_team_history (player_id, team_id, started_on) values ($1, $2, $3)`,
        [created.id, teamId, today],
      );
    });
    counts.players.added++;
    return;
  }

  await db.transaction(async (tx) => {
    // Keep an admin-set position if the feed doesn't send one.
    await tx.query(
      `update players
         set full_name = $2, position = coalesce($3, position), current_team_id = $4, updated_at = $5
       where id = $1`,
      [existing.id, player.fullName, player.position, teamId, now],
    );
    if (existing.current_team_id !== teamId) {
      await tx.query(
        `update player_team_history set ended_on = $2 where player_id = $1 and ended_on is null`,
        [existing.id, today],
      );
      await tx.query(
        `insert into player_team_history (player_id, team_id, started_on) values ($1, $2, $3)`,
        [existing.id, teamId, today],
      );
      counts.players.transferred++;
    }
  });
  counts.players.updated++;
}

async function upsertFixture(
  db: Db,
  competitionId: number,
  fixture: FeedFixture,
  teamIds: Map<string, number>,
  now: Date,
  counts: IngestionCounts,
): Promise<{ id: number; previousStatus: FixtureStatus | null }> {
  const home = teamIds.get(fixture.homeTeamExternalId);
  const away = teamIds.get(fixture.awayTeamExternalId);
  if (home === undefined || away === undefined) {
    throw new FeedDataError(`Fixture ${fixture.externalId} refers to a team the feed didn't list`);
  }

  const [previous] = await db.query<{ status: FixtureStatus }>(
    `select status from fixtures where external_id = $1`,
    [fixture.externalId],
  );

  const [row] = await db.query<{ id: number }>(
    `insert into fixtures (external_id, competition_id, home_team_id, away_team_id, tip_off, status, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (external_id) do update
       set competition_id = excluded.competition_id, home_team_id = excluded.home_team_id,
           away_team_id = excluded.away_team_id, tip_off = excluded.tip_off,
           status = excluded.status, updated_at = excluded.updated_at
     returning id`,
    [fixture.externalId, competitionId, home, away, new Date(fixture.tipOff), fixture.status, now],
  );

  if (previous) counts.fixtures.updated++;
  else counts.fixtures.added++;
  return { id: row.id, previousStatus: previous?.status ?? null };
}

export interface WriteBoxScoreOptions {
  now: Date;
  /** Mark changed lines as corrections (true when the fixture was already final). */
  flagCorrections: boolean;
  counts?: IngestionCounts;
}

/**
 * Validates and writes one fixture's box score in a single transaction. Lines for players
 * no longer in the box score are removed, so the stored stats always match the source.
 */
export async function writeBoxScore(
  db: Db,
  fixtureId: number,
  box: { lines: (StatValues & { playerExternalId: string })[] },
  { now, flagCorrections, counts }: WriteBoxScoreOptions,
) {
  const seen = new Set<string>();
  for (const line of box.lines) {
    const problems = statLineProblems(line);
    if (problems.length > 0) {
      throw new FeedDataError(`Player ${line.playerExternalId}: ${problems.join("; ")}`);
    }
    if (seen.has(line.playerExternalId)) {
      throw new FeedDataError(`Player ${line.playerExternalId} appears twice in one box score`);
    }
    seen.add(line.playerExternalId);
  }

  const externalIds = [...seen];
  const players = externalIds.length
    ? await db.query<{ id: number; external_id: string }>(
        `select id, external_id from players where external_id = any($1)`,
        [externalIds],
      )
    : [];
  const playerIds = new Map(players.map((p) => [p.external_id, p.id]));
  const unknown = externalIds.filter((id) => !playerIds.has(id));
  if (unknown.length > 0) {
    throw new FeedDataError(`Box score includes unknown players: ${unknown.join(", ")}`);
  }

  const cols = STAT_KEYS.join(", ");
  const placeholders = STAT_KEYS.map((_, i) => `$${i + 3}`).join(", ");
  const updates = STAT_KEYS.map((k) => `${k} = excluded.${k}`).join(", ");
  const existingRow = STAT_KEYS.map((k) => `player_game_stats.${k}`).join(", ");
  const incomingRow = STAT_KEYS.map((k) => `excluded.${k}`).join(", ");
  const nowParam = `$${STAT_KEYS.length + 3}`;
  const flagParam = `$${STAT_KEYS.length + 4}`;

  const upsertSql = `
    insert into player_game_stats (player_id, fixture_id, ${cols}, updated_at)
    values ($1, $2, ${placeholders}, ${nowParam})
    on conflict (player_id, fixture_id) do update
      set ${updates},
          corrected_at = case
            when ${flagParam}::boolean and (${existingRow}) is distinct from (${incomingRow})
              then ${nowParam}::timestamptz
            else player_game_stats.corrected_at
          end,
          updated_at = excluded.updated_at
    returning (xmax = 0) as inserted,
              coalesce(corrected_at = ${nowParam}::timestamptz, false) as corrected`;

  await db.transaction(async (tx) => {
    for (const line of box.lines) {
      const [result] = await tx.query<{ inserted: boolean; corrected: boolean }>(upsertSql, [
        playerIds.get(line.playerExternalId),
        fixtureId,
        ...STAT_KEYS.map((k) => line[k]),
        now,
        flagCorrections,
      ]);
      if (counts) {
        if (result.inserted) counts.statLines.added++;
        else counts.statLines.updated++;
        if (result.corrected) counts.statLines.corrected++;
      }
    }
    const removed = await tx.query(
      `delete from player_game_stats where fixture_id = $1 and not (player_id = any($2)) returning id`,
      [fixtureId, [...playerIds.values()]],
    );
    if (counts) counts.statLines.removed += removed.length;
  });
}

export type { FeedBoxScore };
