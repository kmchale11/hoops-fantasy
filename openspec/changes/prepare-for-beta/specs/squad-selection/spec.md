## MODIFIED Requirements

### Requirement: Squad size and budget
The system MUST only accept a squad of exactly 6 players whose combined price is 60.0 credits or less.

#### Scenario: Over budget
- **GIVEN** a squad of 6 players costing 61.5 credits
- **WHEN** the user tries to save it
- **THEN** the save is rejected with the amount over budget shown

#### Scenario: Incomplete squad
- **GIVEN** a squad of 5 players
- **WHEN** the user tries to save it
- **THEN** the save is rejected

#### Scenario: Old-size squad
- **GIVEN** a squad of 8 players within budget
- **WHEN** the user tries to save it
- **THEN** the save is rejected asking for 6 players

### Requirement: Team limit
The system MUST reject a squad that contains more than 2 players from the same real team.

#### Scenario: Four players from one club
- **GIVEN** a squad including 4 players from the same team
- **WHEN** the user tries to save it
- **THEN** the save is rejected naming that team

#### Scenario: Three players from one club
- **GIVEN** a squad including 3 players from the same team
- **WHEN** the user tries to save it
- **THEN** the save is rejected naming that team

#### Scenario: Two players from one club
- **GIVEN** an otherwise valid squad including 2 players from the same team
- **WHEN** the user saves it
- **THEN** the squad is saved

## ADDED Requirements

### Requirement: Positional squad
The system MUST only accept a squad that fills 2 guard slots, 2 forward slots, 1 centre slot and 1 flex slot, where a guard slot takes a Guard, a forward slot a Forward, the centre slot a Centre, and the flex slot a player of any position or none.

#### Scenario: Valid shape with a guard in the flex slot
- **GIVEN** a squad of 3 Guards, 2 Forwards and 1 Centre
- **WHEN** the user saves it
- **THEN** the squad is saved with the third guard in the flex slot

#### Scenario: No centre
- **GIVEN** a squad of 3 Guards and 3 Forwards
- **WHEN** the user tries to save it
- **THEN** the save is rejected saying a centre is needed

#### Scenario: Too few guards
- **GIVEN** a squad of 1 Guard, 3 Forwards and 2 Centres
- **WHEN** the user tries to save it
- **THEN** the save is rejected saying 2 guards are needed

### Requirement: Players without a position
The system SHALL let a player with no position fill only the flex slot, so a squad MUST NOT contain more than one such player.

#### Scenario: One unpositioned player
- **GIVEN** a squad of 2 Guards, 2 Forwards, 1 Centre and 1 player with no position
- **WHEN** the user saves it
- **THEN** the squad is saved with the unpositioned player in the flex slot

#### Scenario: Two unpositioned players
- **GIVEN** a squad containing 2 players with no position
- **WHEN** the user tries to save it
- **THEN** the save is rejected

#### Scenario: Admin sees who needs a position
- **GIVEN** an admin on the player prices page
- **WHEN** some players have no position
- **THEN** those players are marked as needing a position, and the admin can set Guard, Forward or Centre

### Requirement: Squad builder by position
The system SHALL show a user's squad grouped into Guards, Forwards, Centre and Flex, with each empty slot showing which positions it accepts, and picking for a slot SHALL list only players who can fill it.

#### Scenario: Picking for the centre slot
- **GIVEN** a user with an empty centre slot
- **WHEN** they tap it
- **THEN** the player list shows only Centres

#### Scenario: Unaffordable or blocked player
- **GIVEN** a user picking for their flex slot with 8.0 credits left and 2 Ballina players already
- **WHEN** they look at a Ballina player, or one costing 12.5
- **THEN** that player is shown as unavailable with the reason ("2 from Ballina already" or "Over budget by 4.5")
