alter table public.market_reports
  add column if not exists options_research jsonb not null default '[]'::jsonb;
