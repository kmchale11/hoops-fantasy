-- Fixtures, per-player box scores and the ingestion run log.

create table fixtures (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  competition_id bigint not null references competitions (id),
  home_team_id bigint not null references teams (id),
  away_team_id bigint not null references teams (id),
  tip_off timestamptz not null,
  status text not null check (status in ('scheduled', 'live', 'final', 'postponed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index fixtures_tip_off_idx on fixtures (tip_off);
create index fixtures_status_idx on fixtures (status);

create table player_game_stats (
  id bigint generated always as identity primary key,
  player_id bigint not null references players (id) on delete cascade,
  fixture_id bigint not null references fixtures (id) on delete cascade,
  minutes integer not null check (minutes between 0 and 60),
  pts integer not null check (pts >= 0),
  reb integer not null check (reb >= 0),
  ast integer not null check (ast >= 0),
  stl integer not null check (stl >= 0),
  blk integer not null check (blk >= 0),
  tov integer not null check (tov >= 0),
  fgm integer not null check (fgm >= 0),
  fga integer not null check (fga >= fgm),
  ftm integer not null check (ftm >= 0),
  fta integer not null check (fta >= ftm),
  -- Set whenever an existing stat line's values change after first being stored.
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, fixture_id)
);

create index player_game_stats_fixture_idx on player_game_stats (fixture_id);

create table ingestion_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  counts jsonb not null default '{}'::jsonb,
  error text
);

create index ingestion_runs_started_at_idx on ingestion_runs (started_at desc);

alter table fixtures enable row level security;
alter table player_game_stats enable row level security;
-- ingestion_runs gets RLS with no policies: service role only.
alter table ingestion_runs enable row level security;

create policy "League data is public" on fixtures for select using (true);
create policy "League data is public" on player_game_stats for select using (true);
