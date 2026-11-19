## Why

The game works end to end, but it isn't ready to put in front of the first testers. It's hard to get around (pages are only linked from the home page), nothing explains how to play, it doesn't look like the agreed designs, and its name is a placeholder. Kevin also wants a tighter, more basketball-shaped squad: six players picked by position rather than eight of anyone.

## What Changes

- **Rename** the app to **Irish Basketball Fantasy**, set in one place, with a "Not affiliated with or endorsed by Basketball Ireland" notice and no Basketball Ireland branding.
- **Squads become 6 players by position (BREAKING):** 2 guards, 2 forwards, 1 centre and 1 flex player of any position; a 60-credit budget (was 100); at most 2 players from one club (was 3). Captain and no-bench rules stay as they are. Existing squads, which are test data only, are cleared.
- **Positions become part of the game:** every player needs a position (Guard, Forward or Centre) to fill a positional slot; a player without one can only go in the flex slot, and the admin prices page flags them so an admin can set it. The mock season gives every player a position.
- **One menu on every page:** a bottom tab bar on phones (Squad, Results, Leagues, Leaderboard, More) and the same links across the top on larger screens, with the current page highlighted. "More" holds How to play, How scoring works, Notifications, Your account, Add to home screen, Sign out, and Admin for admins.
- **A How to play page** explaining squads, the captain, deadlines and carry-over, scoring, leagues, reminders and installing the app, with every number drawn from the same constants the game uses.
- **The look from the design canvas:** dark background, orange accent, condensed headings, card-style lists, applied to every page.

## Out of Scope

- An official Basketball Ireland name or branding; that needs their agreement first.
- Changing the native app ID (`ie.hoopsfantasy.app`) or production domain; both stay open questions in `add-mobile-app` until the domain is bought.
- A bench or automatic substitutes.
- Price changes based on form, or transfer limits.
- A light theme; the app is dark-only for the beta.
- New scoring rules.

## Capabilities

### New Capabilities
- `app-branding`: the app's name, the independence notice, and its visual style.
- `app-navigation`: the menu shown on every page and what it contains for each kind of visitor.
- `game-guide`: the How to play page.

### Modified Capabilities
- `squad-selection`: squad size, budget and per-club limit change, and squads are now built by position.

## Impact

- `src/squads/rules.ts` and the `save_squad()` database function (a new migration) both change their rules and messages, and stay identical to each other.
- Squad builder and player picker screens are reorganised by position slot.
- A new shared layout component for the menu; every page drops its own ad-hoc links.
- `src/lib/app-identity.ts` `APP_NAME` becomes the single source for the name; page titles, the web manifest, the offline page, the service worker and the Android `strings.xml` read or match it.
- `src/app/globals.css` gets the new design tokens; page CSS modules are restyled.
- Overlaps `add-mobile-app` (still in progress): its store listings use the new name.
