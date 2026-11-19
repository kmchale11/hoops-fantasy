## ADDED Requirements

### Requirement: How to play page
The system SHALL provide a How to play page, readable without signing in, covering: building a squad (positions, budget, club limit), the captain, deadlines and carry-over, scoring (including postponed games and stat corrections), the leaderboard and private leagues, reminders and adding the app to the home screen, and that the game is free, has no prizes and is for over-18s.

#### Scenario: Visitor reads the rules
- **GIVEN** a visitor who isn't signed in
- **WHEN** they open How to play from the menu
- **THEN** the whole page is shown, ending with a button to sign in and pick a squad

#### Scenario: Signed-in user reads the rules
- **GIVEN** a signed-in user
- **WHEN** they open How to play
- **THEN** the page ends with a button to go to their squad

### Requirement: Rules always match the game
The How to play page MUST take its squad size, positions, budget, club limit, captain multiplier and scoring weights from the same values the game enforces, so the page can't contradict the rules.

#### Scenario: Budget changed
- **GIVEN** the squad budget is changed in the squad rules
- **WHEN** the How to play page is next shown
- **THEN** it states the new budget

### Requirement: First-visit prompt
The system SHALL show a new user a "New here? How to play" prompt on the squad page until they open How to play or dismiss the prompt.

#### Scenario: Dismissed
- **GIVEN** a new user who sees the prompt
- **WHEN** they dismiss it
- **THEN** it doesn't show again on that device
