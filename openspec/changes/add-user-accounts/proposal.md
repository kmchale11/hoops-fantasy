## Why

Players need an account to save a squad and join leagues. Sign-up must be quick on a phone, collect as little personal data as possible, and confirm users are adults.

## What Changes

- Add email magic-link and Google sign-in.
- Require an 18+ confirmation and acceptance of terms at sign-up.
- Add a public display name (manager name) and team name.
- Let users delete their account and all their data.

## Out of Scope

- Password-based login.
- Social features (friends, messaging).
- Admin user management screens beyond a role flag.

## Capabilities

### New Capabilities
- `user-accounts`: sign-up, sign-in, profile and account deletion.

## Impact

- Supabase Auth configuration and a `profiles` table.
- Admin role flag used by `add-stats-ingestion`'s CSV import.
