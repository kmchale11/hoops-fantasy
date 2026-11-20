## MODIFIED Requirements

### Requirement: Overall leaderboard
The system SHALL rank, for each competition separately, every user with a saved squad in that competition by their season total in it, highest first, with ties sharing a rank.

#### Scenario: Tied managers
- **GIVEN** two users with a men's season total of 412.5
- **WHEN** the men's leaderboard is shown
- **THEN** both share the same rank and the next user's rank skips accordingly

#### Scenario: Separate leaderboards
- **GIVEN** a user ranked 3rd in the men's competition who has a women's squad
- **WHEN** the women's leaderboard is shown
- **THEN** their position there depends only on their women's total

### Requirement: Create a mini-league
The system SHALL let any signed-in user create a mini-league for one competition with a name of 3–40 characters, making them its admin and first member.

#### Scenario: Club creates a league
- **GIVEN** a signed-in user
- **WHEN** they create a league named "Ballina Braves Members"
- **THEN** the league exists with them as admin
- **AND** they receive a shareable invite code

#### Scenario: League for the women's game
- **GIVEN** a signed-in user viewing the women's competition
- **WHEN** they create a league
- **THEN** it's a women's league, labelled as such on its invite and in league lists

### Requirement: League standings
The system SHALL show each league's members ranked by their season total in the league's competition, with their score for that competition's latest completed round alongside.

#### Scenario: Viewing standings after a round
- **GIVEN** a league with 12 members and round 6 completed
- **WHEN** a member opens the league
- **THEN** they see all 12 ranked by season total with each member's round 6 score

#### Scenario: Member without a squad in that competition
- **GIVEN** a member of a women's league who has only picked a men's squad
- **WHEN** the league table is shown
- **THEN** they're listed with 0 points and a prompt to pick a women's squad
