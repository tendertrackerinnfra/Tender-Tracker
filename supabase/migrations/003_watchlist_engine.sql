create table if not exists public.watchlist_stocks (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  is_tracked boolean not null default true,
  trend_score numeric(6, 2) not null default 0,
  momentum_score numeric(6, 2) not null default 0,
  relative_strength_score numeric(6, 2) not null default 0,
  volume_score numeric(6, 2) not null default 0,
  health_score numeric(6, 2) not null default 0,
  one_day_change_percent numeric(8, 2) not null default 0,
  five_day_change_percent numeric(8, 2) not null default 0,
  twenty_day_change_percent numeric(8, 2) not null default 0,
  volume_ratio numeric(8, 2) not null default 0,
  latest_close numeric(12, 2) not null default 0,
  research_note text not null default 'Research-only watchlist tracking.',
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlist_stocks_health_idx on public.watchlist_stocks(health_score desc);
create index if not exists watchlist_stocks_tracked_idx on public.watchlist_stocks(is_tracked, updated_at desc);

alter table public.watchlist_stocks enable row level security;

drop policy if exists "Watchlist stocks are readable by anon users" on public.watchlist_stocks;
create policy "Watchlist stocks are readable by anon users"
  on public.watchlist_stocks for select
  to anon
  using (true);

drop policy if exists "Service role manages watchlist stocks" on public.watchlist_stocks;
create policy "Service role manages watchlist stocks"
  on public.watchlist_stocks for all
  to service_role
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.watchlist_stocks;
exception
  when duplicate_object then null;
end $$;
