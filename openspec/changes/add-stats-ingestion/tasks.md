## 1. Project setup

- [ ] 1.1 Create Next.js app with TypeScript, ESLint and Vitest
- [ ] 1.2 Create Supabase project, link CLI, set up local dev database
- [ ] 1.3 Add `FEED_SOURCE` env var and config loader

## 2. Schema

- [ ] 2.1 Migration for `competitions`, `teams`, `players`, `player_team_history`
- [ ] 2.2 Migration for `fixtures`, `player_game_stats`, `ingestion_runs` with unique `external_id` indexes
- [ ] 2.3 Test: migrations apply cleanly to an empty database

## 3. Adapter and mock feed

- [ ] 3.1 Define `FeedAdapter` interface and feed types
- [ ] 3.2 Build `MockFeedAdapter` with a Super League season (10 teams, ~120 players, 3 rounds of results)
- [ ] 3.3 Include a corrected stat line, a postponed fixture and a mid-season transfer in the mock data
- [ ] 3.4 Test: mock adapter returns data matching the interface

## 4. Ingestion job

- [ ] 4.1 Upsert competitions, teams and players by `external_id`
- [ ] 4.2 Record player team history on team change
- [ ] 4.3 Upsert fixtures and status, ignoring stats for postponed fixtures
- [ ] 4.4 Write each fixture's box score in a single transaction, setting `corrected_at` on changes
- [ ] 4.5 Log each run to `ingestion_runs`
- [ ] 4.6 Tests: idempotent re-run, correction overwrite, postponement, transfer, failure mid-run

## 5. Scheduling

- [ ] 5.1 Edge Function wrapping the ingestion job
- [ ] 5.2 pg_cron every 15 minutes with the quiet-period early exit
- [ ] 5.3 Test: quiet-period rule with a fixed clock

## 6. Admin CSV import

- [ ] 6.1 Admin role check and upload page
- [ ] 6.2 `CsvFeedAdapter` with row validation and error reporting by row number
- [ ] 6.3 Tests: valid upload, unknown player rejected with nothing saved
