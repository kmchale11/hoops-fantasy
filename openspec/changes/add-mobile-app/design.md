## Context

See proposal.md for why. By the time this change starts, the game is a Next.js 16 app on Vercel with Supabase Auth (magic link and Google), squad selection with round deadlines, and invite-code leagues. A scheduled endpoint (`POST /api/cron/ingest`, called every 15 minutes by pg_cron) already runs the data sync and exits early in quiet periods.

## Goals / Non-Goals

**Goals:** one front end for web, installed web app and native apps; native apps that pass App Store review; one notification system serving every platform.

**Non-Goals:** bundling the web app inside the native binary; native-only screens; over-the-air update tooling (not needed, since the shell loads the live site).

## Decisions

### Capacitor shell loading the live site
The iOS and Android apps are Capacitor projects in `mobile/` whose web view loads the production URL (`server.url`), with a small bundled offline page shown when it can't load.

- **Why not bundle the app in the binary?** Next.js server routes and server rendering can't run from a static export, and loading the live site means fixes ship without a store release.
- **Why not Expo / React Native?** It means a second set of screens to build and keep in step with the website. Worth revisiting only if the game takes off.
- **App Store guideline 4.2** rejects apps that are just a website. The native push notifications, share sheet, and invite links that open the app are the native value that gets it through review; the review notes will say so.

### Installable web app with Next.js built-ins
`app/manifest.ts` (Next's manifest convention) supplies name, icons, theme colour and `display: standalone`, with `start_url` of `/squad`. A hand-written `public/sw.js` handles three things only: the offline fallback page, push events and notification taps. It uses network-only for all game pages and API calls, so nothing stale is shown, and caches only the offline page and icons. A PWA plugin was considered and rejected: the worker is small, and plugins lag behind Next.js majors.

In-page connection loss (as opposed to a failed launch) uses Next's `useOffline` hook to show a banner.

### Signing in inside the native app
Google blocks its sign-in page inside embedded web views, and email links open in the phone's browser by default. So:

- **Invite and auth links open the app:** iOS Universal Links and Android App Links, from `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` served by the website, cover `/join/*` and `/auth/callback*`. The shell's `appUrlOpen` listener loads the tapped URL in the web view.
- **Magic link:** the email links to `https://<domain>/auth/callback?...`. On a phone with the app, that opens the app, which loads the callback in its web view. The PKCE verifier cookie was set in that same web view when the link was requested, so the exchange works.
- **Google:** the app asks the website for a sign-in URL (which sets the PKCE cookie in the web view), opens it in the system browser sheet (SFSafariViewController / Chrome Custom Tabs), and Supabase redirects to a custom scheme `ie.hoopsfantasy.app://auth/callback?code=…`. The shell catches it, closes the sheet, and loads `/auth/callback?code=…` in the web view to finish. A custom scheme is used here because App Links don't reliably leave a Custom Tab.

### One notification sender, two delivery routes
- **Web and installed web app:** Web Push with VAPID keys via the `web-push` library, as in the Next.js PWA guide. iOS supports this only for web apps added to the home screen (iOS 16.4+), which the settings screen explains.
- **Native apps:** Firebase Cloud Messaging for both platforms, using a Capacitor Firebase Messaging plugin so iOS also returns an FCM token (FCM relays to APNs). One HTTP v1 sender covers both stores; the alternative, sending to APNs directly for iOS, means two senders and two sets of credentials.

### Data
- `push_subscriptions(id, user_id, kind 'web'|'fcm', endpoint_or_token unique, web_keys jsonb, platform, created_at, last_seen_at)`: one row per device or browser.
- `notification_preferences(user_id pk, enabled_at, deadline_reminders bool default true, round_results bool default true)`: the row's existence with `enabled_at` set is the opt-in.
- `notifications_sent(subscription_id, kind 'deadline_24h'|'deadline_1h'|'results', round_id, lock_at, sent_at)` with a unique key on `(subscription_id, kind, round_id, lock_at)`. That key is the "at most once per device" guarantee, and including `lock_at` means a moved deadline gets fresh reminders while the old ones can't repeat.

All three have row-level security: users manage only their own subscriptions and preferences; `notifications_sent` is service-only.

### When notifications are sent
The existing 15-minute cron endpoint runs a notification pass on every tick, before its quiet-period check, since deadlines don't follow the data sync's schedule. Each pass:
1. Finds rounds locking within 24h or 1h whose reminder hasn't been sent for that `lock_at`.
2. Finds rounds whose fixtures are all final or postponed (with at least one final) and whose results haven't been sent. Results found between 22:00 and 08:00 Irish time are left until the first tick from 08:00.
3. Inserts the `notifications_sent` row first, then sends, so a retried job can't double-send. A failed send deletes its row so the next tick retries; an "unregistered" response deletes the subscription.

A 15-minute tick means a reminder lands up to 15 minutes early, never late: the 1-hour reminder fires on the first tick at or after 75 minutes before lock.

### Asking for permission
The app's own "Turn on reminders?" card appears after a user's first squad save. Only tapping its button triggers the browser or phone prompt, because a declined system prompt can't be shown again on iOS.

## Risks / Trade-offs

- **App Store rejection under 4.2** → native push, share and links from day one; clear review notes and a demo account; Android first if review drags.
- **Google sign-in flow is the fiddliest part** → build and test it before anything else in the shell; magic link still works if Google is delayed.
- **Magic link opened on a different device** to the one that requested it fails PKCE → the callback page explains this and offers to send a new link.
- **iOS web push only after Add to Home Screen** → the settings screen tells iPhone web users to install first, or to use the App Store app.
- **Firebase dependency** for native push → acceptable at this scale; the sender sits behind an interface so APNs-direct could replace it.
- **Notification fatigue** → only two types, quiet hours for results, and per-type switches.

## Migration Plan

Additive only. Deploy the website changes (manifest, service worker, `.well-known` files, notification settings) first; the web push and installable app work on their own. Release the Android app, then iOS once review passes. Rolling back the native apps means unpublishing them; the website keeps working throughout.

## Open Questions

- **App ID and store name:** `ie.hoopsfantasy.app` and "Hoops Fantasy" are placeholders until the domain and name are confirmed; they're set in one config file.
- **Store developer account:** personal or under Adopt AI / the club. It changes only whose name is on the listing.
