import type { FixtureStatus } from "@/ingestion/feed/types";
import type { Db } from "@/lib/db";
import { scoreStatLine, type ScoringStatLine } from "./score";

export interface FixtureScoringResult {
  /** Rows inserted or whose points, finality or round changed. */
  changed: number;
  removed: number;
}

/**
 * (Re)calculates fantasy points for every player in one fixture. Idempotent: rows are only
 * rewritten when their points, finality or round change.
 *
 * - live: points from the current stat lines, marked provisional
 * - final: points from the stat lines, marked final
 * - postponed: every player on either team scores 0 (provisional)
 * - scheduled: no points; any left over (e.g. from before a postponement) are removed
 *
 * Players on either team with no stat line, or 0 minutes, score 0.
 */
export async function scoreFixture(db: Db, fixtureId: number, now: Date): Promise<FixtureScoringResult> {
  const [fixture] = await db.query<{ status: FixtureStatus; round_id: number | null }>(
    `select f.status, fr.round_id
       from fixtures f left join fixture_rounds fr on fr.fixture_id = f.id
      where f.id = $1`,
    [fixtureId],
  );
  if (!fixture) throw new Error(`Fixture ${fixtureId} not found`);

  if (fixture.status === "scheduled") {
    const removed = await db.query(`delete from player_fantasy_points where fixture_id = $1 returning id`, [
      fixtureId,
    ]);
    return { changed: 0, removed: removed.length };
  }

  // Everyone on either team at tip-off, plus anyone with a stat line. A player's first
  // recorded spell counts from the start, because its start date is only when ingestion
  // first saw them, not when they actually joined.
  const players = await db.query<ScoringStatLine & { player_id: number; minutes: number | null }>(
    `with game as (
       select id, home_team_id, away_team_id,
              (tip_off at time zone 'Europe/Dublin')::date as played_on
         from fixtures where id = $1
     ),
     on_team as (
       select distinct h.player_id
         from player_team_history h, game g
        where h.team_id in (g.home_team_id, g.away_team_id)
          and (h.ended_on is null or h.ended_on >= g.played_on)
          and (h.started_on <= g.played_on
               or h.started_on = (select min(e.started_on) from player_team_history e
                                   where e.player_id = h.player_id))
     ),
     candidates as (
       select player_id from on_team
       union
       select player_id from player_game_stats where fixture_id = $1
     )
     select c.player_id, s.minutes, s.pts, s.reb, s.ast, s.stl, s.blk, s.tov
       from candidates c
       left join player_game_stats s on s.player_id = c.player_id and s.fixture_id = $1`,
    [fixtureId],
  );

  const isFinal = fixture.status === "final";
  const scored = players.map((p) => ({
    playerId: p.player_id,
    points: fixture.status === "postponed" || !p.minutes ? 0 : scoreStatLine(p),
  }));

  let changed = 0;
  for (const { playerId, points } of scored) {
    const rows = await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (player_id, fixture_id) do update
         set round_id = excluded.round_id, points = excluded.points,
             is_final = excluded.is_final, calculated_at = excluded.calculated_at
         where (player_fantasy_points.round_id, player_fantasy_points.points, player_fantasy_points.is_final)
               is distinct from (excluded.round_id, excluded.points, excluded.is_final)
       returning id`,
      [playerId, fixtureId, fixture.round_id, points, isFinal, now],
    );
    changed += rows.length;
  }

  // Drop players who are no longer part of this fixture (e.g. a stat line moved to someone else).
  const removed = await db.query(
    `delete from player_fantasy_points where fixture_id = $1 and not (player_id = any($2)) returning id`,
    [fixtureId, scored.map((s) => s.playerId)],
  );
  return { changed, removed: removed.length };
}
