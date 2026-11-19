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
npm test             # 236 tests; runs the real migrations on an in-memory Postgres, no Docker needed
npm run typecheck
npm run test:e2e     # browser tests (offline screen, notifications); first run: npx playwright install chromium
npm run dev
```

To sync the mock season into a real database:

1. Create a Supabase project (or run `supabase start` locally) and apply `supabase/migrations/` (`supabase db push`, or paste them into the SQL editor in order).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `CRON_SECRET` and the Supabase URL and keys.
3. Trigger a sync: `curl -X POST "http://localhost:3000/api/cron/ingest?force=1" -H "Authorization: Bearer $CRON_SECRET"`
4. Sign in at `/sign-in` and finish sign-up, then make yourself an admin in the SQL editor:
   `update profiles set is_admin = true where team_name = '<your team>';`
5. Set player prices at `/admin/prices` (by hand or from a CSV), and add the season's rounds to the `rounds` table.
   Unpriced players can't be picked. For the mock season, import `supabase/mock-prices.csv`, which prices each
   player from their average fantasy points in rounds 1–2 (4.0 for players who haven't played).
6. Upload a box score by hand at `/admin/import` if the feed is down.

Sign-in uses Supabase Auth. Locally, `supabase/config.toml` sets magic links to expire after 1 hour, uses the
`supabase/templates/magic-link.html` email, and turns on Google sign-in (set the two
`SUPABASE_AUTH_EXTERNAL_GOOGLE_*` variables first). On a hosted project, set the same things in the dashboard:
Authentication → Email (OTP expiry 3600, the magic-link and confirm-signup templates), → Sign In / Providers →
Google, and → URL Configuration (site URL plus `<site>/auth/callback` as a redirect URL).

After deploying, run `supabase/schedule-ingestion.sql` once in the Supabase SQL editor to sync every 15 minutes.

### Phone apps

`mobile/` holds the iOS and Android apps: Capacitor shells that load the live website (`PRODUCTION_URL` in
`src/lib/app-identity.ts`, which also sets the app ID and name). Needs Android Studio, opened once so it installs
the Android SDK, and an emulator created in its Device Manager.

```bash
cd mobile && npm install
npm run android:local   # loads the site running on this Mac (`npm run build && npx next start` in the root)
npm run android:build   # debug build against the live site
npm run android:open    # open the project in Android Studio
```

The Gradle wrapper is 9.1 rather than Capacitor's 8.14, because Android Studio's bundled Java 25 needs it.

## Planning with OpenSpec

```bash
npm install -g @fission-ai/openspec@latest
openspec list            # see the planned changes
openspec show add-stats-ingestion
openspec validate --all --strict
```

With your coding agent: `/openspec-apply-change add-stats-ingestion`, then `/openspec-archive-change` when it's done.
