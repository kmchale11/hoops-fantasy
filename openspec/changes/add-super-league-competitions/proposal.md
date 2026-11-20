## Why

The game runs on an invented mock season. For the beta it needs to be the real thing: the Domino's Men's Super League (12 teams) and Domino's Women's Super League (10 teams), with their real fixtures, rosters and results. The 2026–27 season tipped off on 3 October 2026, so it's already under way. There's no data feed yet (live stats sit in NBN23's Swish All Hoops app), so an admin will enter the data until Basketball Ireland or NBN23 agree to provide one.

## What Changes

- **Two competitions, Men's and Women's Super League.** One account can play either or both, with a separate squad, rounds, leaderboard and private leagues for each. A switcher at the top of the app moves between them and remembers the last one used.
- **Rounds belong to a competition (BREAKING):** round numbers and date windows are per competition, so both leagues can have a "Week 8" on the same weekend. Rounds follow Basketball Ireland's weeks, Monday to Sunday in Irish time.
- **Private leagues belong to one competition (BREAKING):** a league is created for the men's or women's game, and its table uses that competition's scores.
- **Admin season setup:** upload teams, players (with positions) and fixtures for a competition from spreadsheets, then edit them by hand: postpone or reschedule a game, move a player to another club, add a late signing.
- **Weekly results entry:** the existing box-score upload is used after each weekend. A results checklist shows which finished games still need a box score, so none get missed.
- **A `manual` data source:** the scheduled job stops pulling from a feed and only runs scoring, round locking and notifications on the data admins enter. The mock feed stays for development and tests.
- **Joining mid-season:** each competition starts the game from its next open round; earlier weeks show as not played.
- Same squad rules for both competitions (from `prepare-for-beta`): 6 players by position, 60 credits, at most 2 per club, captain scores double.

## Out of Scope

- A live data feed from NBN23 or Basketball Ireland (a later change, using the existing feed adapter).
- Division One, Division Two or cup competitions.
- A combined men's and women's leaderboard or squad.
- Club-submitted box scores.
- Live in-game scoring.
- Player photos or club logos (rights not cleared).

## Capabilities

### New Capabilities
- `competitions`: the competitions a user can play, the switcher, and keeping squads, rounds and leaderboards separate per competition.
- `season-data-entry`: admin import and editing of teams, players and fixtures, the results checklist, and the `manual` data source.

### Modified Capabilities
- `leagues`: the overall leaderboard, creating a league and league standings become per competition.
- `squad-selection`: a squad may only contain players from its round's competition.
- `stats-ingestion`: the feed source can be `manual`.

## Impact

- **Depends on** `prepare-for-beta` being built first (the positional squad rules, menu and new look). The competition switcher goes into its menu.
- Migrations: `competitions` gains `slug`, `short_name` and `gender`; `rounds` gains `competition_id`, with numbering and non-overlap per competition; `mini_leagues` gains `competition_id`; squad rules check the competition. Existing mock data and test leagues are assigned to the men's competition.
- Leaderboard, results, squad, league and notification queries all filter by competition.
- New admin pages for season setup, fixtures and the results checklist.
- Notifications: deadline reminders and results go out per competition the user has a squad in, naming the competition.
- Ongoing admin effort: about 11 box scores per weekend across both leagues, entered from the official scoresheets.
