## MODIFIED Requirements

### Requirement: Pluggable feed source
The system SHALL read league data only through a feed adapter interface, so the configured source can be changed without changing ingestion, scoring or game logic, and SHALL support a `manual` source where admins enter all league data and no feed is read.

#### Scenario: Switching to the mock feed
- **GIVEN** the feed source is configured as `mock`
- **WHEN** the ingestion job runs
- **THEN** teams, players, fixtures and stats are loaded from the mock feed
- **AND** no network request is made to the external provider

#### Scenario: Manual source
- **GIVEN** the feed source is configured as `manual`
- **WHEN** the scheduled job runs
- **THEN** no league data is read or overwritten
- **AND** scoring, round locking, carry-forward and notifications still run on the data admins entered
