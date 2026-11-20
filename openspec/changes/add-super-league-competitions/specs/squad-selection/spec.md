## ADDED Requirements

### Requirement: Players from the round's competition only
The system MUST reject a squad containing any player whose team isn't in the competition of the round being picked for.

#### Scenario: Women's player in a men's squad
- **GIVEN** a user picking a men's squad
- **WHEN** they try to save it with a Women's Super League player in it
- **THEN** the save is rejected naming that player
