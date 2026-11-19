-- Push notifications: the devices each user has allowed notifications on, which kinds they
-- want, and a record of every notification sent so none is ever sent twice.

-- One row per browser or phone. Web Push subscriptions carry an endpoint URL and keys; native
-- apps carry a Firebase Cloud Messaging token.
create table push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (user_id) on delete cascade,
  kind text not null check (kind in ('web', 'fcm')),
  endpoint text not null unique,
  web_keys jsonb,
  platform text not null check (platform in ('web', 'ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_web_keys
    check ((kind = 'web') = (web_keys is not null and web_keys ? 'p256dh' and web_keys ? 'auth'))
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

-- A row with enabled_at set means the user turned notifications on. Both kinds default on.
create table notification_preferences (
  user_id uuid primary key references profiles (user_id) on delete cascade,
  enabled_at timestamptz,
  deadline_reminders boolean not null default true,
  round_results boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Written just before each send. The unique key is the at-most-once guarantee; including
-- lock_at means a moved deadline gets fresh reminders while the old ones can't repeat.
create table notifications_sent (
  subscription_id bigint not null references push_subscriptions (id) on delete cascade,
  kind text not null check (kind in ('deadline_24h', 'deadline_1h', 'results')),
  round_id bigint not null references rounds (id) on delete cascade,
  lock_at timestamptz not null,
  sent_at timestamptz not null,
  primary key (subscription_id, kind, round_id, lock_at)
);

alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table notifications_sent enable row level security;

create policy "Users read their own devices" on push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users remove their own devices" on push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own notification settings" on notification_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own notification settings" on notification_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own notification settings" on notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Devices are added through register_push_subscription(). notifications_sent is server-only.
revoke all on push_subscriptions, notification_preferences, notifications_sent from anon, authenticated;
grant select, delete on push_subscriptions to authenticated;
grant select, insert, update on notification_preferences to authenticated;

-- Adds or refreshes this device for the signed-in user. A browser that someone else used
-- before moves to whoever is signed in now, so a shared device never notifies the old user.
create function register_push_subscription(p_kind text, p_endpoint text, p_web_keys jsonb, p_platform text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  id bigint;
begin
  if me is null or not exists (select 1 from profiles where user_id = me) then
    raise exception 'Finish signing up before turning on notifications' using errcode = 'HF003';
  end if;
  insert into push_subscriptions (user_id, kind, endpoint, web_keys, platform)
  values (me, p_kind, p_endpoint, p_web_keys, p_platform)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, kind = excluded.kind, web_keys = excluded.web_keys,
        platform = excluded.platform, last_seen_at = now()
  returning push_subscriptions.id into id;
  return id;
end
$$;

revoke execute on function register_push_subscription(text, text, jsonb, text) from public, anon;
grant execute on function register_push_subscription(text, text, jsonb, text) to authenticated;
