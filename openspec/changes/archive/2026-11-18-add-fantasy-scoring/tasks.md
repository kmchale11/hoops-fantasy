## 1. Scoring engine

- [x] 1.1 Define `SCORING_WEIGHTS` constant and stat-line type
- [x] 1.2 Implement `scoreStatLine` with single final rounding
- [x] 1.3 Tests: guard line (34.8), negative total, all-zero line, rounding edge cases

## 2. Rounds and storage

- [x] 2.1 Migration for `rounds` table and fixture-to-round assignment
- [x] 2.2 Migration for `player_fantasy_points` and the round-totals view
- [x] 2.3 Test: fixture assigned to the round its tip-off falls in

## 3. Integration with ingestion

- [x] 3.1 Score every fixture touched in an ingestion run
- [x] 3.2 Mark points provisional for live fixtures and final for final fixtures
- [x] 3.3 Give 0 points to rostered players with no stat line or 0 minutes
- [x] 3.4 Tests: live-to-final transition, correction recalculation, double-header round total, postponed fixture scores 0

## 4. Scoring page

- [x] 4.1 Public `/scoring` page rendered from `SCORING_WEIGHTS`
- [x] 4.2 Test: page loads signed out and lists all six weights
