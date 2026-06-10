alter table public.market_reports
  add column if not exists market_mood_details jsonb not null default '{}'::jsonb;

alter table public.market_reports
  drop constraint if exists market_reports_market_mood_check;

alter table public.market_reports
  add constraint market_reports_market_mood_check
  check (market_mood in ('Bullish', 'Bearish', 'Sideways'));

create table if not exists public.sector_scores (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.market_reports(id) on delete cascade,
  report_date date not null,
  session text not null check (session in ('morning', 'closing')),
  rank integer not null,
  sector text not null,
  symbol text not null,
  sector_score numeric(6, 2) not null,
  relative_strength_score numeric(6, 2) not null,
  momentum_score numeric(6, 2) not null,
  trend_score numeric(6, 2) not null,
  one_day_change_percent numeric(8, 2) not null,
  five_day_change_percent numeric(8, 2) not null,
  twenty_day_change_percent numeric(8, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_scores (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.market_reports(id) on delete cascade,
  report_date date not null,
  session text not null check (session in ('morning', 'closing')),
  rank integer not null,
  symbol text not null,
  name text not null,
  sector text not null,
  total_score numeric(6, 2) not null,
  relative_strength_score numeric(6, 2) not null,
  volume_spike_score numeric(6, 2) not null,
  breakout_score numeric(6, 2) not null,
  trend_strength_score numeric(6, 2) not null,
  news_impact_score numeric(6, 2) not null,
  one_day_change_percent numeric(8, 2) not null,
  five_day_change_percent numeric(8, 2) not null,
  twenty_day_change_percent numeric(8, 2) not null,
  volume_ratio numeric(8, 2) not null,
  breakout_percent numeric(8, 2) not null,
  research_note text not null,
  created_at timestamptz not null default now()
);

create index if not exists sector_scores_report_idx on public.sector_scores(report_id, rank);
create index if not exists stock_scores_report_idx on public.stock_scores(report_id, rank);
create index if not exists stock_scores_symbol_idx on public.stock_scores(symbol, report_date desc);

alter table public.sector_scores enable row level security;
alter table public.stock_scores enable row level security;

drop policy if exists "Sector scores are readable by anon users" on public.sector_scores;
create policy "Sector scores are readable by anon users"
  on public.sector_scores for select
  to anon
  using (true);

drop policy if exists "Stock scores are readable by anon users" on public.stock_scores;
create policy "Stock scores are readable by anon users"
  on public.stock_scores for select
  to anon
  using (true);

drop policy if exists "Service role manages sector scores" on public.sector_scores;
create policy "Service role manages sector scores"
  on public.sector_scores for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manages stock scores" on public.stock_scores;
create policy "Service role manages stock scores"
  on public.stock_scores for all
  to service_role
  using (true)
  with check (true);
