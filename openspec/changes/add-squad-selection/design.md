## Decisions

### Squad versioning
`squads(id, user_id, round_id, captain_player_id, saved_at)` with one row per user per round, plus `squad_players(squad_id, player_id, price_at_pick)`. When a round locks, a job copies each user's latest squad into that round if they have none, which makes carry-forward explicit and auditable rather than inferred at query time.

### Enforcing the lock
The deadline is enforced in the database, not just the UI: a Postgres function `save_squad()` checks `now() < round.first_tip_off` and all squad rules inside one transaction, and is the only write path (row-level security blocks direct inserts). This stops a stale browser tab sneaking in a late change.

### Validation shared client and server
Squad rules (size, budget, team limit, captain) live in one TypeScript module used by the squad builder for instant feedback; `save_squad()` re-checks them in SQL. Tests run the same cases against both.

### Scoring
`user_round_scores` is a materialised view over `squad_players` × round player totals with the captain doubled, refreshed after each ingestion run. Season totals sum it.

### Pricing
Admin sets prices once pre-season via a simple table editor or CSV. Suggested starting rule: price from last season's average fantasy points per game, banded into 4.0–15.0. Imports default to 5.0 until reviewed.

## Risks / Trade-offs

- **Small leagues mean few viable players** → the 3-per-team limit and 100 budget need tuning against real prices; both are constants.
- **One game a weekend** → a single injury wrecks a round; autosubs are a deliberate later change.
