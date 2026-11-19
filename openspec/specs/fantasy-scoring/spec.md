# fantasy-scoring Specification

## Purpose

Turn each player's box score into fantasy points using one published, deterministic formula.

## Requirements

### Requirement: Points formula
The system SHALL calculate a player's fantasy points for a fixture as: points × 1, rebounds × 1.2, assists × 1.5, steals × 3, blocks × 3, and turnovers × −1, rounded to one decimal place.

#### Scenario: Typical guard line
- **GIVEN** a stat line of 18 points, 4 rebounds, 6 assists, 2 steals, 0 blocks and 3 turnovers
- **WHEN** fantasy points are calculated
- **THEN** the result is 34.8

#### Scenario: Negative total
- **GIVEN** a stat line of 0 points, 0 rebounds, 0 assists, 0 steals, 0 blocks and 2 turnovers
- **WHEN** fantasy points are calculated
- **THEN** the result is −2.0

### Requirement: Only final fixtures count
The system SHALL treat a player's fantasy points as final only when the fixture status is `final`; points for `live` fixtures SHALL be marked provisional.

#### Scenario: Points during a live game
- **GIVEN** a fixture with status `live`
- **WHEN** points are calculated for its players
- **THEN** each result is stored as provisional

#### Scenario: Game finishes
- **GIVEN** provisional points for a live fixture
- **WHEN** the fixture status becomes `final`
- **THEN** the points are recalculated and marked final

### Requirement: Did not play
The system SHALL give a player 0 fantasy points for a fixture they did not appear in, including postponed fixtures.

#### Scenario: Player on the bench all game
- **GIVEN** a final fixture with no stat line, or 0 minutes, for a player on one of the teams
- **WHEN** points are calculated
- **THEN** the player scores 0 for that fixture

### Requirement: Recalculation on correction
The system SHALL recalculate a player's fantasy points within one ingestion run whenever the underlying stat line is corrected.

#### Scenario: Steals corrected after the game
- **GIVEN** a final fixture where a player was scored with 1 steal
- **WHEN** ingestion corrects it to 2 steals
- **THEN** that player's fantasy points for the fixture increase by 3

### Requirement: Round totals
The system SHALL total each player's fantasy points across all fixtures in a round, so that a player with two games in one round scores for both.

#### Scenario: Double-header weekend
- **GIVEN** a player with 20.0 points on Saturday and 15.5 points on Sunday in the same round
- **WHEN** round totals are calculated
- **THEN** the player's round total is 35.5

### Requirement: Published scoring rules
The system SHALL show the current scoring weights on a public page reachable without signing in.

#### Scenario: Logged-out visitor checks the rules
- **GIVEN** a visitor who is not signed in
- **WHEN** they open the scoring page
- **THEN** they see the weight for each stat category
