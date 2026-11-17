## Why

Head-to-head bragging rights within a club, workplace or group of friends is what keeps people coming back each weekend. Clubs running their own league for members is also the main way the game will spread.

## What Changes

- Add an overall leaderboard of all users.
- Add private mini-leagues that anyone can create and join with an invite code.
- Show round and season standings for each league.

## Out of Scope

- Head-to-head fixture leagues.
- Public league discovery or search.
- Prizes of any kind with monetary value.

## Capabilities

### New Capabilities
- `leagues`: the overall leaderboard and private mini-leagues.

## Impact

- New tables `mini_leagues`, `league_members`.
- Reads `user_round_scores` from `add-squad-selection`.
