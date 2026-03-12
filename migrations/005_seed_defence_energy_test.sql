-- =============================================================================
-- Migration: 005_seed_defence_energy_test.sql
-- Purpose:   Reset pipeline tables and seed 10 defence/energy competitors
--            for pre-launch system testing.
-- Run via:   Supabase SQL editor (service role) or psql
-- Safe:      Preserves schema and all SaaS tables (organizations, alerts,
--            momentum, briefs, insights, positioning — none have FKs into
--            the pipeline tables being truncated).
-- =============================================================================

BEGIN;

-- ── PHASE 1: RESET ────────────────────────────────────────────────────────────
-- Clear pipeline tables in FK-safe order.
-- CASCADE handles:
--   • interpretations  (FK: signal_id       → signals.id)
--   • patterns         (FK: competitor_id   → competitors.id, if table exists)
-- Strategic_movements and extraction_rules are listed explicitly for clarity.
-- SaaS tables (alerts, momentum, positioning, briefs, insights) are NOT touched:
-- their competitor_id / signal_id columns are stored values, not FK constraints.

TRUNCATE TABLE
  interpretations,
  signals,
  section_diffs,
  section_baselines,
  page_sections,
  snapshots,
  extraction_rules,
  strategic_movements,
  monitored_pages,
  competitors
CASCADE;


-- ── PHASES 2–4: SEED COMPETITORS, MONITORED PAGES, EXTRACTION RULES ──────────
--
-- Page types per competitor (4 pages each, 40 total):
--   homepage   — brand positioning, hero messaging, CTAs
--   newsroom   — press releases, strategic announcements
--   products   — capabilities, offerings, contract references
--   careers    — hiring direction signals
--
-- Extraction rules per page (11 per competitor, 110 total):
--   homepage:  hero, headline, product_mentions, cta_blocks
--   newsroom:  announcements, headline
--   products:  product_mentions, pricing_references, headline
--   careers:   hero, headline
--
-- All selectors use CSS via cheerio (extract-sections.ts).
-- Broad selectors (h1, h2, main, a) are intentional — corporate/defence/energy
-- sites have inconsistent class naming; these reliably extract content.

DO $$
DECLARE
  -- Competitor UUIDs (assigned at insert time via RETURNING)
  c_lm   UUID;  -- Lockheed Martin
  c_rtx  UUID;  -- Raytheon (RTX)
  c_ng   UUID;  -- Northrop Grumman
  c_bae  UUID;  -- BAE Systems
  c_gd   UUID;  -- General Dynamics
  c_xom  UUID;  -- ExxonMobil
  c_cvx  UUID;  -- Chevron
  c_bp   UUID;  -- BP
  c_shel UUID;  -- Shell
  c_tte  UUID;  -- TotalEnergies

  -- Reused for each monitored_page insert
  p UUID;

