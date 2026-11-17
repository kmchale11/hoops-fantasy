## 1. Scoring engine

- [ ] 1.1 Define `SCORING_WEIGHTS` constant and stat-line type
- [ ] 1.2 Implement `scoreStatLine` with single final rounding
- [ ] 1.3 Tests: guard line (34.8), negative total, all-zero line, rounding edge cases

## 2. Rounds and storage

- [ ] 2.1 Migration for `rounds` table and fixture-to-round assignment
- [ ] 2.2 Migration for `player_fantasy_points` and the round-totals view
- [ ] 2.3 Test: fixture assigned to the round its tip-off falls in

## 3. Integration with ingestion

- [ ] 3.1 Score every fixture touched in an ingestion run
- [ ] 3.2 Mark points provisional for live fixtures and final for final fixtures
- [ ] 3.3 Give 0 points to rostered players with no stat line or 0 minutes
- [ ] 3.4 Tests: live-to-final transition, correction recalculation, double-header round total, postponed fixture scores 0

## 4. Scoring page

- [ ] 4.1 Public `/scoring` page rendered from `SCORING_WEIGHTS`
- [ ] 4.2 Test: page loads signed out and lists all six weights
