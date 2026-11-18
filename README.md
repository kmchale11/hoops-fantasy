# Hoops Fantasy

Free-to-play fantasy basketball for Irish domestic leagues. Planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec).

## Build order

Each folder in `openspec/changes/` is one change with a proposal, specs, design (where needed) and tasks. Build them in this order:

1. `add-stats-ingestion` – feed adapter, mock Irish league data, scheduled sync
2. `add-fantasy-scoring` – points formula, rounds, recalculation on corrections
3. `add-user-accounts` – magic link / Google sign-in, 18+ confirmation, account deletion
4. `add-squad-selection` – prices, 8-player squads, captain, deadline lock, user scores
5. `add-mini-leagues` – overall leaderboard and invite-code leagues
6. `add-mobile-app` – installable web app, iOS and Android apps, push notifications for deadlines and results

Later changes, not yet specced: live in-game scoring, form-based price changes, transfers and autosubs, Division 1 and National League D2.

## Running the app

Needs Node 22+.

```bash
npm install
npm test             # 54 tests; runs the real migrations on an in-memory Postgres, no Docker needed
npm run typecheck
npm run dev
```

To sync the mock season into a real database:

1. Create a Supabase project (or run `supabase start` locally) and apply `supabase/migrations/` (`supabase db push`, or paste them into the SQL editor in order).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `CRON_SECRET` and `ADMIN_TOKEN`.
3. Trigger a sync: `curl -X POST "http://localhost:3000/api/cron/ingest?force=1" -H "Authorization: Bearer $CRON_SECRET"`
4. Upload a box score by hand at `/admin/import` using your `ADMIN_TOKEN`.

After deploying, run `supabase/schedule-ingestion.sql` once in the Supabase SQL editor to sync every 15 minutes.

## Planning with OpenSpec

```bash
npm install -g @fission-ai/openspec@latest
openspec list            # see the planned changes
openspec show add-stats-ingestion
openspec validate --all --strict
```

With your coding agent: `/openspec-apply-change add-stats-ingestion`, then `/openspec-archive-change` when it's done.
