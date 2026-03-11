-- Weekly briefs: AI-generated intelligence summaries
-- Run this in your Supabase SQL editor.

create table if not exists weekly_briefs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id) on delete cascade,
  generated_at timestamptz not null default now(),
  content      jsonb not null,
  signal_count integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Fast ordered reads
create index if not exists weekly_briefs_generated_at_idx
  on weekly_briefs (generated_at desc);

create index if not exists weekly_briefs_org_generated_at_idx
  on weekly_briefs (org_id, generated_at desc);

alter table weekly_briefs enable row level security;

-- Authenticated users can read system briefs (org_id is null)
-- and briefs belonging to their own org
create policy "briefs readable by authenticated"
  on weekly_briefs for select
  to authenticated
  using (
    org_id is null
    or exists (
      select 1 from organizations o
      where o.id = weekly_briefs.org_id
        and o.owner_id = auth.uid()
    )
  );

-- Only service role may insert/update
create policy "briefs service role write"
  on weekly_briefs for insert
  to service_role
  with check (true);
