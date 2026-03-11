-- Signal alerts: per-org, per-signal notification records
-- Run this in your Supabase SQL editor.

create table if not exists alerts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  signal_id       text not null,          -- UUID from backend signals table
  competitor_name text not null,
  signal_type     text not null,
  summary         text,
  urgency         integer not null default 3,
  severity        text,
  created_at      timestamptz not null default now(),
  read            boolean not null default false,
  unique (org_id, signal_id)
);

-- Primary query pattern: unread alerts for an org, newest first
create index if not exists alerts_org_read_created_idx
  on alerts (org_id, read, created_at desc);

alter table alerts enable row level security;

-- Org owner can read their alerts
create policy "alerts org member select"
  on alerts for select
  to authenticated
  using (
    exists (
      select 1 from organizations o
      where o.id = alerts.org_id and o.owner_id = auth.uid()
    )
  );

-- Org owner can mark alerts as read
create policy "alerts org member update"
  on alerts for update
  to authenticated
  using (
    exists (
      select 1 from organizations o
      where o.id = alerts.org_id and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations o
      where o.id = alerts.org_id and o.owner_id = auth.uid()
    )
  );

-- Only service role may insert (via cron)
create policy "alerts service role insert"
  on alerts for insert
  to service_role
  with check (true);
