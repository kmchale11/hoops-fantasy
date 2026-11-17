## Purpose

Rank users against everyone and against the groups they choose to compete with.

## ADDED Requirements

### Requirement: Overall leaderboard
The system SHALL rank every user with a saved squad by season total, highest first, with ties sharing a rank.

#### Scenario: Tied managers
- **GIVEN** two users with a season total of 412.5
- **WHEN** the leaderboard is shown
- **THEN** both share the same rank and the next user's rank skips accordingly

### Requirement: Create a mini-league
The system SHALL let any signed-in user create a mini-league with a name of 3–40 characters, making them its admin and first member.

#### Scenario: Club creates a league
- **GIVEN** a signed-in user
- **WHEN** they create a league named "Ballina Braves Members"
- **THEN** the league exists with them as admin
- **AND** they receive a shareable invite code

### Requirement: Join by invite code
The system SHALL let a signed-in user join a league by entering its 6-character invite code, and a user MUST NOT be a member of the same league twice.

#### Scenario: Join with a valid code
- **GIVEN** a valid invite code
- **WHEN** a user enters it
- **THEN** they become a member and see the league table

#### Scenario: Invalid code
- **GIVEN** a code that matches no league
- **WHEN** a user enters it
- **THEN** they see that the code was not recognised

### Requirement: League standings
The system SHALL show each league's members ranked by season total, with their score for the latest completed round alongside.

#### Scenario: Viewing standings after a round
- **GIVEN** a league with 12 members and round 6 completed
- **WHEN** a member opens the league
- **THEN** they see all 12 ranked by season total with each member's round 6 score

### Requirement: League privacy
The system MUST only show a mini-league's standings to its members.

#### Scenario: Non-member opens a league link
- **GIVEN** a user who is not a member
- **WHEN** they open the league's page
- **THEN** they see a prompt to join instead of the standings

### Requirement: Leaving and removal
The system SHALL let a member leave a league, and let the league admin remove a member or regenerate the invite code.

#### Scenario: Admin regenerates code after it was leaked
- **GIVEN** a league admin
- **WHEN** they regenerate the invite code
- **THEN** the old code no longer works
- **AND** existing members are unaffected
