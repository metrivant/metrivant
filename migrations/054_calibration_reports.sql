-- Calibration reports — weekly snapshot of operator-feedback-derived weight adjustments.
--
-- section_stats JSONB array structure (one entry per section_type with sufficient data):
--   [{ section_type, true_positive, false_positive, uncertain, total,
--      precision, base_weight, adjusted_weight }]
--
-- adjusted_weight = lerp(base_weight, DEFAULT_WEIGHT=0.25, 1 - precision)
-- Only populated for buckets with >= 10 labeled signals (tp + fp).
-- detect-signals reads the most recent row (within 30d) to override SECTION_WEIGHTS.

create table if not exists calibration_reports (
  id            uuid        primary key default gen_random_uuid(),
  computed_at   timestamptz not null default now(),
  signal_count  int         not null default 0,  -- total labeled signals used
  applied_count int         not null default 0,  -- section_types with calibration applied
  section_stats jsonb       not null default '[]'::jsonb,
  constraint check_section_stats check (jsonb_typeof(section_stats) = 'array')
);

create index if not exists idx_calibration_reports_computed
  on calibration_reports (computed_at desc);
