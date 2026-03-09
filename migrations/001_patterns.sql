create table if not exists patterns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  competitor_id uuid not null,
  pattern_type text not null,
  status text not null default 'active',
  confidence numeric not null default 0.5,
  time_window_start timestamptz not null,
  time_window_end timestamptz not null,
  signal_count integer not null default 0,
  pattern_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patterns_competitor_idx
  on patterns (competitor_id);

create index if not exists patterns_type_idx
  on patterns (pattern_type);

create index if not exists patterns_status_idx
  on patterns (status);

create unique index if not exists patterns_active_unique_idx
  on patterns (competitor_id, pattern_type, status)
  where status = 'active';