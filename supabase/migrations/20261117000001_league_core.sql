-- Competitions, teams, players and player team history.
-- Every synced table is keyed by the feed's external_id so ingestion can upsert safely.

create table competitions (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  name text not null,
  season text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teams (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  competition_id bigint not null references competitions (id),
  name text not null,
  short_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table players (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  full_name text not null,
  -- Nullable and admin-editable: the feed may not supply positions.
  position text,
  current_team_id bigint references teams (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_current_team_idx on players (current_team_id);

create table player_team_history (
  id bigint generated always as identity primary key,
  player_id bigint not null references players (id) on delete cascade,
  team_id bigint not null references teams (id),
  started_on date not null,
  ended_on date,
  check (ended_on is null or ended_on >= started_on)
);

-- A player can only have one open spell at a time.
create unique index player_team_history_one_open_spell
  on player_team_history (player_id)
  where ended_on is null;

-- League data is public; only the service role (which bypasses RLS) writes it.
alter table competitions enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table player_team_history enable row level security;

create policy "League data is public" on competitions for select using (true);
create policy "League data is public" on teams for select using (true);
create policy "League data is public" on players for select using (true);
create policy "League data is public" on player_team_history for select using (true);
