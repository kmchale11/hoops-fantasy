## Context

We don't yet know the exact feed format. NBN23 powers the Swish All-Hoops app for Basketball Ireland, but no public API is documented. The design keeps everything feed-specific in one adapter so the rest of the app can be built now against a mock.

## Goals / Non-Goals

**Goals:** a stable internal data model; safe re-runs; corrections and postponements handled; a working mock for development.

**Non-Goals:** real-time (sub-minute) stats; play-by-play.

## Decisions

### Adapter interface
```ts
interface FeedAdapter {
  listCompetitions(): Promise<FeedCompetition[]>;
  listTeams(competitionId: string): Promise<FeedTeam[]>;
  listPlayers(teamId: string): Promise<FeedPlayer[]>;
  listFixtures(competitionId: string, from: Date, to: Date): Promise<FeedFixture[]>;
  getBoxScore(fixtureId: string): Promise<FeedBoxScore>;
}
```
Implementations: `MockFeedAdapter` (JSON fixtures in repo), `CsvFeedAdapter` (admin upload), `Nbn23FeedAdapter` (later, once access is agreed). Selected by `FEED_SOURCE` env var.

### Storage
Every synced table carries `external_id` with a unique index; writes use `INSERT ... ON CONFLICT (external_id) DO UPDATE`. Each fixture's box score is written in one transaction, which gives the all-or-nothing behaviour per fixture.

Key tables:
- `players(id, external_id, full_name, position, current_team_id)`
- `player_team_history(player_id, team_id, started_on, ended_on)`
- `fixtures(id, external_id, competition_id, home_team_id, away_team_id, tip_off, status)`
- `player_game_stats(player_id, fixture_id, minutes, pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta, corrected_at)` with unique `(player_id, fixture_id)`
- `ingestion_runs(id, started_at, finished_at, status, counts jsonb, error)`

### Scheduling
A single Supabase scheduled function (pg_cron calling an Edge Function) runs every 15 minutes and exits early if the "quiet" rule applies, rather than juggling two schedules.

### Positions
The feed may not provide positions. `players.position` is nullable and editable by an admin; squad rules that use positions are deferred until we know the data is reliable.

## Risks / Trade-offs

- **Feed format unknown** → mitigated by the adapter; the mock defines the contract we'll ask NBN23 to meet.
- **Scraping temptation** → explicitly not an adapter we'll build for production.
- **Name-only CSV matching is error-prone** → CSV requires the player's external ID or an exact name-and-team match.
