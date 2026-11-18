-- The parts of a Supabase database that migrations rely on but that Supabase itself provides:
-- the auth schema, auth.uid() and the API roles. Loaded into PGlite before the migrations.
-- Mirrors Supabase closely enough for row-level security tests; it is not a full copy.

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- Supabase reads the signed-in user's ID from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
-- Like Supabase, new public tables are fully granted to the API roles; RLS does the gating.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