BEGIN

  -- ───────────────────────────────────────────────────────────────────────────
  -- DEFENCE: 1 of 5 — LOCKHEED MARTIN
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('Lockheed Martin', 'https://www.lockheedmartin.com', true)
  RETURNING id INTO c_lm;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_lm, 'https://www.lockheedmartin.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_lm, 'https://www.lockheedmartin.com/en-us/news.html', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_lm, 'https://www.lockheedmartin.com/en-us/products.html', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_lm, 'https://www.lockheedmartin.com/en-us/careers.html', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- DEFENCE: 2 of 5 — RAYTHEON (RTX)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('Raytheon (RTX)', 'https://www.rtx.com', true)
  RETURNING id INTO c_rtx;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_rtx, 'https://www.rtx.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_rtx, 'https://www.rtx.com/news', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_rtx, 'https://www.rtx.com/raytheon/capabilities-and-programs', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_rtx, 'https://www.rtx.com/who-we-are/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- DEFENCE: 3 of 5 — NORTHROP GRUMMAN
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('Northrop Grumman', 'https://www.northropgrumman.com', true)
  RETURNING id INTO c_ng;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_ng, 'https://www.northropgrumman.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_ng, 'https://news.northropgrumman.com', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_ng, 'https://www.northropgrumman.com/our-work', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_ng, 'https://www.northropgrumman.com/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- DEFENCE: 4 of 5 — BAE SYSTEMS
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('BAE Systems', 'https://www.baesystems.com', true)
  RETURNING id INTO c_bae;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bae, 'https://www.baesystems.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bae, 'https://www.baesystems.com/en/article/news', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bae, 'https://www.baesystems.com/en/our-company', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bae, 'https://www.baesystems.com/en/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- DEFENCE: 5 of 5 — GENERAL DYNAMICS
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('General Dynamics', 'https://www.gd.com', true)
  RETURNING id INTO c_gd;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_gd, 'https://www.gd.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_gd, 'https://www.gd.com/news', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_gd, 'https://www.gd.com/Divisions', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_gd, 'https://www.gd.com/Careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- ENERGY: 1 of 5 — EXXONMOBIL
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('ExxonMobil', 'https://corporate.exxonmobil.com', true)
  RETURNING id INTO c_xom;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_xom, 'https://corporate.exxonmobil.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_xom, 'https://corporate.exxonmobil.com/news', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_xom, 'https://corporate.exxonmobil.com/energy-and-innovation', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_xom, 'https://corporate.exxonmobil.com/about-us/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- ENERGY: 2 of 5 — CHEVRON
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('Chevron', 'https://www.chevron.com', true)
  RETURNING id INTO c_cvx;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_cvx, 'https://www.chevron.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_cvx, 'https://www.chevron.com/newsroom', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_cvx, 'https://www.chevron.com/energy-and-innovation', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_cvx, 'https://www.chevron.com/about/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- ENERGY: 3 of 5 — BP
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('BP', 'https://www.bp.com', true)
  RETURNING id INTO c_bp;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bp, 'https://www.bp.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bp, 'https://www.bp.com/en/global/corporate/news-and-insights.html', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bp, 'https://www.bp.com/en/global/corporate/what-we-do.html', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_bp, 'https://www.bp.com/en/global/corporate/careers.html', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- ENERGY: 4 of 5 — SHELL
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('Shell', 'https://www.shell.com', true)
  RETURNING id INTO c_shel;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_shel, 'https://www.shell.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_shel, 'https://www.shell.com/media.html', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_shel, 'https://www.shell.com/energy-and-innovation.html', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_shel, 'https://www.shell.com/careers.html', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

  -- ───────────────────────────────────────────────────────────────────────────
  -- ENERGY: 5 of 5 — TOTALENERGIES
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO competitors (name, website_url, active)
  VALUES ('TotalEnergies', 'https://totalenergies.com', true)
  RETURNING id INTO c_tte;

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_tte, 'https://totalenergies.com', 'homepage', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',             'h1',   'css', true),
    (p, 'headline',         'h2',   'css', true),
    (p, 'product_mentions', 'main', 'css', true),
    (p, 'cta_blocks',       'a',    'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_tte, 'https://totalenergies.com/media/news', 'newsroom', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'announcements', 'main', 'css', true),
    (p, 'headline',      'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_tte, 'https://totalenergies.com/energy-expertise/technologies', 'products', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'product_mentions',   'main', 'css', true),
    (p, 'pricing_references', 'main', 'css', true),
    (p, 'headline',           'h1',   'css', true);

  INSERT INTO monitored_pages (competitor_id, url, page_type, active)
  VALUES (c_tte, 'https://totalenergies.com/careers', 'careers', true)
  RETURNING id INTO p;
  INSERT INTO extraction_rules (monitored_page_id, section_type, selector, extract_method, active) VALUES
    (p, 'hero',     'h1', 'css', true),
    (p, 'headline', 'h2', 'css', true);

END $$;


-- ── PHASE 6: VALIDATION ───────────────────────────────────────────────────────
-- Asserts expected counts and confirms pipeline table state.
-- Raises EXCEPTION if counts are wrong — rolls back the entire transaction.

DO $$
DECLARE
  n_competitors    INT;
  n_pages          INT;
  n_rules          INT;
  n_snapshots      INT;
  n_signals        INT;
  n_radar_feed     INT;
BEGIN
  SELECT COUNT(*) INTO n_competitors FROM competitors;
  SELECT COUNT(*) INTO n_pages       FROM monitored_pages;
  SELECT COUNT(*) INTO n_rules       FROM extraction_rules;
  SELECT COUNT(*) INTO n_snapshots   FROM snapshots;
  SELECT COUNT(*) INTO n_signals     FROM signals;
  SELECT COUNT(*) INTO n_radar_feed  FROM radar_feed;

  -- Hard assertions — fail the transaction if wrong
  IF n_competitors <> 10 THEN
    RAISE EXCEPTION 'SEED FAILED: expected 10 competitors, found %', n_competitors;
  END IF;

  IF n_pages <> 40 THEN
    RAISE EXCEPTION 'SEED FAILED: expected 40 monitored_pages, found %', n_pages;
  END IF;

  IF n_rules <> 110 THEN
    RAISE EXCEPTION 'SEED FAILED: expected 110 extraction_rules, found %', n_rules;
  END IF;

  IF n_snapshots <> 0 THEN
    RAISE EXCEPTION 'SEED FAILED: expected 0 snapshots after reset, found %', n_snapshots;
  END IF;

  IF n_signals <> 0 THEN
    RAISE EXCEPTION 'SEED FAILED: expected 0 signals after reset, found %', n_signals;
  END IF;

  -- radar_feed should return all 10 competitors (0 signals each, momentum_score=0)
  IF n_radar_feed <> 10 THEN
    RAISE EXCEPTION 'SEED FAILED: radar_feed returned %, expected 10', n_radar_feed;
  END IF;

  RAISE NOTICE '✓ competitors:    %', n_competitors;
  RAISE NOTICE '✓ monitored_pages: %', n_pages;
  RAISE NOTICE '✓ extraction_rules: %', n_rules;
  RAISE NOTICE '✓ snapshots (pending fetch): %', n_snapshots;
  RAISE NOTICE '✓ signals (none yet): %', n_signals;
  RAISE NOTICE '✓ radar_feed entries: %', n_radar_feed;
  RAISE NOTICE '';
  RAISE NOTICE 'Seed complete. Pipeline ready for fetch-snapshots → extract-sections → ...';
END $$;

COMMIT;


-- ── PIPELINE READINESS REFERENCE ─────────────────────────────────────────────
-- After running this migration, trigger the pipeline stages in order:
--
--   1. fetch-snapshots       → visits 40 URLs, inserts snapshots
--   2. extract-sections      → applies 110 rules, writes page_sections
--   3. build-baselines       → establishes section_baselines (first run)
--   4. detect-diffs          → no diffs on first run (no prior baseline delta)
--   5. detect-signals        → no signals on first run
--   6. [subsequent runs]     → diffs/signals appear when content changes
--
-- radar_feed will show all 10 competitors immediately (signals_7d=0, momentum=0).
-- Signals and movements appear after the SECOND fetch cycle detects content changes.
--
-- Page types used:
--   homepage  → hero, headline, product_mentions, cta_blocks
--   newsroom  → announcements, headline
--   products  → product_mentions, pricing_references, headline
--   careers   → hero, headline
