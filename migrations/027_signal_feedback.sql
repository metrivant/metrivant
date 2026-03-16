-- Signal feedback table for the 30-day observation period.
-- Allows an operator to label each signal as valid, noise, or uncertain
-- via Supabase dashboard editing.
--
-- noise_category is free-text — suggested values:
--   formatting, cookie_banner, tracking_params, marketing_copy,
--   legal_boilerplate, script_injection, cdn_artifacts, false_structure, other
--
-- FK note: signals.id uuid primary key is confirmed from live pipeline code
-- (detect-signals.ts, interpret-signals.ts, etc.). FK added accordingly.

create table if not exists signal_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  signal_id uuid not null references signals(id),
  verdict text not null,
  noise_category text,
  notes text,
  constraint uq_signal_feedback_signal unique (signal_id)
);

create index if not exists idx_signal_feedback_verdict
  on signal_feedback (verdict);

create index if not exists idx_signal_feedback_created
  on signal_feedback (created_at desc);
