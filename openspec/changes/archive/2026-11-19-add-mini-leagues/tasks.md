## 1. Overall leaderboard

- [x] 1.1 Leaderboard query with shared ranks for ties, paginated
- [x] 1.2 Leaderboard screen highlighting the signed-in user's position
- [x] 1.3 Test: tied totals share a rank

## 2. Mini-leagues

- [x] 2.1 Migrations for `mini_leagues(id, name, admin_user_id, invite_code unique)` and `league_members` with unique `(league_id, user_id)`
- [x] 2.2 Row-level security: standings visible to members only
- [x] 2.3 Create league and share-code screen
- [x] 2.4 Join-by-code flow
- [x] 2.5 Tests: create, join, invalid code, double join blocked, non-member blocked
- [x] 2.6 Account deletion (`add-user-accounts`): `league_members.user_id` cascades on user delete, and a league whose admin is deleted passes admin to its longest-standing member (or is deleted if empty). Test: a user in two leagues is deleted and vanishes from both tables

## 3. Standings and management

- [x] 3.1 League standings screen with season total and latest round score
- [x] 3.2 Leave league; admin remove member and regenerate code
- [x] 3.3 Tests: standings order, leave, removal, old code rejected after regeneration
