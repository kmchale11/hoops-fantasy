## Purpose

Remind players before their squad locks and tell them when round results are in, only when they've asked for it, on the website, the installed web app or the native app.

## ADDED Requirements

### Requirement: Opt-in only
The system MUST NOT send any notification to a user until they have turned notifications on in the app and allowed them in the phone's or browser's permission prompt.

#### Scenario: New user hasn't opted in
- **GIVEN** a user who has never turned notifications on
- **WHEN** a squad deadline approaches
- **THEN** they receive no notification

#### Scenario: User declines the system prompt
- **GIVEN** a user who taps Turn on notifications
- **WHEN** they decline the phone's permission prompt
- **THEN** notifications stay off and the settings screen explains how to allow them in the phone's settings

### Requirement: Asking at a useful moment
The system SHALL offer to turn on notifications after a user saves their first squad, and MUST NOT show the phone's permission prompt before they tap to turn notifications on.

#### Scenario: First squad saved
- **GIVEN** a user who has just saved their first squad
- **WHEN** the save succeeds
- **THEN** they are offered deadline reminders, with a choice to turn them on or not now

### Requirement: Notification types and settings
The system SHALL let each user turn deadline reminders and round results on or off separately, with both on by default once notifications are turned on.

#### Scenario: Results only
- **GIVEN** a user with notifications on
- **WHEN** they turn deadline reminders off
- **THEN** they still receive round results but no deadline reminders

### Requirement: Deadline reminder
The system SHALL notify opted-in users 24 hours and 1 hour before a round locks, including the time it locks in Irish time.

#### Scenario: One hour before lock
- **GIVEN** a user with deadline reminders on and round 7 locking at 19:30
- **WHEN** it reaches 18:30
- **THEN** they receive a notification that round 7 locks at 19:30

#### Scenario: Deadline moved
- **GIVEN** a round whose first game is rescheduled to 2 hours later
- **WHEN** reminders are next calculated
- **THEN** reminders are sent relative to the new lock time, and none relative to the old one

### Requirement: Round results
The system SHALL notify opted-in users once all of a round's fixtures are final, with their round score.

#### Scenario: Round completes
- **GIVEN** a user with round results on who scored 212.5 in round 6
- **WHEN** the last round 6 fixture becomes final
- **THEN** they receive one notification showing 212.5 points for round 6

#### Scenario: Round with a postponed game
- **GIVEN** a round where one fixture is postponed and the rest are final
- **WHEN** the last played fixture becomes final
- **THEN** the round results notification is sent without waiting for the postponed game

### Requirement: No duplicates
The system MUST send each notification at most once per user per device, even if the job that sends it runs again.

#### Scenario: Scheduler retries
- **GIVEN** a deadline reminder already sent for round 7
- **WHEN** the sending job runs again within the same hour
- **THEN** the user doesn't receive it again

### Requirement: Quiet hours
The system MUST NOT deliver round results notifications between 22:00 and 08:00 Irish time; results that become ready then SHALL be sent at 08:00.

#### Scenario: Late finish on Saturday
- **GIVEN** a round whose last game finishes at 22:15
- **WHEN** results are ready
- **THEN** the results notification is delivered at 08:00 the next morning

### Requirement: Tapping a notification
The system SHALL open the related screen when a notification is tapped: the squad builder for a deadline reminder, round results for a results notification.

#### Scenario: Tapping a deadline reminder
- **GIVEN** a deadline reminder on the user's phone
- **WHEN** they tap it
- **THEN** the app opens on their squad builder

### Requirement: Stale devices are removed
The system SHALL stop sending to a device once the notification service reports it as no longer registered.

#### Scenario: App uninstalled
- **GIVEN** a user who uninstalled the app
- **WHEN** a send to that device is rejected as unregistered
- **THEN** that device is removed and isn't sent to again
