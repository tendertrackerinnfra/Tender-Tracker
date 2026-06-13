alter table public.market_reports
  drop constraint if exists market_reports_session_check;

alter table public.market_reports
  add constraint market_reports_session_check
  check (session in ('morning', 'midday', 'intraday', 'closing'));

alter table public.market_reports
  add column if not exists catalysts jsonb not null default '{}'::jsonb;

alter table public.sector_scores
  drop constraint if exists sector_scores_session_check;

alter table public.sector_scores
  add constraint sector_scores_session_check
  check (session in ('morning', 'midday', 'intraday', 'closing'));

alter table public.stock_scores
  drop constraint if exists stock_scores_session_check;

alter table public.stock_scores
  add constraint stock_scores_session_check
  check (session in ('morning', 'midday', 'intraday', 'closing'));

alter table public.stock_scores
  add column if not exists attention_score numeric(6, 2) not null default 0,
  add column if not exists setup_quality_score numeric(6, 2) not null default 0,
  add column if not exists setup_direction text not null default 'neutral-watch',
  add column if not exists reference_price numeric(12, 2) not null default 0,
  add column if not exists support_zone_low numeric(12, 2) not null default 0,
  add column if not exists support_zone_high numeric(12, 2) not null default 0,
  add column if not exists resistance_zone_low numeric(12, 2) not null default 0,
  add column if not exists resistance_zone_high numeric(12, 2) not null default 0,
  add column if not exists historical_edge_score numeric(6, 2) not null default 0,
  add column if not exists risk_note text not null default 'Research-only risk context.',
  add column if not exists catalyst_summary text not null default 'Catalyst tone unavailable.';

create index if not exists stock_scores_setup_idx on public.stock_scores(setup_quality_score desc, attention_score desc);
