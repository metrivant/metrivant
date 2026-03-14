-- ── Reference migrations for core pipeline tables ────────────────────────────
--
-- These tables were created directly in Supabase and have no prior migration.
-- This file is a REFERENCE ONLY — do NOT run on a live database unless you
-- are rebuilding from scratch. The live schema may have additional columns,
-- indexes, triggers, and constraints added by migrations 000–012.
--
-- Source of truth: Supabase dashboard → Table Editor.
-- Runtime endpoint: /api/radar-feed (NOT the radar_feed Supabase view).
--
-- Last reconstructed: 2026-03-14

-- ── radar_feed view comment ───────────────────────────────────────────────────
-- The radar_feed Supabase view is a STUB used only as a schema reference and
-- for the /api/radar-feed runtime query. It returns hardcoded zeros/NULLs for
-- most fields. The authoritative source of radar data is the runtime endpoint:
--   GET https://metrivant-runtime.vercel.app/api/radar-feed
-- Do NOT add business logic to this view. Do NOT query it from the UI directly.
COMMENT ON VIEW radar_feed IS
  'STUB VIEW — schema reference only. Real data served by runtime /api/radar-feed. Do not add logic here.';

-- ── competitors ───────────────────────────────────────────────────────────────
-- Central competitor registry. One row per tracked company, shared across all
-- pipeline stages. RLS not required — pipeline uses service role.
CREATE TABLE IF NOT EXISTS competitors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  website_url          TEXT NOT NULL UNIQUE,
  active               BOOLEAN NOT NULL DEFAULT true,
  pressure_index       FLOAT DEFAULT 0.0 CHECK (pressure_index >= 0.0 AND pressure_index <= 10.0),
  last_signal_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_active      ON competitors (id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_competitors_last_signal ON competitors (last_signal_at DESC NULLS LAST);

-- ── monitored_pages ───────────────────────────────────────────────────────────
-- URLs registered for crawling. Each competitor has up to 7 pages
-- (homepage, pricing, changelog, blog, features, newsroom, careers).
CREATE TABLE IF NOT EXISTS monitored_pages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id               UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  url                         TEXT NOT NULL UNIQUE,
  page_type                   TEXT NOT NULL
    CHECK (page_type IN ('homepage','pricing','changelog','blog','features','newsroom','careers')),
  page_class                  TEXT NOT NULL DEFAULT 'standard'
    CHECK (page_class IN ('high_value','standard','ambient')),
  active                      BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at             TIMESTAMPTZ,
  consecutive_fetch_failures  INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitored_pages_competitor ON monitored_pages (competitor_id);
CREATE INDEX IF NOT EXISTS idx_monitored_pages_class      ON monitored_pages (page_class) WHERE active = true;

-- ── extraction_rules ──────────────────────────────────────────────────────────
-- CSS selector rules per monitored page. Drives page_sections extraction.
CREATE TABLE IF NOT EXISTS extraction_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_page_id UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  section_type      TEXT NOT NULL
    CHECK (section_type IN ('hero','headline','product_mentions','pricing_plans','pricing_references',
                            'release_feed','features_overview','announcements','careers_feed')),
  selector          TEXT NOT NULL,
  extract_method    TEXT NOT NULL DEFAULT 'css',
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (monitored_page_id, section_type)
);

