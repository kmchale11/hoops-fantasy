-- Squads: one per user per round, saved only through save_squad(), which checks the squad
-- rules and the round deadline in one transaction. Carry-forward and user scores live here too.

-- A round locks at its first tip-off (ignoring postponed games), or at its start if no
-- games are scheduled yet. It's over once every game in it is final, or its window ends.
create view round_deadlines with (security_invoker = true) as
select
  r.id as round_id,
  r.number,
  r.name,
  r.ends_at,
  coalesce(min(f.tip_off) filter (where f.status <> 'postponed'), r.starts_at) as deadline,
  coalesce(
    count(f.id) filter (where f.status <> 'postponed') > 0
      and bool_and(f.status = 'final') filter (where f.status <> 'postponed'),
    false
  ) as games_finished
from rounds r
left join fixtures f on f.tip_off >= r.starts_at and f.tip_off < r.ends_at
group by r.id;

-- The round squads are being picked for (the next one to lock), and the round in progress,
-- if any. No changes are allowed while a round is in progress.
create function squad_window(p_at timestamptz)
returns table (open_round_id bigint, locked_round_id bigint)
language sql stable set search_path = public as $$
  select
    (select round_id from round_deadlines where deadline > p_at order by deadline limit 1),
    (select round_id from round_deadlines
      where deadline <= p_at and p_at < ends_at and not games_finished
      order by deadline limit 1)
$$;

create table squads (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (user_id) on delete cascade,
  round_id bigint not null references rounds (id) on delete cascade,
  captain_player_id bigint not null references players (id),
  -- True when copied from the user's previous squad as the round locked.
  carried_forward boolean not null default false,
  saved_at timestamptz not null,
  unique (user_id, round_id)
);

create index squads_round_idx on squads (round_id);

create table squad_players (
  squad_id bigint not null references squads (id) on delete cascade,
  player_id bigint not null references players (id),
  price_at_pick numeric not null,
  primary key (squad_id, player_id)
);

alter table squads enable row level security;
alter table squad_players enable row level security;

create policy "Users read their own squads" on squads
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own squad players" on squad_players
  for select to authenticated
  using (exists (select 1 from squads s where s.id = squad_id and s.user_id = (select auth.uid())));

-- Read-only through the API: save_squad() is the only way in.
revoke all on squads, squad_players from anon, authenticated;
grant select on squads, squad_players to authenticated;

-- The same rules, messages and order as src/squads/rules.ts.
create function squad_rule_errors(p_players bigint[], p_captain bigint)
returns text[] language plpgsql stable set search_path = public as $$
declare
  errors text[] := '{}';
  picked int;
  total numeric;
  r record;
begin
  select count(distinct x) into picked from unnest(p_players) x;
  if picked < coalesce(cardinality(p_players), 0) then
    errors := errors || 'You''ve picked the same player twice'::text;
  end if;
  if exists (select 1 from unnest(p_players) x where not exists (select 1 from players p where p.id = x)) then
    errors := errors || 'One of those players doesn''t exist'::text;
  end if;

  for r in
    select p.full_name
      from (select x, min(o) as o from unnest(p_players) with ordinality u (x, o) group by x) u
      join players p on p.id = u.x
      left join player_prices pp on pp.player_id = p.id
     where p.current_team_id is null or pp.price is null
     order by u.o
  loop
    errors := errors || format('%s isn''t available to pick yet', r.full_name);
  end loop;

  if picked <> 8 then
    errors := errors || format('Pick 8 players (you have %s)', picked);
  end if;

  select coalesce(sum(pp.price), 0) into total
    from (select distinct x from unnest(p_players) x) u
    join player_prices pp on pp.player_id = u.x;
  if total > 100 then
    errors := errors || format('Over budget by %s credits', to_char(total - 100, 'FM9990.0'));
  end if;

  for r in
    select t.name
      from (select distinct x from unnest(p_players) x) u
      join players p on p.id = u.x
      join teams t on t.id = p.current_team_id
     group by t.id, t.name
    having count(*) > 3
     order by t.name collate "C"
  loop
    errors := errors || format('Too many players from %s (3 max)', r.name);
  end loop;

  if p_captain is null or not (p_captain = any (p_players)) then
    errors := errors || 'Pick a captain from your squad'::text;
  end if;
  return errors;
end
$$;

