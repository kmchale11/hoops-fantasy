## Why

This is the core game loop: each round, users pick a squad of real players under a budget, choose a captain, and score their players' fantasy points. Lineups must lock at tip-off so nobody can pick players after seeing results.

## What Changes

- Add player prices in credits, set by an admin before the season.
- Add squad selection: 8 players, 100-credit budget, at most 3 players from any one team.
- Add a captain whose points count double.
- Add round deadlines: squads lock at the first tip-off of the round.
- Carry a squad forward to the next round unless the user changes it.
- Calculate each user's round score and season total.

## Out of Scope

- Prices that change with form (later change).
- Transfer limits, chips or wildcards.
- Position-based squad rules (positions data not yet reliable).
- Automatic substitutes for players who don't play.
- Live in-game score updates (later change).

## Capabilities

### New Capabilities
- `squad-selection`: pricing, squad rules, captaincy, round locking and user scoring.

## Impact

- New tables `player_prices`, `squads`, `squad_players`, `user_round_scores`.
- Uses `rounds` and `player_fantasy_points` from `add-fantasy-scoring` and `profiles` from `add-user-accounts`.
- Main app screens: player list, squad builder, round results.
