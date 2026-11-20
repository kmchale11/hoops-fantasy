-- Squads of 6 picked by position: 2 guards, 2 forwards, 1 centre and 1 flex player of any
-- position (or none), within 60 credits and at most 2 from one club. The rules and messages
-- match src/squads/rules.ts exactly.

-- Positions are Guard, Forward or Centre, or unknown. Map what's there; anything else is unknown.
update players set position = case
  when upper(trim(position)) in ('G', 'PG', 'SG', 'GUARD', 'POINT GUARD', 'SHOOTING GUARD') then 'G'
  when upper(trim(position)) in ('F', 'SF', 'PF', 'FORWARD', 'SMALL FORWARD', 'POWER FORWARD') then 'F'
  when upper(trim(position)) in ('C', 'CENTER', 'CENTRE') then 'C'
end
where position is not null;

alter table players add constraint players_position check (position in ('G', 'F', 'C'));

create or replace function squad_rule_errors(p_players bigint[], p_captain bigint)
returns text[] language plpgsql stable set search_path = public as $$
declare
  errors text[] := '{}';
  picked int;
  total numeric;
  guards int;
  forwards int;
  centres int;
  unpositioned int;
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

  if picked <> 6 then
    errors := errors || format('Pick 6 players (you have %s)', picked);
  end if;

  select coalesce(sum(pp.price), 0) into total
    from (select distinct x from unnest(p_players) x) u
    join player_prices pp on pp.player_id = u.x;
  if total > 60 then
    errors := errors || format('Over budget by %s credits', to_char(total - 60, 'FM9990.0'));
  end if;

  for r in
    select t.name
      from (select distinct x from unnest(p_players) x) u
      join players p on p.id = u.x
      join teams t on t.id = p.current_team_id
     group by t.id, t.name
    having count(*) > 2
     order by t.name collate "C"
  loop
    errors := errors || format('Too many players from %s (2 max)', r.name);
  end loop;

  if p_captain is null or not (p_captain = any (p_players)) then
    errors := errors || 'Pick a captain from your squad'::text;
  end if;

  -- 2 guards, 2 forwards and a centre; the sixth player, of any position or none, is the flex.
  select count(*) filter (where p.position = 'G'), count(*) filter (where p.position = 'F'),
         count(*) filter (where p.position = 'C'), count(*) filter (where p.position is null)
    into guards, forwards, centres, unpositioned
    from (select distinct x from unnest(p_players) x) u
    join players p on p.id = u.x;
  if guards < 2 then
    errors := errors || format('Pick 2 guards (you have %s)', guards);
  end if;
  if forwards < 2 then
    errors := errors || format('Pick 2 forwards (you have %s)', forwards);
  end if;
  if centres < 1 then
    errors := errors || 'Pick a centre'::text;
  end if;
  if unpositioned > 1 then
    errors := errors || 'Only one player without a position can be picked (in the flex spot)'::text;
  end if;
  return errors;
end
$$;

-- PRE-LAUNCH ONLY: no squad for a round that hasn't locked can meet the new rules, and the only
-- squads that exist are test data. Locked rounds keep their squads and scores as history.
-- Don't copy this into a migration for a live season; let users re-pick instead.
delete from squads
 where round_id in (select round_id from round_deadlines where deadline > now());
select refresh_user_round_scores();
