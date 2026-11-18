-- Each player's fantasy points per fixture, and per-round totals.

create table player_fantasy_points (
  id bigint generated always as identity primary key,
  player_id bigint not null references players (id) on delete cascade,
  fixture_id bigint not null references fixtures (id) on delete cascade,
  -- Null when the fixture falls outside every round window.
  round_id bigint references rounds (id) on delete set null,
  points numeric(5, 1) not null,
  -- False while the fixture is live (provisional points) or postponed.
  is_final boolean not null,
  calculated_at timestamptz not null,
  unique (player_id, fixture_id)
);

create index player_fantasy_points_fixture_idx on player_fantasy_points (fixture_id);
create index player_fantasy_points_round_idx on player_fantasy_points (round_id, player_id);

-- A view rather than a table, so corrections flow straight into round totals.
create view player_round_points with (security_invoker = true) as
select
  player_id,
  round_id,
  sum(points) as points,
  count(*)::int as fixtures,
  bool_and(is_final) as is_final
from player_fantasy_points
where round_id is not null
group by player_id, round_id;

alter table player_fantasy_points enable row level security;
create policy "League data is public" on player_fantasy_points for select using (true);
