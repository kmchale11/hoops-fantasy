-- Private mini-leagues, joined with a 6-character invite code. Only members can see a league,
-- its members and its standings. All changes go through the functions below, which act as the
-- signed-in user; the tables are read-only through the API.

create table mini_leagues (
  id bigint generated always as identity primary key,
  name text not null
    constraint mini_leagues_name_length
    check (char_length(name) between 3 and 40 and name = btrim(name)),
  -- Handed to the longest-standing member if the admin leaves or deletes their account.
  admin_user_id uuid not null references profiles (user_id),
  -- No 0/O or 1/I, so codes read aloud or copied by hand still work.
  invite_code text not null unique
    constraint mini_leagues_invite_code_format check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table league_members (
  -- Join order, for handing a league on when two members joined at the same moment.
  id bigint generated always as identity unique,
  league_id bigint not null references mini_leagues (id) on delete cascade,
  user_id uuid not null references profiles (user_id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  -- One membership per user per league.
  primary key (league_id, user_id)
);

create index league_members_user_idx on league_members (user_id);

-- Security definer so policies on league_members can use it without recursing into themselves.
create function is_league_member(p_league bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members where league_id = p_league and user_id = auth.uid())
$$;

alter table mini_leagues enable row level security;
alter table league_members enable row level security;

create policy "Members read their leagues" on mini_leagues
  for select to authenticated using (is_league_member(id));

create policy "Members read their leagues' members" on league_members
  for select to authenticated using (is_league_member(league_id));

revoke all on mini_leagues, league_members from anon, authenticated;
grant select on mini_leagues, league_members to authenticated;

create function new_invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
    end loop;
    exit when not exists (select 1 from mini_leagues where invite_code = code);
  end loop;
  return code;
end
$$;

-- Removes a member. If they were the admin, the longest-standing remaining member takes over,
-- and a league with nobody left is deleted.
create function drop_league_member(p_league bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  successor uuid;
begin
  delete from league_members where league_id = p_league and user_id = p_user;
  if exists (select 1 from mini_leagues where id = p_league and admin_user_id = p_user) then
    select user_id into successor from league_members
     where league_id = p_league order by joined_at, id limit 1;
    if successor is null then
      delete from mini_leagues where id = p_league;
    else
      update mini_leagues set admin_user_id = successor where id = p_league;
    end if;
  end if;
end
$$;

-- Deleting an account (which deletes the profile) takes the user out of every league first,
-- so leagues they ran get a new admin rather than blocking the delete.
create function leave_leagues_on_profile_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  league bigint;
begin
  for league in
    select league_id from league_members where user_id = old.user_id
    union
    select id from mini_leagues where admin_user_id = old.user_id
  loop
    perform drop_league_member(league, old.user_id);
  end loop;
  return old;
end
$$;

create trigger profiles_leave_leagues
  before delete on profiles
  for each row execute function leave_leagues_on_profile_delete();

-- Error codes: HF003 sign-up unfinished, HF010 invalid name, HF011 code not recognised,
-- HF012 already a member, HF013 not a member or not the admin.
create function require_profile()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'Finish signing up before joining leagues' using errcode = 'HF003';
  end if;
  return auth.uid();
end
$$;

create function require_league_admin(p_league bigint)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := require_profile();
begin
  if not exists (select 1 from mini_leagues where id = p_league and admin_user_id = me) then
    raise exception 'Only the league admin can do that' using errcode = 'HF013';
  end if;
  return me;
end
$$;

create function create_league(p_name text)
returns table (id bigint, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
  league mini_leagues;
begin
  if p_name is null or char_length(btrim(p_name)) not between 3 and 40 then
    raise exception 'League names must be 3–40 characters' using errcode = 'HF010';
  end if;
  insert into mini_leagues (name, admin_user_id, invite_code)
  values (btrim(p_name), me, new_invite_code())
  returning * into league;
  insert into league_members (league_id, user_id) values (league.id, me);
  return query select league.id, league.invite_code;
end
$$;

-- Codes are matched ignoring case, spaces and dashes.
create function join_league(p_code text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
  league mini_leagues;
begin
  select * into league from mini_leagues
   where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  if league.id is null then
    raise exception 'That invite code wasn''t recognised. Check it with whoever sent it.' using errcode = 'HF011';
  end if;
  if exists (select 1 from league_members where league_id = league.id and user_id = me) then
    raise exception 'You''re already in %', league.name using errcode = 'HF012';
  end if;
  insert into league_members (league_id, user_id) values (league.id, me);
  return league.id;
end
$$;

create function leave_league(p_league bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_profile();
begin
  if not exists (select 1 from league_members where league_id = p_league and user_id = me) then
    raise exception 'You''re not in that league' using errcode = 'HF013';
  end if;
  perform drop_league_member(p_league, me);
end
$$;

create function remove_league_member(p_league bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_league_admin(p_league);
begin
  if p_user = me then
    raise exception 'To leave your own league, use Leave league' using errcode = 'HF013';
  end if;
  delete from league_members where league_id = p_league and user_id = p_user;
end
$$;

-- The old code stops working at once; members stay in the league.
create function regenerate_invite_code(p_league bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  perform require_league_admin(p_league);
  update mini_leagues set invite_code = new_invite_code() where id = p_league returning invite_code into code;
  return code;
end
$$;

-- Members ranked by season total, ties sharing a rank, with each member's score for p_round.
-- Returns nothing unless the signed-in user is a member.
create function league_standings(p_league bigint, p_round bigint)
returns table (
  rank bigint,
  user_id uuid,
  team_name text,
  manager_name text,
  season_total numeric,
  round_points numeric
)
language sql stable security definer set search_path = public as $$
  select
    rank() over (order by coalesce(t.total, 0) desc),
    m.user_id,
    p.team_name,
    p.manager_name,
    coalesce(t.total, 0),
    coalesce(r.points, 0)
  from league_members m
  join profiles p on p.user_id = m.user_id
  left join (select s.user_id, sum(s.points) as total from user_round_scores s group by s.user_id) t
    on t.user_id = m.user_id
  left join user_round_scores r on r.user_id = m.user_id and r.round_id = p_round
  where m.league_id = p_league and is_league_member(p_league)
  order by 1, lower(p.team_name)
$$;

revoke execute on function drop_league_member(bigint, uuid) from public, anon, authenticated;
revoke execute on function leave_leagues_on_profile_delete() from public, anon, authenticated;
revoke execute on function new_invite_code() from public, anon, authenticated;
revoke execute on function require_profile() from public, anon, authenticated;
revoke execute on function require_league_admin(bigint) from public, anon, authenticated;

revoke execute on function is_league_member(bigint) from public, anon;
revoke execute on function create_league(text) from public, anon;
revoke execute on function join_league(text) from public, anon;
revoke execute on function leave_league(bigint) from public, anon;
revoke execute on function remove_league_member(bigint, uuid) from public, anon;
revoke execute on function regenerate_invite_code(bigint) from public, anon;
revoke execute on function league_standings(bigint, bigint) from public, anon;
grant execute on function is_league_member(bigint) to authenticated;
grant execute on function create_league(text) to authenticated;
grant execute on function join_league(text) to authenticated;
grant execute on function leave_league(bigint) to authenticated;
grant execute on function remove_league_member(bigint, uuid) to authenticated;
grant execute on function regenerate_invite_code(bigint) to authenticated;
grant execute on function league_standings(bigint, bigint) to authenticated;
