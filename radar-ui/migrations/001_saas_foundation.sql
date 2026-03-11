-- SaaS foundation: organizations + tracked_competitors with RLS
-- Run this in your Supabase SQL editor.

-- Organizations: one per user (owner model)
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text,
  plan       text not null default 'starter',
  created_at timestamptz not null default now(),
  unique (owner_id)
);

alter table organizations enable row level security;

create policy "org owner read"
  on organizations for select
  using (auth.uid() = owner_id);

create policy "org owner insert"
  on organizations for insert
  with check (auth.uid() = owner_id);

create policy "org owner update"
  on organizations for update
  using (auth.uid() = owner_id);

-- Tracked competitors: per organization
create table if not exists tracked_competitors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  website_url text not null,
  name        text not null,
  added_at    timestamptz not null default now(),
  unique (org_id, website_url)
);

alter table tracked_competitors enable row level security;

create policy "tracked competitors org member read"
  on tracked_competitors for select
  using (
    exists (
      select 1 from organizations o
      where o.id = tracked_competitors.org_id
        and o.owner_id = auth.uid()
    )
  );

create policy "tracked competitors org member insert"
  on tracked_competitors for insert
  with check (
    exists (
      select 1 from organizations o
      where o.id = tracked_competitors.org_id
        and o.owner_id = auth.uid()
    )
  );

create policy "tracked competitors org member delete"
  on tracked_competitors for delete
  using (
    exists (
      select 1 from organizations o
      where o.id = tracked_competitors.org_id
        and o.owner_id = auth.uid()
    )
  );
