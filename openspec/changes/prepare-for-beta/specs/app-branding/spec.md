## ADDED Requirements

### Requirement: App name
The system SHALL call the app "Irish Basketball Fantasy" everywhere it shows a name, taking it from one setting so that it can be changed in one place.

#### Scenario: Page titles
- **GIVEN** any page of the website
- **WHEN** it loads
- **THEN** the browser tab title ends with "Irish Basketball Fantasy"

#### Scenario: Installed app
- **GIVEN** a user who adds the website to their home screen
- **WHEN** they look at the icon
- **THEN** it's labelled "Irish Basketball Fantasy", or a short name that fits under the icon

#### Scenario: Name changed in one place
- **GIVEN** a developer changes the app name setting
- **WHEN** the app is rebuilt
- **THEN** every page title, the web app manifest, the offline page and the How to play page show the new name, with no other code changes

### Requirement: Independence notice
The system SHALL state "Not affiliated with or endorsed by Basketball Ireland" in the footer of the home page and on the How to play page, and MUST NOT use Basketball Ireland's logo, colours or the word "official".

#### Scenario: Notice on the home page
- **GIVEN** a visitor on the home page
- **WHEN** they scroll to the bottom
- **THEN** they see the independence notice

### Requirement: Visual style
The system SHALL use the dark style from the design canvas on every page: a near-black background, one orange accent, condensed uppercase headings and card-style rows, with text contrast of at least 4.5:1 and touch targets of at least 44 by 44 pixels.

#### Scenario: Consistent look
- **GIVEN** any page, including sign-in, account and admin pages
- **WHEN** it loads
- **THEN** it uses the same background, accent colour, heading style and menu as the squad page

#### Scenario: Readable text
- **GIVEN** any text on any page
- **WHEN** its contrast is measured against its background
- **THEN** it is at least 4.5:1
