## Why

Players need a single, transparent number that turns a box score into fantasy points. It must be simple enough to explain on one screen, deterministic so results can be recalculated after stat corrections, and tested independently of the database.

## What Changes

- Add a fantasy points formula applied to each player's stat line.
- Store each player's fantasy points per fixture and per round.
- Recalculate points automatically when ingestion corrects a stat line.
- Publish the scoring rules on a public "How scoring works" page.

## Out of Scope

- Squad, captain or lineup scoring (see `add-squad-selection`).
- Bonus points for double-doubles, wins or efficiency (possible later change).
- Per-competition formula differences.

## Capabilities

### New Capabilities
- `fantasy-scoring`: converting player box scores into fantasy points.

## Impact

- New table `player_fantasy_points`.
- Depends on `player_game_stats` from `add-stats-ingestion`.
- New public page `/scoring`.
