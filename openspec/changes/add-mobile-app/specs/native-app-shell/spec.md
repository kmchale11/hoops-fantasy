## Purpose

Provide Hoops Fantasy as an iOS and Android app that runs the same game as the website, with sign-in, invite links and sharing that work the way phone users expect.

## ADDED Requirements

### Requirement: Same game as the website
The native app SHALL show the live game from the production website, so every feature and fix reaches app users without a new app store release.

#### Scenario: Web fix reaches the app
- **GIVEN** a change to the squad builder deployed to the website
- **WHEN** an app user next opens the squad builder
- **THEN** they see the change without updating the app

### Requirement: Magic link sign-in returns to the app
The system SHALL sign a user in inside the native app when they tap a magic link on the same phone that has the app installed.

#### Scenario: Tapping the email link
- **GIVEN** a user who requested a magic link from the iOS app
- **WHEN** they tap the link in their email on that phone
- **THEN** the app opens and they are signed in

### Requirement: Google sign-in in the app
The native app SHALL let users sign in with Google through the system browser sheet, then return them to the app signed in.

#### Scenario: Google sign-in on Android
- **GIVEN** a user on the Android app sign-in screen
- **WHEN** they choose Google and approve in the browser sheet
- **THEN** the sheet closes and they are signed in to the app

#### Scenario: User cancels Google sign-in
- **GIVEN** the Google browser sheet is open
- **WHEN** the user closes it without approving
- **THEN** they are back on the app's sign-in screen, still signed out

### Requirement: Invite links open in the app
The system SHALL open `/join/<code>` links in the app when it is installed, and on the website otherwise, landing on the join screen for that league.

#### Scenario: Invite tapped in WhatsApp with the app installed
- **GIVEN** a signed-in user with the app installed
- **WHEN** they tap a league invite link in WhatsApp
- **THEN** the app opens on the join screen for that league

#### Scenario: Invite tapped without the app
- **GIVEN** a person without the app
- **WHEN** they tap the same invite link
- **THEN** the join screen opens on the website

### Requirement: Native sharing
The native app SHALL share league invites through the phone's share sheet, including the league name and invite link.

#### Scenario: Sharing an invite
- **GIVEN** a league admin in the app
- **WHEN** they tap Share invite
- **THEN** the phone's share sheet opens with a message containing the league name and its `/join/<code>` link

### Requirement: Outside links open in the browser
The native app MUST open links to other websites in the system browser, keeping the user's place in the app.

#### Scenario: Opening the terms page's external link
- **GIVEN** a user in the app
- **WHEN** they tap a link to another website
- **THEN** it opens in the browser and the app stays on the same screen

### Requirement: No connection in the app
The native app SHALL show its own offline screen with a retry button when it can't reach the game.

#### Scenario: App opened in airplane mode
- **GIVEN** a phone with no connection
- **WHEN** the user opens the app
- **THEN** they see the offline screen rather than a blank or error page

### Requirement: Minimum supported versions
The native app SHALL declare minimum iOS and Android versions in its store listings, so the stores stop it being installed on phones it can't run on.

#### Scenario: Unsupported Android version
- **GIVEN** a phone running an Android version below the minimum
- **WHEN** the user looks for the app in Google Play
- **THEN** the store shows it as not compatible with their device
