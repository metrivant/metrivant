create table if not exists pipeline_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id text,
  stage text not null,
  status text not null,
  monitored_page_id uuid,
  snapshot_id uuid,
  section_diff_id uuid,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_pipeline_events_stage_created
  on pipeline_events (stage, created_at desc);

create index if not exists idx_pipeline_events_page_created
  on pipeline_events (monitored_page_id, created_at desc);

create index if not exists idx_pipeline_events_run
  on pipeline_events (run_id) where run_id is not null;

create index if not exists idx_pipeline_events_diff
  on pipeline_events (section_diff_id) where section_diff_id is not null;
