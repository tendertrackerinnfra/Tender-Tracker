create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.market_reports(id) on delete set null,
  alert_key text not null unique,
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  title text not null,
  reason text not null,
  sector text not null,
  stocks_affected text[] not null default '{}',
  alert_type text not null,
  trigger_value numeric(10, 2) not null,
  threshold_value numeric(10, 2) not null,
  notification_status text not null default 'created' check (notification_status in ('created', 'sent', 'failed', 'duplicate', 'skipped')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  triggered_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists notification_history_priority_idx on public.notification_history(priority, triggered_at desc);
create index if not exists notification_history_report_idx on public.notification_history(report_id);

alter table public.notification_history enable row level security;

drop policy if exists "Service role manages notification history" on public.notification_history;
create policy "Service role manages notification history"
  on public.notification_history for all
  to service_role
  using (true)
  with check (true);
