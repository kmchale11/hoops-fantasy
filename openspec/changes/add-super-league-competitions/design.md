## Context

See proposal.md for why. Today the schema has a `competitions` table that teams and fixtures already point at, but rounds, squads, mini-leagues and leaderboards assume one competition: `rounds.number` is globally unique and round windows can't overlap anywhere. The only data source in use is the mock feed. `prepare-for-beta` (to be built first) brings the positional squad rules, the menu and the new look.

Real 2026–27 facts this design is based on (Basketball Ireland, 30 July 2026): both leagues started on 3 October 2026; the Men's Super League has 12 teams and the Women's Super League 10; both are straight leagues with a top-eight playoff; live stats are published through NBN23's Swish All Hoops app. The team lists are in `data/2026-27/`.

## Goals / Non-Goals

**Goals:** two independent games in one app; rounds that match Basketball Ireland's weeks; an admin workflow fast enough to run every weekend; no change to scoring or squad rules.

**Non-Goals:** a live feed, playoffs and cups as separate games, combined leaderboards, per-competition squad rules.

## Decisions

### Competition data
`competitions` gains `slug` (`mens-super-league`, `womens-super-league`), `short_name` ("Men's", "Women's"), `gender` (`men`/`women`) and `season_start_week` (the Monday of week 1, 28 September 2026 for both). The two competitions are created by a migration. The old mock competition stays for tests only, with `slug = 'mock'`, and is hidden unless `FEED_SOURCE=mock`.

### Rounds per competition
`rounds` gains `competition_id`, with `unique (competition_id, number)`. The exclusion constraint becomes `exclude using gist (competition_id with =, tstzrange(starts_at, ends_at, '[)') with &&)` (needs `btree_gist`, which Supabase provides). `fixture_rounds` joins on matching competition. Existing rows are assigned to the mock competition.

Rounds are generated, not typed in: `generate_rounds(competition)` creates one round for each Monday-to-Monday week, in Europe/Dublin time, that has at least one fixture. It's named "Week N" with N counted from `season_start_week`, so it matches Basketball Ireland's numbering even when weeks are skipped. It runs after every fixtures import or fixture edit. A round whose deadline has passed is never moved or renumbered.

### Squads, scores and leaderboards
Squads already point at a round, so a squad belongs to that round's competition. `squad_rule_errors` gains one check: every player's current team is in the round's competition. Round scores, season totals and the leaderboard view gain `competition_id` and are always queried for one competition. The late-joiner rule already works per round, so "season total starts from week 8" needs no special code.

### Mini-leagues
`mini_leagues` gains a required `competition_id`. Existing test leagues are set to the men's competition. Joining by code works from either competition view and switches to the league's competition. Invite share text includes the competition ("Join my Women's Super League league…").

### The switcher
The current competition is a cookie (`competition=<slug>`) read by server components, with a `?c=<slug>` override so shared links land in the right one. A segmented control at the top of Squad, Results, Leagues and Leaderboard switches it, and the menu itself doesn't change. A user with no cookie who has a squad in exactly one competition gets that one; otherwise they get the first-visit chooser. The choice is per device, not stored on the account.

Route-segment URLs (`/mens/squad`) were considered. They're cleaner for sharing but mean moving every page, and the query override covers sharing.

### The `manual` source
`FEED_SOURCE=manual` gets a `ManualFeedAdapter` whose job is to read nothing. The cron route skips the sync but still runs carry-forward, round locking and notifications. Scoring for a fixture runs when its box score is uploaded (the CSV import calls the same scoring step ingestion uses), so results appear straight away rather than on the next tick.

### Season setup import
Three CSV formats per competition, all validated in full before a single transaction writes them (the same pattern as the box-score import):
- `teams.csv`: `name,short_name`
- `players.csv`: `full_name,team,position` (team by name or short name; position G/F/C or blank)
- `fixtures.csv`: `date,time,home,away` (date `YYYY-MM-DD`, time `HH:MM` in Irish time)

External IDs for admin-entered rows are `manual-<competition>-<type>-<n>`, stable across re-uploads by matching on name (teams and players within a competition) or on date, home and away (fixtures). Unknown names report the closest match by edit distance. Starter files for teams are in `data/2026-27/`; players and fixtures are gathered from Basketball Ireland's published fixtures and club rosters (a one-off task for Kevin, see tasks).

### Results checklist and audit
The checklist is a query of fixtures more than 3 hours past tip-off with no stat lines and not postponed, grouped by competition. A count badge appears on the Admin menu item. Every admin write inserts into `admin_changes(id, admin_user_id, competition_id, action, summary, at)`, and the last 50 show on the admin home page.

### Notifications
Reminders and results go out per round, and rounds are per competition, so the existing once-per-device key already separates them. Message text names the competition ("Women's Super League: your squad locks at 14:00"). Users only get them for competitions where they have a squad.

## Risks / Trade-offs

- **Weekly admin effort.** About 11 box scores per weekend means typing roughly 220 stat lines from scoresheets, maybe 2–3 hours a week by hand. Mitigations: the checklist, row-level validation, and asking NBN23 or Basketball Ireland for a CSV export or feed early. The feed adapter means a real feed replaces this without touching game code.
- **Data rights.** Real player names and stats are public sporting facts, but the stats come from Basketball Ireland's scoresheets and NBN23's app. Keep the "not affiliated" notice and raise the game with Basketball Ireland before a wide launch.
- **Errors in hand-entered data** → corrections overwrite and rescore automatically (existing behaviour), and the audit log shows who changed what.
- **Mid-season start** means fewer rounds to play → acceptable for a beta; it's a full season next year.
- **Sponsor names change** ("Garvey's Tralee Warriors") → team names are editable and re-uploadable; short names are what users mostly see.

## Migration Plan

1. Migration: competition columns, the two real competitions, `btree_gist`, per-competition rounds and constraints, `mini_leagues.competition_id`, `admin_changes`, and the squad rule check. Existing rows go to the mock competition (rounds) or the men's competition (test leagues).
2. Deploy with `FEED_SOURCE=manual`.
3. Import teams, players, fixtures and prices for each competition, which generates rounds.
4. Open the game. Each competition starts from its next open round.

Rollback before launch is reverting the commit and resetting the database. There's no live data to preserve yet.

## Open Questions

- **Prices for real players:** the existing admin price editor works, but setting about 300 prices by hand is slow. A suggested-price rule from last season's averages would need last season's stats. For the beta, prices can come in the players CSV as an optional `price` column.
- **Playoffs (March 2027):** whether the game continues into playoff weeks, which have fewer teams and games, is a later decision.
