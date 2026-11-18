## 1. Auth

- [x] 1.1 Configure Supabase Auth for magic link (1 hour expiry) and Google OAuth
- [x] 1.2 Sign-in page and auth callback route
- [x] 1.3 Tests: magic link sign-in, expired link offers a new one

## 2. Profile and consent

- [x] 2.1 Migration for `profiles(user_id, manager_name, team_name unique, age_confirmed_at, terms_accepted_at, is_admin)`
- [x] 2.2 Sign-up screen with 18+ and terms checkboxes, blocking squad access until complete
- [x] 2.3 Row-level security: users read and edit only their own profile
- [x] 2.4 Tests: blocked without consent, name length rules, duplicate team name

## 3. Account page and deletion

- [x] 3.1 Account page listing all stored personal fields
- [x] 3.2 Delete-account flow with confirmation that deletes the auth user and cascades to the profile (squads and memberships cascade from their own changes: `add-squad-selection` 3.5, `add-mini-leagues` 2.6)
- [x] 3.3 Test: deleted user's profile and personal data are gone and they are signed out

## 4. Admin role

- [x] 4.1 CSV import requires a signed-in user with `profiles.is_admin`; remove `ADMIN_TOKEN`
- [x] 4.2 Tests: admin can import, signed-out and non-admin users are rejected
