## Purpose

Let adults create and control a minimal account for playing the game.

## ADDED Requirements

### Requirement: Passwordless sign-in
The system SHALL let users sign in with an emailed magic link or with a Google account.

#### Scenario: Magic link sign-in
- **GIVEN** a visitor enters their email address
- **WHEN** they open the link sent to that address within 1 hour
- **THEN** they are signed in

#### Scenario: Expired magic link
- **GIVEN** a magic link sent more than 1 hour ago
- **WHEN** the visitor opens it
- **THEN** they are not signed in and are offered a new link

### Requirement: Adult confirmation
The system MUST require a new user to confirm they are 18 or older and accept the terms before they can create a squad.

#### Scenario: User declines age confirmation
- **GIVEN** a newly signed-in user on the sign-up screen
- **WHEN** they do not tick the 18+ confirmation
- **THEN** they cannot continue to squad selection

### Requirement: Manager profile
The system SHALL require each user to set a manager name and a fantasy team name, each 3–30 characters, and team names MUST be unique.

#### Scenario: Duplicate team name
- **GIVEN** an existing fantasy team named "Moy Valley Ballers"
- **WHEN** another user tries to use the same name
- **THEN** they see that the name is taken

### Requirement: Minimal personal data
The system SHALL store only email address, manager name, team name, consent timestamps and game data for each user.

#### Scenario: Profile data review
- **GIVEN** a signed-in user
- **WHEN** they open their account page
- **THEN** they see every personal field held about them

### Requirement: Account deletion
The system SHALL let users permanently delete their account, removing their profile, squads and league memberships.

#### Scenario: User deletes account
- **GIVEN** a user who is a member of two mini-leagues
- **WHEN** they confirm account deletion
- **THEN** they are signed out
- **AND** their team no longer appears in either league's table
