## 1. Auth

- [ ] 1.1 Configure Supabase Auth for magic link (1 hour expiry) and Google OAuth
- [ ] 1.2 Sign-in page and auth callback route
- [ ] 1.3 Tests: magic link sign-in, expired link offers a new one

## 2. Profile and consent

- [ ] 2.1 Migration for `profiles(user_id, manager_name, team_name unique, age_confirmed_at, terms_accepted_at, is_admin)`
- [ ] 2.2 Sign-up screen with 18+ and terms checkboxes, blocking squad access until complete
- [ ] 2.3 Row-level security: users read and edit only their own profile
- [ ] 2.4 Tests: blocked without consent, name length rules, duplicate team name

## 3. Account page and deletion

- [ ] 3.1 Account page listing all stored personal fields
- [ ] 3.2 Delete-account flow with confirmation, cascading to squads and memberships
- [ ] 3.3 Test: deleted user vanishes from league tables
