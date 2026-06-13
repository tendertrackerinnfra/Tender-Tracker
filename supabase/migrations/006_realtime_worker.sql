create table if not exists public.realtime_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  snapshot_at timestamptz not null,
  market_bias text not null,
  market_breadth jsonb not null default '{}'::jsonb,
  sector_rotation jsonb not null default '[]'::jsonb,
  attention_scores jsonb not null default '[]'::jsonb,
  options_research jsonb not null default '[]'::jsonb,
  option_strike_potential jsonb not null default '[]'::jsonb,
  oi_buildup jsonb not null default '[]'::jsonb,
  watchlist jsonb not null default '[]'::jsonb,
  health jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.realtime_worker_health (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null unique,
  status text not null check (status in ('starting', 'sleeping', 'running', 'healthy', 'degraded', 'failed', 'stopped')),
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists realtime_market_snapshots_created_idx
  on public.realtime_market_snapshots(created_at desc);

create index if not exists realtime_market_snapshots_bias_idx
  on public.realtime_market_snapshots(market_bias, snapshot_at desc);

alter table public.realtime_market_snapshots enable row level security;
alter table public.realtime_worker_health enable row level security;

create policy "Realtime snapshots are readable by anon users"
  on public.realtime_market_snapshots for select
  to anon
  using (true);

create policy "Service role manages realtime snapshots"
  on public.realtime_market_snapshots for all
  to service_role
  using (true)
  with check (true);

create policy "Realtime worker health is readable by anon users"
  on public.realtime_worker_health for select
  to anon
  using (true);

create policy "Service role manages realtime worker health"
  on public.realtime_worker_health for all
  to service_role
  using (true)
  with check (true);
