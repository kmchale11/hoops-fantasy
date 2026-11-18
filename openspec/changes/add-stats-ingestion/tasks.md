## 1. Project setup

- [x] 1.1 Create Next.js app with TypeScript, ESLint and Vitest
- [ ] 1.2 Create Supabase project, link CLI, set up local dev database (needs Kevin's Supabase account; migrations are ready in `supabase/migrations`)
- [x] 1.3 Add `FEED_SOURCE` env var and config loader

## 2. Schema

- [x] 2.1 Migration for `competitions`, `teams`, `players`, `player_team_history`
- [x] 2.2 Migration for `fixtures`, `player_game_stats`, `ingestion_runs` with unique `external_id` indexes
- [x] 2.3 Test: migrations apply cleanly to an empty database

## 3. Adapter and mock feed

- [x] 3.1 Define `FeedAdapter` interface and feed types
- [x] 3.2 Build `MockFeedAdapter` with a Super League season (10 teams, ~120 players, 3 rounds of results)
- [x] 3.3 Include a corrected stat line, a postponed fixture and a mid-season transfer in the mock data
- [x] 3.4 Test: mock adapter returns data matching the interface

## 4. Ingestion job

- [x] 4.1 Upsert competitions, teams and players by `external_id`
- [x] 4.2 Record player team history on team change
- [x] 4.3 Upsert fixtures and status, ignoring stats for postponed fixtures
- [x] 4.4 Write each fixture's box score in a single transaction, setting `corrected_at` on changes
- [x] 4.5 Log each run to `ingestion_runs`
- [x] 4.6 Tests: idempotent re-run, correction overwrite, postponement, transfer, failure mid-run

## 5. Scheduling

- [x] 5.1 Cron endpoint wrapping the ingestion job (Next.js route instead of an Edge Function; see design.md)
- [x] 5.2 pg_cron every 15 minutes with the quiet-period early exit (`supabase/schedule-ingestion.sql`, run once after deploying)
- [x] 5.3 Test: quiet-period rule with a fixed clock

## 6. Admin CSV import

- [x] 6.1 Admin check and upload page (temporary `ADMIN_TOKEN` until `add-user-accounts` adds the admin role)
- [x] 6.2 CSV import with row validation and error reporting by row number
- [x] 6.3 Tests: valid upload, unknown player rejected with nothing saved
