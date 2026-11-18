## 1. Prices

- [ ] 1.1 Migration for `player_prices` with 4.0–15.0, 0.5-step check constraint
- [ ] 1.2 Admin price editor and CSV import
- [ ] 1.3 Tests: price constraints, unpriced player unavailable

## 2. Squad rules

- [ ] 2.1 Shared rules module: size 8, budget 100.0, max 3 per team, one captain
- [ ] 2.2 Tests: over budget, 7 players, 4 from one team, no captain, valid squad

## 3. Saving and locking

- [ ] 3.1 Migrations for `squads` and `squad_players` with row-level security
- [ ] 3.2 `save_squad()` Postgres function enforcing rules and deadline in one transaction
- [ ] 3.3 Round-lock job that carries forward the latest squad
- [ ] 3.4 Tests: change before and after deadline, carry-forward, direct insert blocked
- [ ] 3.5 `squads.user_id` references the user with `on delete cascade` (account deletion, `add-user-accounts`), with a test

## 4. Squad builder UI

- [ ] 4.1 Player list with price, team, round points and filters
- [ ] 4.2 Squad builder with live budget and rule feedback, captain picker, deadline countdown
- [ ] 4.3 Test: builder shows the same rule errors the server returns

## 5. Scoring

- [ ] 5.1 `user_round_scores` materialised view with captain doubling, refreshed after ingestion
- [ ] 5.2 Round results screen and season total
- [ ] 5.3 Tests: captain doubled, postponed player scores 0, correction recalculates, mid-season joiner
