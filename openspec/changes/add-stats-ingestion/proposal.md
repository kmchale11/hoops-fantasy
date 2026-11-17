## Why

Every other part of the game (scoring, prices, leaderboards) depends on trustworthy, up-to-date box scores for Irish league games. We need a single, repeatable way to pull teams, players, fixtures and per-player game stats from the external feed into our own database, tolerant of the corrections and postponements that are common in Irish domestic basketball.

## What Changes

- Add a feed adapter interface so the data source (NBN23 feed, CSV import, or a mock) can be swapped without touching the rest of the app.
- Add a scheduled ingestion job that syncs teams, players, fixtures and player game stats.
- Make ingestion idempotent: re-running it never duplicates rows, and corrected stats overwrite earlier values.
- Track fixture status (scheduled, live, final, postponed) and player team changes.
- Add an admin CSV import as a manual fallback when the feed is unavailable.
- Ship a mock feed with realistic Irish league fixtures for local development and tests.

## Out of Scope

- Scoring, pricing or anything that interprets the stats (see `add-fantasy-scoring`).
- Play-by-play or shot-chart data.
- Underage, schools or women's/men's leagues beyond the three configured competitions.
- Negotiating feed access with NBN23 / Basketball Ireland (business task, not code).

## Capabilities

### New Capabilities
- `stats-ingestion`: syncing competition, team, player, fixture and box-score data from an external feed.

## Impact

- New tables: `competitions`, `teams`, `players`, `player_team_history`, `fixtures`, `player_game_stats`, `ingestion_runs`.
- New scheduled worker and admin import screen.
- Downstream changes (`add-fantasy-scoring`, `add-squad-selection`) read from these tables.
