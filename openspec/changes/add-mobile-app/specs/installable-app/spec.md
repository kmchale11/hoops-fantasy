## Purpose

Let people add Hoops Fantasy to their phone's home screen from the website and have it launch and behave like an app, including when they have no connection.

## ADDED Requirements

### Requirement: Installable from the browser
The website SHALL meet the browser requirements for installation on Android (Chrome) and iOS (Safari "Add to Home Screen"), with the app name "Hoops Fantasy" and its own icon.

#### Scenario: Installing on Android
- **GIVEN** a visitor on the website in Chrome on Android
- **WHEN** they choose "Install app"
- **THEN** a Hoops Fantasy icon appears on their home screen

#### Scenario: Installing on iPhone
- **GIVEN** a visitor on the website in Safari on iOS
- **WHEN** they choose "Add to Home Screen"
- **THEN** the icon shown is the Hoops Fantasy icon, not a screenshot of the page

### Requirement: Full-screen launch
The installed app SHALL open without browser address bar or toolbars, starting on the user's squad if they are signed in and on the home page otherwise.

#### Scenario: Signed-in user opens the installed app
- **GIVEN** a signed-in user who has installed the app
- **WHEN** they tap the home-screen icon
- **THEN** their squad opens with no browser address bar visible

### Requirement: Install prompt
The website SHALL offer signed-in users a way to install the app, and MUST NOT show that offer to someone already using the installed app or who dismissed it in the last 30 days.

#### Scenario: User dismisses the install offer
- **GIVEN** a signed-in user who sees the install offer on the website
- **WHEN** they dismiss it
- **THEN** it doesn't appear again for 30 days

#### Scenario: Already installed
- **GIVEN** a user running the installed app
- **WHEN** they open any screen
- **THEN** no install offer is shown

### Requirement: Offline fallback
The app SHALL show a branded offline screen with a retry button when a page can't load because the device has no connection, instead of a browser error.

#### Scenario: No signal at the gym
- **GIVEN** a user with the installed app and no connection
- **WHEN** they open the app
- **THEN** they see the offline screen
- **WHEN** their connection returns and they tap retry
- **THEN** the page they wanted loads

### Requirement: Fresh game data
The app MUST NOT show cached squads, scores, prices or deadlines; game data SHALL always come from the server.

#### Scenario: Scores update after a correction
- **GIVEN** a user who viewed round scores in the installed app
- **WHEN** a stat correction changes their score and they reopen the scores screen while online
- **THEN** they see the corrected score
