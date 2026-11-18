-- One profile per Supabase Auth user. Created only once the user has confirmed they're 18+
-- and accepted the terms, so a user without a profile hasn't finished signing up.
-- Personal data is kept to the minimum: email lives in auth.users; this holds names and consent.

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  manager_name text not null
    constraint profiles_manager_name_length
    check (char_length(manager_name) between 3 and 30 and manager_name = btrim(manager_name)),
  team_name text not null
    constraint profiles_team_name_length
    check (char_length(team_name) between 3 and 30 and team_name = btrim(team_name)),
  age_confirmed_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Team names are unique ignoring case, so "Moy Valley Ballers" and "moy valley ballers" clash.
create unique index profiles_team_name_unique on profiles (lower(team_name));

alter table profiles enable row level security;

create policy "Users read their own profile" on profiles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users edit their own profile" on profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Users may only change their names. Consent and the admin flag are set by the server,
-- and profiles are created at sign-up and removed with the account, never through the API.
revoke all on profiles from anon, authenticated;
grant select on profiles to authenticated;
grant update (manager_name, team_name) on profiles to authenticated;
