-- Player prices in credits, set by an admin before the season. A player with no row here
-- is unpriced and can't be picked. Unconstrained numeric, so 5.04 is rejected rather than
-- silently rounded to 5.0.

create table player_prices (
  player_id bigint primary key references players (id) on delete cascade,
  price numeric not null
    constraint player_prices_range
    check (price between 4.0 and 15.0 and price * 2 = trunc(price * 2)),
  updated_at timestamptz not null default now()
);

alter table player_prices enable row level security;
create policy "League data is public" on player_prices for select using (true);
