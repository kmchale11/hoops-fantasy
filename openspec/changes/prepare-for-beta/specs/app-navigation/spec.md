## ADDED Requirements

### Requirement: Menu on every page
The system SHALL show the same menu on every page, highlighting the current section, as a bottom tab bar on screens narrower than 768 pixels and as links across the top on wider screens.

#### Scenario: Phone
- **GIVEN** a signed-in user on a phone
- **WHEN** they open any page
- **THEN** a bottom tab bar shows Squad, Results, Leagues, Leaderboard and More, with the current section highlighted

#### Scenario: Computer
- **GIVEN** a signed-in user on a laptop
- **WHEN** they open any page
- **THEN** the same five sections appear as links across the top

#### Scenario: Tab bar and the iPhone home bar
- **GIVEN** the installed app on an iPhone with a home bar
- **WHEN** the tab bar shows
- **THEN** none of its tabs sit under the home bar

### Requirement: More menu
The system SHALL provide a More page listing How to play, How scoring works, Notifications, Your account, Add to home screen and Sign out, plus Admin for admins only.

#### Scenario: Admin link hidden from players
- **GIVEN** a signed-in user who isn't an admin
- **WHEN** they open More
- **THEN** there is no Admin link

#### Scenario: Admin link for admins
- **GIVEN** a signed-in admin
- **WHEN** they open More
- **THEN** an Admin link leads to player prices and positions, and box-score import

#### Scenario: Already installed
- **GIVEN** a user using the installed app
- **WHEN** they open More
- **THEN** Add to home screen isn't listed

### Requirement: Menu when signed out
The system SHALL show signed-out visitors a menu of Home, How to play and Sign in only.

#### Scenario: Visitor before signing in
- **GIVEN** a visitor who isn't signed in
- **WHEN** they open the home page
- **THEN** the menu shows Home, How to play and Sign in, and not Squad or Results

### Requirement: Accessible menu
The menu MUST be a labelled navigation landmark of real links, mark the current page for screen readers, and be fully usable with a keyboard.

#### Scenario: Keyboard user
- **GIVEN** a keyboard user on the results page
- **WHEN** they press Tab from the top of the page
- **THEN** they can reach every menu link, and the Results link is announced as the current page
