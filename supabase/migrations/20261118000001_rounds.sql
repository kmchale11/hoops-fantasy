-- Rounds are named date windows (e.g. Round 7: Fri–Sun). A fixture belongs to the round
-- its tip-off falls in. Also used by squad selection for deadlines.

create table rounds (
  id bigint generated always as identity primary key,
  number integer not null unique check (number > 0),
  name text not null,
  starts_at timestamptz not null,
  -- Exclusive: a tip-off exactly at ends_at belongs to the next round.
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Windows can't overlap, so every fixture is in at most one round.
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);

-- Fixture-to-round assignment. A fixture outside every window (e.g. a postponed game
-- moved to a gap between rounds) has no row here and counts towards no round.
create view fixture_rounds with (security_invoker = true) as
select f.id as fixture_id, r.id as round_id
from fixtures f
join rounds r on f.tip_off >= r.starts_at and f.tip_off < r.ends_at;

alter table rounds enable row level security;
create policy "League data is public" on rounds for select using (true);
