-- Ocean Deadline Tracker: PostgreSQL schema for Supabase
-- Demo only. Do not insert real customer information into the demo project.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  domain_name text not null,
  order_type text not null default 'Bổ sung hồ sơ',
  received_at timestamptz not null,
  deadline_at timestamptz,
  processing_status text not null default 'new'
    check (processing_status in ('new','processing','waiting_customer','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((processing_status = 'completed' and completed_at is not null) or processing_status <> 'completed')
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
  note text,
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
  unique(order_id, alert_type, alert_date)
);

create index if not exists idx_orders_received_at on public.orders(received_at desc);
create index if not exists idx_orders_deadline_at on public.orders(deadline_at);
create index if not exists idx_orders_status on public.orders(processing_status);
create index if not exists idx_contact_logs_order_contacted on public.contact_logs(order_id, contacted_at desc);
create index if not exists idx_contact_logs_next_contact on public.contact_logs(next_contact_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- MVP demo: anon access is enabled for ease of setup. Use only fake data.
-- Before production, enable Supabase Auth and replace these policies with
-- authenticated role policies appropriate to your organization.
alter table public.orders enable row level security;
alter table public.document_checklists enable row level security;
alter table public.contact_logs enable row level security;
alter table public.deadline_alerts enable row level security;

drop policy if exists "demo orders access" on public.orders;
create policy "demo orders access" on public.orders for all to anon, authenticated using (true) with check (true);
drop policy if exists "demo checklist access" on public.document_checklists;
create policy "demo checklist access" on public.document_checklists for all to anon, authenticated using (true) with check (true);
drop policy if exists "demo contact logs access" on public.contact_logs;
create policy "demo contact logs access" on public.contact_logs for all to anon, authenticated using (true) with check (true);
drop policy if exists "demo alerts access" on public.deadline_alerts;
create policy "demo alerts access" on public.deadline_alerts for all to anon, authenticated using (true) with check (true);
