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
Implementations: `MockFeedAdapter` (a generated, deterministic season in code rather than JSON files) and `Nbn23FeedAdapter` (later, once access is agreed). Selected by `FEED_SOURCE` env var.

The admin CSV upload isn't an adapter after all: it covers one fixture, not a whole feed, so it's `importFixtureCsv`, which shares validation and the box-score writer with ingestion.

### Mock season stages
The mock season has three stages (`MOCK_STAGE`) so repeated runs exercise the awkward cases: stage 2 adds a postponement, a stat correction and a transfer; stage 3 reschedules the postponed game and puts a game live. Its dates are fixed (October 2026), so the cron endpoint reads the whole mock season rather than the 21 days either side of today.

### Storage
Every synced table carries `external_id` with a unique index; writes use `INSERT ... ON CONFLICT (external_id) DO UPDATE`. Each fixture's box score is written in one transaction, which gives the all-or-nothing behaviour per fixture.

Key tables:
- `players(id, external_id, full_name, position, current_team_id)`
- `player_team_history(player_id, team_id, started_on, ended_on)`
- `fixtures(id, external_id, competition_id, home_team_id, away_team_id, tip_off, status)`
- `player_game_stats(player_id, fixture_id, minutes, pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta, corrected_at)` with unique `(player_id, fixture_id)`
- `ingestion_runs(id, started_at, finished_at, status, counts jsonb, error)`

### Database access
Ingestion talks to Postgres through a small `Db` interface (query + transaction) rather than supabase-js, because supabase-js can't run multi-statement transactions. Production wraps node-postgres; tests run the real migrations on PGlite, an in-process Postgres, so no Docker is needed.

### Scheduling
pg_cron runs every 15 minutes and calls `POST /api/cron/ingest` via pg_net with a bearer secret; the endpoint exits early when the quiet rule applies. This replaces the planned Edge Function: Edge Functions run on Deno, and keeping ingestion in the Next.js app means one codebase and one test suite. Vercel's own cron was ruled out because the free plan only allows daily jobs.

The "active" window also counts a scheduled game that is due to tip off (from 15 minutes before to 3 hours after), so a game going live is noticed within 15 minutes rather than up to 6 hours. "Finished in the last 48 hours" is approximated as tipping off in the last 50.

### Corrections vs live updates
A changed stat line is only flagged `corrected_at` when the fixture was already final before the run. Stats on a live game change every run, and a game moving from live to final isn't a correction. If a player disappears from a box score (a line credited to the wrong player), their line is deleted in the same transaction.

### CSV imports
An uploaded box score marks the fixture final, since admins only upload finished games. It's logged in `ingestion_runs` with source `csv`. Until `add-user-accounts` adds an admin role, the upload and its API are protected by an `ADMIN_TOKEN` bearer secret.

### Positions
The feed may not provide positions. `players.position` is nullable and editable by an admin; squad rules that use positions are deferred until we know the data is reliable.

## Risks / Trade-offs

- **Feed format unknown** → mitigated by the adapter; the mock defines the contract we'll ask NBN23 to meet.
- **Scraping temptation** → explicitly not an adapter we'll build for production.
- **Name-only CSV matching is error-prone** → CSV requires the player's external ID or an exact name-and-team match.
