## Why

Fantasy players check their squads on their phones, mostly on match weekends, and a game people forget to open loses them fast. Being in the App Store and Play Store makes the game easy to find and share, and push notifications ("your squad locks in 1 hour") are what bring people back each round. This comes after the MVP is playable, so the native app wraps a working game rather than a placeholder.

## What Changes

- Make the web app installable as a Progressive Web App: home-screen icon, full-screen launch, and an offline fallback screen.
- Add a native iOS and Android app that wraps the hosted web app, so there is still one front end to maintain.
- Make sign-in work inside the native app, including magic links and Google sign-in, which can't run inside an embedded web view.
- Open league invite links (`/join/<code>`) directly in the app when it's installed.
- Use the native share sheet for sharing league invite codes.
- Add opt-in push notifications on the web and in the native app for squad deadlines and round results, with per-type settings.
- Prepare and submit store listings for both stores.
- Update the project context in `openspec/config.yaml`, which currently says there are no native apps.

## Out of Scope

- A separate native front end (Expo / React Native). The app shell loads the same screens as the website.
- Offline play: picking a squad or viewing scores needs a connection.
- Live in-game score notifications (belongs with the later live-scoring change).
- Marketing notifications, in-app purchases and ads.
- Tablet-specific layouts.

## Capabilities

### New Capabilities
- `installable-app`: installing the web app to a home screen and how it behaves when launched that way or when offline.
- `native-app-shell`: the iOS and Android apps — loading the game, signing in, opening invite links and sharing.
- `push-notifications`: opting in to notifications, choosing which ones to get, and when deadline and results notifications are sent.

### Modified Capabilities
None. The capabilities this builds on (`user-accounts`, `squad-selection`, `leagues`) keep their requirements; this change only adds ways to reach them.

## Impact

- **Depends on** `add-user-accounts`, `add-squad-selection` and `add-mini-leagues` being built first.
- New: web app manifest, icons, service worker, `/offline` and `/join/<code>` routes, notification settings screen.
- New tables: `push_subscriptions`, `notification_preferences`, `notifications_sent`.
- New `mobile/` directory with the Capacitor iOS and Android projects.
- Auth callback changes so sign-in can return to the native app.
- New external services: Apple Push Notification service and Firebase Cloud Messaging, plus Apple Developer (about €99 a year) and Google Play (about $25 once) accounts.
- The notification sender runs from the existing scheduled job.