-- ── snapshots ─────────────────────────────────────────────────────────────────
-- Point-in-time page captures. raw_html pruned after 60 days.
CREATE TABLE IF NOT EXISTS snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_page_id    UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_html             TEXT,
  extracted_text       TEXT,
  content_hash         TEXT,
  status               TEXT NOT NULL DEFAULT 'fetched'
    CHECK (status IN ('fetched','extracted','failed')),
  sections_extracted   BOOLEAN NOT NULL DEFAULT false,
  is_duplicate         BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (monitored_page_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_page_pending
  ON snapshots (monitored_page_id, fetched_at ASC)
  WHERE sections_extracted = false AND status = 'fetched';

-- ── page_sections ─────────────────────────────────────────────────────────────
-- Content blocks extracted from snapshots via extraction_rules.
CREATE TABLE IF NOT EXISTS page_sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id         UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  monitored_page_id   UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  section_type        TEXT NOT NULL
    CHECK (section_type IN ('hero','headline','product_mentions','pricing_plans','pricing_references',
                            'release_feed','features_overview','announcements','careers_feed')),
  content             TEXT,
  content_hash        TEXT,
  extraction_status   TEXT NOT NULL DEFAULT 'success'
    CHECK (extraction_status IN ('success','failed','partial')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_sections_page_type_created
  ON page_sections (monitored_page_id, section_type, created_at DESC);

-- ── section_baselines ─────────────────────────────────────────────────────────
-- Immutable reference state per (monitored_page, section_type).
-- INSERT-ONLY — never updated after creation (migration 006).
CREATE TABLE IF NOT EXISTS section_baselines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_page_id UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  section_type      TEXT NOT NULL,
  content           TEXT,
  content_hash      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (monitored_page_id, section_type)
);

-- ── section_diffs ─────────────────────────────────────────────────────────────
-- Delta between current section content and section baseline.
CREATE TABLE IF NOT EXISTS section_diffs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_page_id     UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  section_type          TEXT NOT NULL
    CHECK (section_type IN ('hero','headline','product_mentions','pricing_plans','pricing_references',
                            'release_feed','features_overview','announcements','careers_feed')),
  previous_section_id   UUID REFERENCES page_sections(id),
  current_section_id    UUID REFERENCES page_sections(id),
  previous_hash         TEXT,
  current_hash          TEXT,
  status                TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (status IN ('unconfirmed','confirmed','unstable','failed')),
  observation_count     INT NOT NULL DEFAULT 1,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_noise              BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (monitored_page_id, section_type, previous_section_id)
);

CREATE INDEX IF NOT EXISTS idx_section_diffs_pending
  ON section_diffs (monitored_page_id, last_seen_at DESC)
  WHERE status = 'confirmed' AND is_noise = false;

-- ── signals ───────────────────────────────────────────────────────────────────
-- Classified diffs. The atomic unit of intelligence.
CREATE TABLE IF NOT EXISTS signals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id          UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  section_diff_id        UUID REFERENCES section_diffs(id),
  signal_type            TEXT NOT NULL
    CHECK (signal_type IN ('price_point_change','tier_change','feature_launch',
                           'positioning_shift','content_change','hiring_surge')),
  severity               TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high')),
  urgency                INT,
  confidence_score       FLOAT DEFAULT 0.5,
  signal_hash            TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','pending_review','in_progress','interpreted','failed')),
  summary                TEXT,
  strategic_implication  TEXT,
  recommended_action     TEXT,
  previous_excerpt       TEXT,
  current_excerpt        TEXT,
  suppressed_at          TIMESTAMPTZ,
  suppressed_reason      TEXT,
  interpreter_confidence FLOAT,
  retry_count            INT NOT NULL DEFAULT 0,
  detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal_hash)
);

CREATE INDEX IF NOT EXISTS idx_signals_pending
  ON signals (detected_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_signals_competitor
  ON signals (competitor_id, detected_at DESC);

-- ── interpretations ───────────────────────────────────────────────────────────
-- Groups related signals into a coherent strategic intent.
CREATE TABLE IF NOT EXISTS interpretations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  signal_ids      UUID[] NOT NULL DEFAULT '{}',
  movement_type   TEXT,
  confidence      FLOAT,
  summary         TEXT,
  prompt_version  TEXT,
  prompt_hash     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interpretations_competitor ON interpretations (competitor_id, created_at DESC);

-- ── strategic_movements ───────────────────────────────────────────────────────
-- Confirmed movement events derived from interpretations.
CREATE TABLE IF NOT EXISTS strategic_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL,
  confidence      FLOAT,
  signal_count    INT NOT NULL DEFAULT 0,
  velocity        FLOAT,
  summary         TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, movement_type)
);

CREATE INDEX IF NOT EXISTS idx_strategic_movements_competitor
  ON strategic_movements (competitor_id, last_seen_at DESC);

-- ── activity_events ───────────────────────────────────────────────────────────
-- Ambient-only intelligence (blog posts, careers, announcements).
-- NOT signals. NOT interpreted. 30-day retention.
CREATE TABLE IF NOT EXISTS activity_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id    UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  source_headline  TEXT,
  url              TEXT,
  page_class       TEXT,
  raw_data         JSONB,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_competitor
  ON activity_events (competitor_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_detected
  ON activity_events (detected_at DESC);
