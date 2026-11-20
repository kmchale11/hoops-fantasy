## ADDED Requirements

### Requirement: Season setup import
The system SHALL let an admin upload, for one competition, a teams spreadsheet (name, short name), a players spreadsheet (full name, team, position G/F/C or blank) and a fixtures spreadsheet (date, tip-off time in Irish time, home team, away team), validating every row before anything is saved.

#### Scenario: Valid fixtures upload
- **GIVEN** an admin uploading 132 men's fixtures where every team name matches a men's team
- **WHEN** the file is validated
- **THEN** all 132 fixtures are saved as scheduled, and the admin sees how many were added and updated

#### Scenario: Unknown team
- **GIVEN** a fixtures file with "Tralee Warriors" on row 14 but the team is saved as "Garvey's Tralee Warriors"
- **WHEN** the file is validated
- **THEN** nothing is saved and the admin sees row 14 and the unknown team name, with the closest match suggested

#### Scenario: Uploading again
- **GIVEN** a players file already imported
- **WHEN** the same file is uploaded again with two positions changed
- **THEN** no duplicate players are created and only those two positions change

### Requirement: Editing fixtures
The system SHALL let an admin postpone a fixture, reschedule it to a new date and time, or correct its teams, and SHALL move it to the round its new tip-off falls in.

#### Scenario: Postponed for weather
- **GIVEN** a scheduled men's fixture on Saturday
- **WHEN** an admin marks it postponed
- **THEN** it's shown as postponed, and its players score 0 for the round unless it's rescheduled within it

#### Scenario: Rescheduled to a later week
- **GIVEN** a postponed fixture
- **WHEN** an admin reschedules it into week 14
- **THEN** it counts towards week 14, and week 14's deadline is recalculated if it's now the earliest game

### Requirement: Editing players
The system SHALL let an admin add a player, set their position, move them to another team in the same competition, or mark them as no longer playing.

#### Scenario: Mid-season signing
- **GIVEN** a club signs a new import player
- **WHEN** an admin adds them with team, position and price
- **THEN** they can be picked from the next open round

#### Scenario: Player leaves
- **GIVEN** a player who has left the league
- **WHEN** an admin marks them as no longer playing
- **THEN** they can't be picked, and anyone who has them keeps them until they swap them out

### Requirement: Results checklist
The system SHALL show admins, per competition, each fixture whose tip-off was more than 3 hours ago with no box score, so results can be entered, and a count of them on the admin menu.

#### Scenario: Sunday night
- **GIVEN** 6 men's and 5 women's games played this weekend, with box scores entered for 9
- **WHEN** an admin opens the results checklist
- **THEN** the 2 missing games are listed with links to upload their box scores

### Requirement: Box scores finalise games
The system SHALL treat a fixture with an uploaded box score as final, score it immediately, and check that each player in the box score belongs to one of the two teams in that fixture.

#### Scenario: Wrong team's player
- **GIVEN** a box score for Killester v UCD Marian that lists a Neptune player
- **WHEN** it's uploaded
- **THEN** nothing is saved and the row is reported

### Requirement: Admin actions are recorded
The system SHALL record which admin made each import or edit and when, and show the last 50 changes on the admin pages.

#### Scenario: Who changed it
- **GIVEN** a fixture rescheduled by an admin
- **WHEN** another admin views recent changes
- **THEN** they see the fixture, the change, who made it and when
