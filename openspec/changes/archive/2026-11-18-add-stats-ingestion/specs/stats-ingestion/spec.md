## Purpose

Keep a complete, corrected copy of Irish league fixtures and box scores in our own database, independent of which external feed supplies them.

## ADDED Requirements

### Requirement: Pluggable feed source
The system SHALL read league data only through a feed adapter interface, so the configured source can be changed without changing ingestion, scoring or game logic.

#### Scenario: Switching to the mock feed
- **GIVEN** the feed source is configured as `mock`
- **WHEN** the ingestion job runs
- **THEN** teams, players, fixtures and stats are loaded from the mock feed
- **AND** no network request is made to the external provider

### Requirement: Scheduled sync
The system SHALL run ingestion every 15 minutes while any fixture is live or finished within the last 48 hours, and every 6 hours otherwise.

#### Scenario: Game night polling
- **GIVEN** a Super League fixture has status `live`
- **WHEN** 15 minutes have passed since the last ingestion run
- **THEN** a new ingestion run starts

#### Scenario: Quiet midweek
- **GIVEN** no fixture is live or finished in the last 48 hours
- **WHEN** 15 minutes have passed since the last run
- **THEN** no run starts until 6 hours have passed

### Requirement: Idempotent upserts
The system SHALL identify every team, player, fixture and stat line by the feed's external ID, so that repeating a run produces no duplicate records.

#### Scenario: Same data ingested twice
- **GIVEN** a completed ingestion run for round 5
- **WHEN** the same feed data is ingested again
- **THEN** the number of players, fixtures and stat lines is unchanged

### Requirement: Stat corrections overwrite
The system SHALL replace a player's stored stat line with the feed's latest values and record that a correction occurred.

#### Scenario: Scorer corrects rebounds after the game
- **GIVEN** a stored stat line with 7 rebounds for a final fixture
- **WHEN** the feed now reports 9 rebounds for that player and fixture
- **THEN** the stored value becomes 9
- **AND** the stat line is flagged as corrected with the time of correction

### Requirement: Fixture status tracking
The system SHALL store each fixture's status as one of `scheduled`, `live`, `final` or `postponed`, along with its scheduled tip-off time in Europe/Dublin time.

#### Scenario: Game postponed
- **GIVEN** a fixture with status `scheduled`
- **WHEN** the feed marks it postponed
- **THEN** its status becomes `postponed`
- **AND** any stat lines received for it are ignored until it is rescheduled

#### Scenario: Postponed game rescheduled
- **GIVEN** a fixture with status `postponed`
- **WHEN** the feed provides a new tip-off time
- **THEN** its status becomes `scheduled` with the new time

### Requirement: Player team changes
The system SHALL keep a history of which team each player belongs to, with the date each spell started and ended.

#### Scenario: Import player transfers mid-season
- **GIVEN** a player recorded at Ballina Braves
- **WHEN** the feed lists that player on a different team
- **THEN** the Ballina Braves spell is closed with today's date
- **AND** a new spell starts with the new team

### Requirement: Run logging and failure handling
The system SHALL record every ingestion run with its start time, end time, record counts and outcome, and a failed run MUST NOT leave partially written stats for any fixture.

#### Scenario: Feed times out mid-run
- **GIVEN** an ingestion run that has written stats for 3 of 6 fixtures
- **WHEN** the feed request for the 4th fixture times out
- **THEN** the run is logged as failed with the error
- **AND** each fixture's stats are either fully written or untouched

### Requirement: Manual CSV import
The system SHALL let an admin upload a CSV of box scores for a single fixture, validated against the same rules as feed data before anything is saved.

#### Scenario: Valid CSV upload
- **GIVEN** an admin and a fixture with no stats
- **WHEN** the admin uploads a CSV with one valid row per player
- **THEN** the stat lines are saved and the admin sees a count of rows imported

#### Scenario: CSV with an unknown player
- **GIVEN** an admin uploads a CSV containing a player not in the database
- **WHEN** the file is validated
- **THEN** nothing is saved
- **AND** the admin sees the row number and the unknown player's name
