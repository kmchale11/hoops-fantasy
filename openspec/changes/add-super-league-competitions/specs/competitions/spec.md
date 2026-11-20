## ADDED Requirements

### Requirement: Men's and Women's Super League
The system SHALL offer two competitions, the Domino's Men's Super League and the Domino's Women's Super League, each with its own teams, players, fixtures and rounds.

#### Scenario: Teams per competition
- **GIVEN** the 2026–27 season has been set up
- **WHEN** a user browses players in the women's competition
- **THEN** only players from the 10 Women's Super League teams are listed

### Requirement: Play either or both
The system SHALL let one account keep a separate squad in each competition, and a user MAY play only one of them.

#### Scenario: Squads in both
- **GIVEN** a user with a saved men's squad
- **WHEN** they switch to the women's competition and save a squad there
- **THEN** both squads are kept, each scored only from its own competition

#### Scenario: Only one competition
- **GIVEN** a user who has only ever picked a men's squad
- **WHEN** the women's leaderboard is shown
- **THEN** that user doesn't appear on it

### Requirement: Competition switcher
The system SHALL show a switcher at the top of the squad, results, leagues and leaderboard pages, naming the current competition, and SHALL remember the competition last chosen on that device.

#### Scenario: Switching
- **GIVEN** a user viewing the men's leaderboard
- **WHEN** they choose Women's in the switcher
- **THEN** the women's leaderboard is shown and the menu stays on Leaderboard

#### Scenario: Returning user
- **GIVEN** a user who last viewed the women's competition on their phone
- **WHEN** they open the app again on that phone
- **THEN** the women's competition is shown

#### Scenario: First visit
- **GIVEN** a new user with no saved choice
- **WHEN** they open the squad page
- **THEN** they're asked which competition to play, with both offered and an option to play both

### Requirement: Rounds per competition
The system SHALL number each competition's rounds separately, one per Basketball Ireland week (Monday 00:00 to Monday 00:00 Irish time) with at least one fixture, and lock each competition's squads at its own first tip-off of the round.

#### Scenario: Same weekend, different deadlines
- **GIVEN** a weekend where the first women's game tips off Saturday at 14:00 and the first men's game Saturday at 19:30
- **WHEN** it's Saturday at 15:00
- **THEN** women's squads are locked and men's squads can still be changed

#### Scenario: Week with no games
- **GIVEN** a week with no fixtures in the men's competition, such as a cup weekend
- **WHEN** rounds are generated
- **THEN** there is no men's round for that week, and men's squads carry forward to the next round

### Requirement: Joining mid-season
The system SHALL start the game in each competition from the first round whose deadline hasn't passed when the competition is opened, and show earlier rounds as not played.

#### Scenario: Launching in week 8
- **GIVEN** the season started on 3 October and the game opens during week 8
- **WHEN** a user picks their first squad
- **THEN** it's for week 8, and every user's season total starts from week 8
