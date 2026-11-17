## Decisions

### Pure scoring function
`scoreStatLine(stats, weights): number` lives in a shared package with no database access. Weights are a typed constant (`SCORING_WEIGHTS`) that both the worker and the `/scoring` page import, so the published rules can never drift from the maths.

Rounding happens once, on the final sum (`Math.round(total * 10) / 10`), not per category, to avoid compounding errors.

### Storage
`player_fantasy_points(player_id, fixture_id, round_id, points numeric(5,1), is_final boolean, calculated_at)` with unique `(player_id, fixture_id)`. Round totals are a SQL view summing by `(player_id, round_id)` rather than a stored table, so corrections flow through without extra jobs.

### When scoring runs
The ingestion job calls scoring for every fixture it touched in that run. No separate schedule.

### Rounds
A round is a named date window (e.g. Round 7: Fri–Sun) defined in a `rounds` table, introduced here and reused by `add-squad-selection`. A fixture belongs to the round its tip-off falls in.

## Risks / Trade-offs

- **Weights untested on Irish data** → ship with these values, review after 3 rounds using real distributions; a weights change would be its own OpenSpec change.
- **Unrounded components hidden** → acceptable; the page shows the formula, not per-stat subtotals.
