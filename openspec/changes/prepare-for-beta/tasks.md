# Tasks

## 1. Positional squads

- [ ] 1.1 Migration: constrain `players.position` to `G`, `F`, `C` or null, mapping existing values; verify with a migration test that bad values are rejected
- [ ] 1.2 Update the mock season so every player has a position, with at least 2 centres per team; verify with a mock-feed test
- [ ] 1.3 Update `rules.ts`: `SQUAD_SIZE = 6`, `BUDGET = 60`, `MAX_PER_TEAM = 2`, `SLOTS`, and the new positional errors in the order in design.md; unit-test every scenario in the squad-selection spec delta
- [ ] 1.4 Migration replacing `squad_rule_errors` with the same rules and messages; run the shared rule cases against both TypeScript and SQL and verify identical output
- [ ] 1.5 Clear squads for unlocked rounds in that migration, with a comment that it's pre-launch only; test that locked-round squads and scores are untouched
- [ ] 1.6 Slot-ordering helper (guards, forwards, centre, then flex) for display; unit-test the 3-guard and unpositioned-player cases
- [ ] 1.7 Admin prices page: show and set position, and flag players with none; test that a non-admin can't set positions

## 2. Squad builder by position

- [ ] 2.1 Squad page grouped into Guards, Forwards, Centre and Flex, with empty-slot cards and budget, players and per-club summaries, matching the canvas "My squad" screen; verify the layout at 390 px wide
- [ ] 2.2 Picker filtered to the tapped slot, with unavailable players dimmed and the reason shown; component-test the Centre filter and the over-budget and club-full reasons
- [ ] 2.3 Update the results page for 6 players; verify the captain and postponed-flex cases render

## 3. Name and notice

- [ ] 3.1 `APP_NAME = "Irish Basketball Fantasy"` and `APP_SHORT_NAME`; root `title.template`; replace every hard-coded "Hoops Fantasy" in `src/`; add a test that fails if "Hoops Fantasy" appears in `src/` or `public/`
- [ ] 3.2 Manifest, offline page, `public/sw.js` and Android `strings.xml` use the new name; test that `sw.js` and `strings.xml` match `APP_NAME`
- [ ] 3.3 Independence notice in the home page footer and on How to play; verify it renders signed out

## 4. Menu on every page

- [ ] 4.1 `AppNav` in the root layout: bottom tabs under 768 px with safe-area padding, top links above; signed-in, signed-out and admin variants; component-test all three
- [ ] 4.2 `/more` page with How to play, Scoring, Notifications, Account, Add to home screen (hidden when installed) and Sign out, plus Admin for admins; test the admin link visibility
- [ ] 4.3 Remove the ad-hoc link rows from the home page and other pages; verify every page still has a way back to every section
- [ ] 4.4 Accessibility: `nav` landmark, `aria-current`, keyboard order; test that the current page is marked on each section

## 5. How to play

- [ ] 5.1 `/how-to-play` page built from the rules and scoring constants, matching the canvas screen; test that changing `BUDGET` in the test changes the rendered text
- [ ] 5.2 Ending button: Sign in to play (signed out) or Pick my squad (signed in); test both
- [ ] 5.3 First-visit prompt on `/squad` with cookie dismissal, also cleared by visiting How to play; test both paths

## 6. Look

- [ ] 6.1 Design tokens in `globals.css` from design.md, dark-only, `color-scheme: dark`, Barlow Condensed and Inter via `next/font`; update the manifest and viewport `themeColor`
- [ ] 6.2 Restyle squad, picker, results, leagues, league table and leaderboard to the canvas screens
- [ ] 6.3 Restyle sign-in, welcome, account, notifications, scoring, privacy, terms, join, offline and admin pages with the same tokens
- [ ] 6.4 Check contrast of every text and background token pair at 4.5:1 or above, and that touch targets are 44 px or more; record the results in this task

## 7. Check

- [ ] 7.1 Run all tests, typecheck, lint and the build
- [ ] 7.2 Run the app on a phone-sized browser and the Android emulator: pick a full 6-player squad, try an invalid one, read How to play, move between every tab, and compare each screen against the design canvas
