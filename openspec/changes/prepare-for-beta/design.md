## Context

Everything in the MVP plan is built: ingestion, scoring, accounts, squads, leagues, and most of the mobile app. Before the first friends-and-family test, Kevin wants five things changed (see proposal.md). The visual reference is the "Hoops Fantasy app screens" design canvas, which already shows the 6-player squad, the player picker, results, league table, leaderboard, More menu and How to play page.

Today: squad rules live in `src/squads/rules.ts` (`SQUAD_SIZE = 8`, `BUDGET = 100`, `MAX_PER_TEAM = 3`) and are repeated in the `squad_rule_errors` SQL function in `20261120000002_squads.sql`, which returns the same messages in the same order. `players.position` is nullable free text. The name lives in `src/lib/app-identity.ts` `APP_NAME`, but 27 files also hard-code "Hoops Fantasy". `globals.css` follows the system light/dark setting with a green accent. Pages link to each other only from the home page.

## Goals / Non-Goals

**Goals:** squad rules identical in TypeScript and SQL; one place for the name; one menu component; the canvas look on every page; a rules page that can't go out of date.

**Non-Goals:** storing which slot each player is in; a design-system package; light mode; changing the native app ID or domain.

## Decisions

### Positions are a fixed set, checked as counts
`players.position` becomes a check-constrained value of `'G' | 'F' | 'C'` or null (a migration maps any existing values and nulls the rest). The squad is valid when, among its 6 players, there are at least 2 G, at least 2 F, at least 1 C and at most 1 player without a position. With exactly 6 players, those minimums leave exactly one spare, which is the flex. This is equivalent to filling the slots, and avoids storing a slot per player.

- **Why not store a slot column?** It adds a way for the slots and positions to disagree, and a re-shuffle every time a player changes position. Display order is derived instead: the first two guards (by price, then name) fill the guard slots, and so on, and whoever is left over is shown as Flex.
- **Error messages**, in this fixed order after the existing ones: `Pick 2 guards (you have N)`, `Pick 2 forwards (you have N)`, `Pick a centre`, `Only one player without a position can be picked (in the flex spot)`. Both rule implementations produce them identically, and a shared test runs the same cases against both, as now.

### Constants
`SQUAD_SIZE = 6`, `BUDGET = 60`, `MAX_PER_TEAM = 2`, plus `SLOTS = { G: 2, F: 2, C: 1, FLEX: 1 }` in `rules.ts`. A new migration replaces `squad_rule_errors` with the same values. A test asserts that the SQL constants equal the TypeScript ones by calling the function with boundary squads.

### Existing squads
The migration deletes squads for rounds that haven't locked yet, plus their players, because none can be valid under the new rules. Locked rounds keep their squads and scores as history. There is no production data yet, so in practice this only clears test squads; the migration notes this explicitly so it isn't copied for a live season.

### Picking by slot
The squad builder shows four groups. Tapping an empty slot opens the picker filtered to that slot's positions (Flex: all, including unpositioned). Unavailable rows stay visible but dimmed with a reason: over budget by X, club full, or already in squad. That uses the existing rules module, so it can't disagree with the save.

### One name
`APP_NAME = "Irish Basketball Fantasy"` and `APP_SHORT_NAME = "IB Fantasy"` for the home-screen label. Page metadata uses a root `title.template` (`%s · Irish Basketball Fantasy`) so pages only set their own part. The manifest, offline page and How to play page import the constant. `public/sw.js` and the Android `strings.xml` can't import it, so a test fails if either disagrees with `APP_NAME`. `APP_ID` and `PRODUCTION_URL` stay as they are (`add-mobile-app` open question).

### Menu
One `AppNav` server component in the root layout reads the session and admin flag once. It renders a `<nav aria-label="Main">` of links with `aria-current="page"`, as a fixed bottom bar under 768 px (padded by `env(safe-area-inset-bottom)`, with page content padded to match) and a top bar above that. Five tabs (Squad, Results, Leagues, Leaderboard, More) for signed-in users; Home, How to play and Sign in for visitors. `/more` is a new page. Pages remove their own link rows.

### Look
Design tokens in `globals.css` take the canvas values: background `#10141C`, surface `#161B27`, raised `#1A2030`, border `#2A3245`, text `#F2F4F7`, muted `#9AA3B2`, accent `#FF6B1A`, accent text `#FF8A47`, danger `#FF9B8F`, success `#7FD8A6`. Headings use Barlow Condensed 700–800, uppercase; body text uses Inter, both loaded with `next/font/google` so they're self-hosted. The app is dark-only for the beta: the `prefers-color-scheme` light branch is removed and `color-scheme: dark` is set. The manifest and viewport `themeColor` become `#10141C`. Muted text on surfaces is checked at 4.5:1 or above.

### How to play
`/how-to-play` is a server page that renders from `SLOTS`, `BUDGET`, `MAX_PER_TEAM`, the captain multiplier and `SCORING_WEIGHTS`, never typed-in numbers. The first-visit prompt on `/squad` is dismissed per device with a cookie (it isn't worth a database column); opening How to play also sets it.

## Risks / Trade-offs

- **60 credits with prices from 4.0 to 15.0** may be too tight or too loose once real prices are set → it's one constant; revisit after the beta.
- **Real feed positions may be missing or finer-grained** (PG, SG and so on) → the ingestion adapter maps feed positions to G, F or C, and null otherwise; admins fix the rest.
- **Dark-only** may not suit everyone → acceptable for a beta; tokens make a light theme a later, contained change.
- **Overlap with `add-mobile-app`** (in progress) → this change touches `layout.tsx` and the manifest, which that change also edits. Build this on top of the latest `main` and keep its offline banner, install offer and native links in the layout.

## Migration Plan

One migration (positions constraint and mapping, new `squad_rule_errors`, clearing unlocked squads), then the code. There's no production deployment yet, so no rollback plan is needed beyond reverting the commit.

## Open Questions

- Short name under the home-screen icon: "IB Fantasy" is a placeholder. iOS cuts off at about 12 characters.
