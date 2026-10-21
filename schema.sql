create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  domain_name text not null,
  order_type text not null default 'Hoàn thiện hồ sơ',
  received_at timestamptz not null default now(),
  deadline_at timestamptz,
  processing_status text not null default 'new'
    check (processing_status in ('new','processing','waiting_customer','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_checklists (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  document_type text not null,
  document_status text not null default 'missing'
    check (document_status in ('missing','received','needs_revision','not_applicable')),
  is_required boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  contacted_at timestamptz not null default now(),
  channel text not null check (channel in ('phone','email','zalo','other')),
  result text not null check (result in ('contacted','no_answer','no_response','callback_scheduled','waiting_documents')),
  note text not null default '',
  next_contact_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deadline_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  alert_type text not null check (alert_type in ('due_soon','due_tomorrow','overdue','callback_due')),
  alert_date date not null default current_date,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, alert_type, alert_date)
);

create index if not exists orders_status_deadline_idx on public.orders (processing_status, deadline_at);
create index if not exists orders_received_idx on public.orders (received_at desc);
create index if not exists contact_logs_next_contact_idx on public.contact_logs (next_contact_at);

-- For a private internal MVP, enable RLS and create policies for authenticated staff before production.
-- Do not use a service_role key in the browser. This demo schema intentionally does not expose public access.
alter table public.orders enable row level security;
alter table public.document_checklists enable row level security;
alter table public.contact_logs enable row level security;
alter table public.deadline_alerts enable row level security;
