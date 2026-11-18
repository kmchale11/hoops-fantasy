# squad-selection Specification

## Purpose

Let each user pick a fair, budget-limited squad of real players each round and score it from their players' fantasy points.

## Requirements

### Requirement: Player prices
The system SHALL give every active player a price between 4.0 and 15.0 credits, in steps of 0.5, set by an admin.

#### Scenario: Unpriced player
- **GIVEN** a player added by ingestion with no price set
- **WHEN** a user browses players
- **THEN** that player is shown as unavailable for selection

### Requirement: Squad size and budget
The system MUST only accept a squad of exactly 8 players whose combined price is 100.0 credits or less.

#### Scenario: Over budget
- **GIVEN** a squad of 8 players costing 101.5 credits
- **WHEN** the user tries to save it
- **THEN** the save is rejected with the amount over budget shown

#### Scenario: Incomplete squad
- **GIVEN** a squad of 7 players
- **WHEN** the user tries to save it
- **THEN** the save is rejected

### Requirement: Team limit
The system MUST reject a squad that contains more than 3 players from the same real team.

#### Scenario: Four players from one club
- **GIVEN** a squad including 4 players from the same team
- **WHEN** the user tries to save it
- **THEN** the save is rejected naming that team

### Requirement: Captain
The system SHALL require exactly one squad player to be captain, and the captain's round points SHALL count double.

#### Scenario: Captain scores
- **GIVEN** a captain who scores 25.0 fantasy points in the round
- **WHEN** the user's round score is calculated
- **THEN** the captain contributes 50.0 points

### Requirement: Round deadline lock
The system MUST prevent any change to a squad from the first tip-off of a round until that round's final fixture ends.

#### Scenario: Change after deadline
- **GIVEN** a round whose first game tipped off 10 minutes ago
- **WHEN** a user tries to swap a player
- **THEN** the change is rejected and the deadline is shown

#### Scenario: Change before deadline
- **GIVEN** a round whose first game is in 2 hours
- **WHEN** a user swaps a player within the rules
- **THEN** the squad is saved

### Requirement: Squad carries forward
The system SHALL use a user's most recent saved squad for a round if they make no changes before its deadline.

#### Scenario: User forgets to log in
- **GIVEN** a user who saved a squad for round 4 and made no changes for round 5
- **WHEN** round 5 locks
- **THEN** their round 4 squad and captain are used for round 5

### Requirement: Round and season scores
The system SHALL calculate each user's round score as the sum of their squad players' round points with the captain doubled, and their season total as the sum of their round scores.

#### Scenario: Player whose game is postponed
- **GIVEN** a squad player whose only fixture in the round is postponed
- **WHEN** the round score is calculated
- **THEN** that player contributes 0 points

#### Scenario: Score updates after a stat correction
- **GIVEN** a completed round score
- **WHEN** ingestion corrects a squad player's stats for that round
- **THEN** the user's round score and season total are recalculated

### Requirement: No late joiners at an advantage
The system SHALL give a user who joins mid-season 0 points for every round that locked before their first saved squad.

#### Scenario: Joining at round 6
- **GIVEN** a user who saves their first squad before round 6 locks
- **WHEN** their season total is shown
- **THEN** rounds 1–5 count as 0 points
