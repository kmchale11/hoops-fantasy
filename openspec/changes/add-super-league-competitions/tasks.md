# Tasks

## 1. Competitions and rounds

- [ ] 1.1 Migration: `competitions.slug`, `short_name`, `gender`, `season_start_week`; create the Men's and Women's Super League competitions; mark the mock competition `slug = 'mock'`; test that both exist and the mock one is hidden unless `FEED_SOURCE=mock`
- [ ] 1.2 Migration: `rounds.competition_id`, unique per competition, per-competition exclusion constraint with `btree_gist`, and `fixture_rounds` joined on competition; test that both competitions can have "Week 8" on the same weekend and that rounds in one competition still can't overlap
- [ ] 1.3 `generate_rounds(competition)` for Monday–Monday Irish-time weeks with fixtures, named from `season_start_week`; tests for a skipped cup week, the clocks changing in October, and that locked rounds are never moved or renumbered
- [ ] 1.4 Per-competition deadlines and carry-forward; test the same-weekend case from the competitions spec (women locked at 15:00, men open)

## 2. Squads, scores and leaderboards

- [ ] 2.1 Add the competition check to `squad_rule_errors` and `rules.ts`, with the same message in both; run the shared rule cases against both
- [ ] 2.2 Round scores, season totals and the leaderboard per competition; test that a user's men's and women's totals never mix
- [ ] 2.3 Start-from-next-open-round behaviour; test a user joining in week 8 of a season that started in week 1

## 3. Mini-leagues

- [ ] 3.1 Migration: `mini_leagues.competition_id`, with existing leagues set to men's; create a league for the current competition; test that a women's league table uses only women's scores
- [ ] 3.2 Joining by code switches to the league's competition, and the invite text names the competition; test a member with no squad in that competition shows 0 and a prompt

## 4. Switcher

- [ ] 4.1 Competition cookie with `?c=` override and the selection rules in design.md; tests for one-squad users, new users and the override
- [ ] 4.2 Segmented switcher on Squad, Results, Leagues and Leaderboard, in the `prepare-for-beta` style; verify at 390 px and with a keyboard
- [ ] 4.3 First-visit chooser (Men's, Women's or both); test that it shows once per device

## 5. Admin season setup

- [ ] 5.1 `ManualFeedAdapter` and `FEED_SOURCE=manual`: the cron route skips the sync but still locks rounds, carries forward and notifies; test that manual data is never overwritten
- [ ] 5.2 Teams, players and fixtures CSV imports per competition, all-or-nothing, with row errors and closest-match suggestions; tests for each scenario in the season-data-entry spec
- [ ] 5.3 Optional `price` column in `players.csv`, using the existing price rules
- [ ] 5.4 Fixture editing (postpone, reschedule, correct teams), regenerating rounds; tests for both fixture-editing scenarios
- [ ] 5.5 Player editing (add, set position, change team in the same competition, mark as no longer playing); test the leaves-mid-season scenario
- [ ] 5.6 Box-score upload scores the fixture immediately and rejects players from other teams; test the wrong-team scenario
- [ ] 5.7 Results checklist with a count on the Admin menu item; test the Sunday-night scenario
- [ ] 5.8 `admin_changes` log written by every admin action, with the last 50 shown; test that each admin action writes one entry

## 6. Notifications

- [ ] 6.1 Reminder and results text names the competition, sent only for competitions the user has a squad in; test a two-competition user gets both sets and a one-competition user gets one

## 7. Real season data (needs Kevin)

- [ ] 7.1 Check `data/2026-27/mens-teams.csv` and `womens-teams.csv` against Basketball Ireland's current team names, and fix short names if clubs use different ones
- [ ] 7.2 Gather both leagues' remaining fixtures from Basketball Ireland's Fixtures & Results page into `fixtures.csv`
- [ ] 7.3 Gather each club's current roster with positions into `players.csv`, from club pages or the Swish All Hoops app
- [ ] 7.4 Set prices for both competitions

## 8. Check

- [ ] 8.1 Run all tests, typecheck, lint and the build
- [ ] 8.2 With `FEED_SOURCE=manual` locally, import the real teams, players and fixtures for both competitions, pick a squad in each, upload one real box score per competition, and check scores, both leaderboards and a women's mini-league