-- Saves a user's squad for the open round. Error codes: HF001 broken rules (one message per
-- line), HF002 a round is in progress, HF003 nothing to save to or sign-up unfinished.
create function save_squad_at(p_user uuid, p_players bigint[], p_captain bigint, p_at timestamptz)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  w record;
  locked record;
  errors text[];
  squad bigint;
begin
  if p_user is null or not exists (select 1 from profiles where user_id = p_user) then
    raise exception 'Finish signing up before picking a squad' using errcode = 'HF003';
  end if;

  select * into w from squad_window(p_at);
  if w.locked_round_id is not null then
    select name, deadline into locked from round_deadlines where round_id = w.locked_round_id;
    raise exception '% locked at %. You can make changes once its last game ends.',
      locked.name, to_char(locked.deadline at time zone 'Europe/Dublin', 'Dy FMDD Mon, HH24:MI')
      using errcode = 'HF002';
  end if;
  if w.open_round_id is null then
    raise exception 'There''s no upcoming round to pick a squad for yet' using errcode = 'HF003';
  end if;

  errors := squad_rule_errors(p_players, p_captain);
  if cardinality(errors) > 0 then
    raise exception using message = array_to_string(errors, E'\n'), errcode = 'HF001';
  end if;

  insert into squads (user_id, round_id, captain_player_id, carried_forward, saved_at)
  values (p_user, w.open_round_id, p_captain, false, p_at)
  on conflict (user_id, round_id) do update
    set captain_player_id = excluded.captain_player_id, carried_forward = false, saved_at = excluded.saved_at
  returning id into squad;

  delete from squad_players where squad_id = squad;
  insert into squad_players (squad_id, player_id, price_at_pick)
  select squad, pp.player_id, pp.price from player_prices pp where pp.player_id = any (p_players);
  return squad;
end
$$;

-- What the app and API call: always the signed-in user, always the current time.
create function save_squad(p_players bigint[], p_captain bigint)
returns bigint language sql security definer set search_path = public as $$
  select save_squad_at(auth.uid(), p_players, p_captain, now())
$$;

-- Copies each user's latest squad into every locked round they have no squad for. Only ever
-- copies forward, so a mid-season joiner gets nothing for rounds before their first squad.
create function carry_forward_squads(p_at timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  before_count int;
  after_count int;
begin
  select count(*) into before_count from squads;
  for r in select round_id, number from round_deadlines where deadline <= p_at order by number loop
    with latest as (
      select distinct on (s.user_id) s.id, s.user_id, s.captain_player_id
        from squads s join rounds sr on sr.id = s.round_id
       where sr.number < r.number
         and not exists (select 1 from squads x where x.user_id = s.user_id and x.round_id = r.round_id)
       order by s.user_id, sr.number desc
    ), copied as (
      insert into squads (user_id, round_id, captain_player_id, carried_forward, saved_at)
      select user_id, r.round_id, captain_player_id, true, p_at from latest
      returning id, user_id
    )
    insert into squad_players (squad_id, player_id, price_at_pick)
    select c.id, sp.player_id, sp.price_at_pick
      from copied c
      join latest l on l.user_id = c.user_id
      join squad_players sp on sp.squad_id = l.id;
  end loop;
  select count(*) into after_count from squads;
  return after_count - before_count;
end
$$;

-- Each user's points per round: their squad players' round points with the captain doubled.
-- Refreshed after every ingestion run and round lock; season totals sum it.
create materialized view user_round_scores as
select
  s.user_id,
  s.round_id,
  sum(coalesce(rp.points, 0) * case when sp.player_id = s.captain_player_id then 2 else 1 end) as points
from squads s
join squad_players sp on sp.squad_id = s.id
left join player_round_points rp on rp.player_id = sp.player_id and rp.round_id = s.round_id
group by s.user_id, s.round_id;

create unique index user_round_scores_key on user_round_scores (user_id, round_id);

-- Scores are public to signed-in users so leagues can show them; squads stay private.
revoke all on user_round_scores from anon, authenticated;
grant select on user_round_scores to authenticated;

create function refresh_user_round_scores()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view user_round_scores;
end
$$;

revoke execute on function save_squad_at(uuid, bigint[], bigint, timestamptz) from public, anon, authenticated;
revoke execute on function carry_forward_squads(timestamptz) from public, anon, authenticated;
revoke execute on function refresh_user_round_scores() from public, anon, authenticated;
revoke execute on function save_squad(bigint[], bigint) from public, anon;
grant execute on function save_squad(bigint[], bigint) to authenticated;
