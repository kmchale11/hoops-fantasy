# Tasks

## 1. Installable web app

- [ ] 1.1 Add `app/manifest.ts` (name, icons 192/512 and maskable, theme colour, `display: standalone`, `start_url: /squad`) and verify Chrome DevTools → Application shows the manifest as installable with no errors
- [ ] 1.2 Add Apple touch icon and iOS meta tags, and verify "Add to Home Screen" on an iPhone shows the Hoops Fantasy icon
- [ ] 1.3 Write `public/sw.js` with network-only game requests and a cached `/offline` page; verify with an automated browser test that a reload in offline mode shows the offline screen and retry loads the page once back online
- [ ] 1.4 Test: game pages and API responses are never served from the service worker cache (fetch a page twice with a changed score in between and assert the new value)
- [ ] 1.5 Add the `useOffline` connection banner to the root layout and verify it appears and clears when toggling offline in DevTools
- [ ] 1.6 Add the install offer for signed-in users with a 30-day dismissal and hidden in standalone mode; test both rules with a component test

## 2. Notification data and settings

- [ ] 2.1 Migration for `push_subscriptions`, `notification_preferences` and `notifications_sent` with row-level security; test that a user can't read or change another user's rows
- [ ] 2.2 Notification settings screen: master switch plus deadline and results toggles, defaulting both on; test that toggles persist and that results-only stops deadline sends
- [ ] 2.3 "Turn on reminders?" card after the first squad save that triggers the permission prompt only on tap; test that the card appears once and that declining leaves notifications off with help text shown
- [ ] 2.4 Web push subscription: generate VAPID keys, register the subscription on opt-in, store it, and verify with a test that the stored endpoint matches the browser subscription
- [ ] 2.5 Document the VAPID and Firebase environment variables in `.env.example` and verify `npm run build` fails clearly when they're missing in production

## 3. Notification sending

- [ ] 3.1 Sender interface with Web Push and FCM HTTP v1 implementations; unit-test payload shape for each and that an "unregistered" response deletes the subscription
- [ ] 3.2 Deadline reminder selection for 24h and 1h windows keyed on `lock_at`; tests with a fixed clock: on time, at most 15 minutes early, never late, and a moved deadline sends fresh reminders but not repeats of the old ones
- [ ] 3.3 Round results selection when all fixtures are final or postponed, with the user's round score; tests for a normal round, a round with a postponed game, and the 22:00–08:00 hold until the first tick from 08:00
- [ ] 3.4 Insert-then-send with rollback on failure; test that running the pass twice sends once and that a failed send is retried on the next tick
- [ ] 3.5 Run the notification pass on every cron tick before the quiet-period check; test that a reminder still sends during a 6-hour quiet period
- [ ] 3.6 Service worker push and `notificationclick` handlers that open the squad builder or round results; verify with an automated browser test that clicking each notification type opens the right page

## 4. Native app shell

- [ ] 4.1 Create `mobile/` with Capacitor iOS and Android projects loading the production URL, app ID from one config value, and minimum OS versions set; verify both build and open the home page in the simulator and emulator
- [ ] 4.2 Bundled offline page for when the site can't load; verify by launching in airplane mode on both platforms
- [ ] 4.3 Open links to other websites in the system browser; verify on both platforms that the app stays on the same screen
- [ ] 4.4 Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` for `/join/*` and `/auth/callback*`; test that both routes return the expected JSON with the right content type
- [ ] 4.5 Handle `appUrlOpen` to load tapped links in the web view; verify an invite link tapped in Messages or WhatsApp opens the app's join screen, and opens the website when the app isn't installed

## 5. Sign-in in the native app

- [ ] 5.1 Magic link round trip from the app; verify on a real iPhone and Android phone that tapping the email link opens the app signed in
- [ ] 5.2 Callback page message and resend option when a magic link is opened on a different device; test the PKCE-mismatch path renders it
- [ ] 5.3 Google sign-in through the system browser sheet and the `ie.hoopsfantasy.app://auth/callback` scheme; verify sign-in and cancel on both platforms
- [ ] 5.4 Add an automated check that the website's own sign-in still works unchanged (existing auth tests pass)

## 6. Native features

- [ ] 6.1 FCM registration on opt-in for iOS and Android (Firebase project, APNs key, `google-services.json`, `GoogleService-Info.plist`); verify a test notification sent from the sender reaches both devices
- [ ] 6.2 Notification taps open the squad builder or round results in the app; verify on both platforms from a cold start and from the background
- [ ] 6.3 Native share sheet for league invites with the league name and `/join/<code>` link, falling back to the Web Share API or copy-to-clipboard on the website; verify on both platforms and in desktop Chrome

## 7. Store release

- [ ] 7.1 App icons, splash screens and store screenshots for both stores; verify against each store's size checker
- [ ] 7.2 Privacy policy page covering notifications and device tokens, and the App Store privacy and Play data safety forms; verify the policy URL loads signed out
- [ ] 7.3 Android internal testing release; verify install and sign-in from the Play testing link on a phone outside the team
- [ ] 7.4 iOS TestFlight build with review notes explaining the native features and a demo account; verify a tester can install and play a round
- [ ] 7.5 Update the project context in `openspec/config.yaml` to say native apps are in scope, and verify `openspec validate --all --strict` passes

## 8. End-to-end check

- [ ] 8.1 Run one mock round end to end on web, installed iPhone web app, iOS app and Android app: opt in, receive 24h and 1h reminders, save a squad, receive round results, open each notification, share an invite and join from it on a second phone

## Workflow follow-up

- Submit to App Store review and Play production once testing passes.
- Archive the change after both apps are live.
