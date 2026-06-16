create table if not exists tenders (
  id uuid primary key,
  tender_name text not null default '',
  authority text not null default '',
  open_date text not null default '',
  last_date text not null default '',
  pre_bid_date text not null default '',
  tender_id text not null default '',
  emd text not null default '',
  tender_fee text not null default '',
  estimated_cost text not null default '',
  bid_validity text not null default '',
  work_completion_period text not null default '',
  portal_name text not null default '',
  source_file_name text,
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tender_notifications (
  id uuid primary key,
  tender_id uuid not null references tenders(id) on delete cascade,
  kind text not null check (kind in ('lastDate', 'preBidDate')),
  label text not null,
  notify_at timestamptz not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tenders_last_date_idx on tenders(last_date);
create index if not exists tenders_authority_idx on tenders(authority);
create index if not exists tender_notifications_tender_id_idx on tender_notifications(tender_id);
create index if not exists tender_notifications_notify_at_idx on tender_notifications(notify_at);
