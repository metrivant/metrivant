-- ── Migration 010: Sector catalog table ──────────────────────────────────────
--
-- Stores the canonical set of default competitors per sector.
-- Used by /api/initialize-sector to seed tracked_competitors on onboarding.
-- The application-layer source of truth is lib/sector-catalog.ts;
-- this table makes the same data available to the runtime pipeline.
--
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS sector_catalog (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sector         text        NOT NULL,
  competitor_name text       NOT NULL,
  domain         text        NOT NULL,
  website_url    text        NOT NULL,
  default_pages  text[]      NOT NULL DEFAULT '{}',
  priority       integer     NOT NULL DEFAULT 5,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (sector, domain)
);

ALTER TABLE sector_catalog ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the catalog (for onboarding previews etc.)
CREATE POLICY "sector_catalog_read" ON sector_catalog
  FOR SELECT TO authenticated USING (true);

-- ── Seed data ─────────────────────────────────────────────────────────────────

INSERT INTO sector_catalog (sector, competitor_name, domain, website_url, default_pages, priority) VALUES

-- SaaS
('saas', 'Salesforce',  'salesforce.com',  'https://salesforce.com',  ARRAY['pricing','features','changelog','blog'], 1),
('saas', 'HubSpot',     'hubspot.com',     'https://hubspot.com',     ARRAY['pricing','features','changelog','blog'], 2),
('saas', 'Notion',      'notion.so',       'https://notion.so',       ARRAY['pricing','features','changelog','blog'], 3),
('saas', 'GitHub',      'github.com',      'https://github.com',      ARRAY['pricing','features','changelog','blog'], 4),
('saas', 'Figma',       'figma.com',       'https://figma.com',       ARRAY['pricing','features','changelog','blog'], 5),
('saas', 'OpenAI',      'openai.com',      'https://openai.com',      ARRAY['pricing','features','changelog','blog'], 6),
('saas', 'Stripe',      'stripe.com',      'https://stripe.com',      ARRAY['pricing','features','changelog','blog'], 7),
('saas', 'Datadog',     'datadoghq.com',   'https://datadoghq.com',   ARRAY['pricing','features','changelog','blog'], 8),
('saas', 'Vercel',      'vercel.com',      'https://vercel.com',      ARRAY['pricing','features','changelog','blog'], 9),
('saas', 'Anthropic',   'anthropic.com',   'https://anthropic.com',   ARRAY['pricing','features','changelog','blog'], 10),

-- Defense
('defense', 'Lockheed Martin',  'lockheedmartin.com',  'https://lockheedmartin.com',  ARRAY['capabilities','programs','news','contracts'], 1),
('defense', 'Raytheon',         'rtx.com',             'https://rtx.com',             ARRAY['capabilities','programs','news','contracts'], 2),
('defense', 'BAE Systems',      'baesystems.com',      'https://baesystems.com',      ARRAY['capabilities','programs','news','contracts'], 3),
('defense', 'Northrop Grumman', 'northropgrumman.com', 'https://northropgrumman.com', ARRAY['capabilities','programs','news','contracts'], 4),
('defense', 'General Dynamics', 'gd.com',              'https://gd.com',              ARRAY['capabilities','programs','news','contracts'], 5),
('defense', 'Palantir',         'palantir.com',        'https://palantir.com',        ARRAY['capabilities','programs','news','contracts'], 6),
('defense', 'Anduril',          'anduril.com',         'https://anduril.com',         ARRAY['capabilities','programs','news','contracts'], 7),
('defense', 'Thales',           'thalesgroup.com',     'https://thalesgroup.com',     ARRAY['capabilities','programs','news','contracts'], 8),
('defense', 'Saab',             'saab.com',            'https://saab.com',            ARRAY['capabilities','programs','news','contracts'], 9),
('defense', 'Rheinmetall',      'rheinmetall.com',     'https://rheinmetall.com',     ARRAY['capabilities','programs','news','contracts'], 10),

-- Energy
('energy', 'ExxonMobil',     'exxonmobil.com',     'https://exxonmobil.com',     ARRAY['investor-relations','news','projects','operations'], 1),
('energy', 'Chevron',        'chevron.com',         'https://chevron.com',        ARRAY['investor-relations','news','projects','operations'], 2),
('energy', 'Shell',          'shell.com',           'https://shell.com',          ARRAY['investor-relations','news','projects','operations'], 3),
('energy', 'BP',             'bp.com',              'https://bp.com',             ARRAY['investor-relations','news','projects','operations'], 4),
('energy', 'TotalEnergies',  'totalenergies.com',   'https://totalenergies.com',  ARRAY['investor-relations','news','projects','operations'], 5),
('energy', 'Saudi Aramco',   'aramco.com',          'https://aramco.com',         ARRAY['investor-relations','news','projects','operations'], 6),
('energy', 'Equinor',        'equinor.com',         'https://equinor.com',        ARRAY['investor-relations','news','projects','operations'], 7),
('energy', 'Petrobras',      'petrobras.com.br',    'https://petrobras.com.br',   ARRAY['investor-relations','news','projects','operations'], 8),
('energy', 'ConocoPhillips', 'conocophillips.com',  'https://conocophillips.com', ARRAY['investor-relations','news','projects','operations'], 9),
('energy', 'Eni',            'eni.com',             'https://eni.com',            ARRAY['investor-relations','news','projects','operations'], 10),

-- Cybersecurity
('cybersecurity', 'CrowdStrike',          'crowdstrike.com',      'https://crowdstrike.com',      ARRAY['products','pricing','blog','research'], 1),
('cybersecurity', 'Palo Alto Networks',   'paloaltonetworks.com', 'https://paloaltonetworks.com', ARRAY['products','pricing','blog','research'], 2),
('cybersecurity', 'SentinelOne',          'sentinelone.com',      'https://sentinelone.com',      ARRAY['products','pricing','blog','research'], 3),
('cybersecurity', 'Fortinet',             'fortinet.com',         'https://fortinet.com',         ARRAY['products','pricing','blog','research'], 4),
('cybersecurity', 'Okta',                 'okta.com',             'https://okta.com',             ARRAY['products','pricing','blog','research'], 5),
('cybersecurity', 'Zscaler',              'zscaler.com',          'https://zscaler.com',          ARRAY['products','pricing','blog','research'], 6),
('cybersecurity', 'Wiz',                  'wiz.io',               'https://wiz.io',               ARRAY['products','pricing','blog','research'], 7),
('cybersecurity', 'Cloudflare',           'cloudflare.com',       'https://cloudflare.com',       ARRAY['products','pricing','blog','research'], 8),
('cybersecurity', 'Rapid7',               'rapid7.com',           'https://rapid7.com',           ARRAY['products','pricing','blog','research'], 9),
('cybersecurity', 'Tenable',              'tenable.com',          'https://tenable.com',          ARRAY['products','pricing','blog','research'], 10),

-- Fintech
('fintech', 'Stripe',    'stripe.com',    'https://stripe.com',    ARRAY['pricing','features','blog','changelog'], 1),
('fintech', 'Brex',      'brex.com',      'https://brex.com',      ARRAY['pricing','features','blog','changelog'], 2),
('fintech', 'Plaid',     'plaid.com',     'https://plaid.com',     ARRAY['pricing','features','blog','changelog'], 3),
('fintech', 'Adyen',     'adyen.com',     'https://adyen.com',     ARRAY['pricing','features','blog','changelog'], 4),
('fintech', 'Mercury',   'mercury.com',   'https://mercury.com',   ARRAY['pricing','features','blog','changelog'], 5),
('fintech', 'Ramp',      'ramp.com',      'https://ramp.com',      ARRAY['pricing','features','blog','changelog'], 6),
('fintech', 'Rippling',  'rippling.com',  'https://rippling.com',  ARRAY['pricing','features','blog','changelog'], 7),
('fintech', 'Marqeta',   'marqeta.com',   'https://marqeta.com',   ARRAY['pricing','features','blog','changelog'], 8),
('fintech', 'Chime',     'chime.com',     'https://chime.com',     ARRAY['pricing','features','blog','changelog'], 9),
('fintech', 'Robinhood', 'robinhood.com', 'https://robinhood.com', ARRAY['pricing','features','blog','changelog'], 10),

-- AI Infrastructure
('ai-infrastructure', 'OpenAI',       'openai.com',       'https://openai.com',       ARRAY['pricing','docs','blog','changelog'], 1),
('ai-infrastructure', 'Anthropic',    'anthropic.com',    'https://anthropic.com',    ARRAY['pricing','docs','blog','changelog'], 2),
('ai-infrastructure', 'Mistral',      'mistral.ai',       'https://mistral.ai',       ARRAY['pricing','docs','blog','changelog'], 3),
('ai-infrastructure', 'Groq',         'groq.com',         'https://groq.com',         ARRAY['pricing','docs','blog','changelog'], 4),
('ai-infrastructure', 'Together AI',  'together.ai',      'https://together.ai',      ARRAY['pricing','docs','blog','changelog'], 5),
('ai-infrastructure', 'Replicate',    'replicate.com',    'https://replicate.com',    ARRAY['pricing','docs','blog','changelog'], 6),
('ai-infrastructure', 'Hugging Face', 'huggingface.co',   'https://huggingface.co',   ARRAY['pricing','docs','blog','changelog'], 7),
('ai-infrastructure', 'Cohere',       'cohere.com',       'https://cohere.com',       ARRAY['pricing','docs','blog','changelog'], 8),
('ai-infrastructure', 'xAI',          'x.ai',             'https://x.ai',             ARRAY['pricing','docs','blog','changelog'], 9),
('ai-infrastructure', 'Pinecone',     'pinecone.io',      'https://pinecone.io',      ARRAY['pricing','docs','blog','changelog'], 10),

-- DevTools
('devtools', 'GitHub',    'github.com',      'https://github.com',      ARRAY['pricing','changelog','docs','blog'], 1),
('devtools', 'GitLab',    'gitlab.com',      'https://gitlab.com',      ARRAY['pricing','changelog','docs','blog'], 2),
('devtools', 'Vercel',    'vercel.com',      'https://vercel.com',      ARRAY['pricing','changelog','docs','blog'], 3),
('devtools', 'Netlify',   'netlify.com',     'https://netlify.com',     ARRAY['pricing','changelog','docs','blog'], 4),
('devtools', 'Datadog',   'datadoghq.com',   'https://datadoghq.com',   ARRAY['pricing','changelog','docs','blog'], 5),
('devtools', 'Supabase',  'supabase.com',    'https://supabase.com',    ARRAY['pricing','changelog','docs','blog'], 6),
('devtools', 'HashiCorp', 'hashicorp.com',   'https://hashicorp.com',   ARRAY['pricing','changelog','docs','blog'], 7),
('devtools', 'Retool',    'retool.com',      'https://retool.com',      ARRAY['pricing','changelog','docs','blog'], 8),
('devtools', 'Neon',      'neon.tech',       'https://neon.tech',       ARRAY['pricing','changelog','docs','blog'], 9),
('devtools', 'Render',    'render.com',      'https://render.com',      ARRAY['pricing','changelog','docs','blog'], 10),

-- Healthcare
('healthcare', 'Epic Systems',    'epic.com',           'https://epic.com',           ARRAY['products','solutions','news','blog'], 1),
('healthcare', 'Veeva Systems',   'veeva.com',          'https://veeva.com',          ARRAY['products','solutions','news','blog'], 2),
('healthcare', 'Cerner',          'oracle.com/health',  'https://oracle.com/health',  ARRAY['products','solutions','news','blog'], 3),
('healthcare', 'Doximity',        'doximity.com',       'https://doximity.com',       ARRAY['products','solutions','news','blog'], 4),
('healthcare', 'Nuvation Health', 'nuance.com',         'https://nuance.com',         ARRAY['products','solutions','news','blog'], 5),
('healthcare', 'Athenahealth',    'athenahealth.com',   'https://athenahealth.com',   ARRAY['products','solutions','news','blog'], 6),
('healthcare', 'Phreesia',        'phreesia.com',       'https://phreesia.com',       ARRAY['products','solutions','news','blog'], 7),
('healthcare', 'Samsara',         'samsara.com',        'https://samsara.com',        ARRAY['products','solutions','news','blog'], 8),
('healthcare', 'Health Catalyst', 'healthcatalyst.com', 'https://healthcatalyst.com', ARRAY['products','solutions','news','blog'], 9),
('healthcare', 'Evolent Health',  'evolent.com',        'https://evolent.com',        ARRAY['products','solutions','news','blog'], 10),

-- Consumer Tech
('consumer-tech', 'Apple',     'apple.com',     'https://apple.com',     ARRAY['pricing','features','blog','press'], 1),
('consumer-tech', 'Samsung',   'samsung.com',   'https://samsung.com',   ARRAY['pricing','features','blog','press'], 2),
('consumer-tech', 'Google',    'google.com',    'https://google.com',    ARRAY['pricing','features','blog','press'], 3),
('consumer-tech', 'Meta',      'meta.com',      'https://meta.com',      ARRAY['pricing','features','blog','press'], 4),
('consumer-tech', 'Spotify',   'spotify.com',   'https://spotify.com',   ARRAY['pricing','features','blog','press'], 5),
('consumer-tech', 'Netflix',   'netflix.com',   'https://netflix.com',   ARRAY['pricing','features','blog','press'], 6),
('consumer-tech', 'Airbnb',    'airbnb.com',    'https://airbnb.com',    ARRAY['pricing','features','blog','press'], 7),
('consumer-tech', 'Uber',      'uber.com',      'https://uber.com',      ARRAY['pricing','features','blog','press'], 8),
('consumer-tech', 'DoorDash',  'doordash.com',  'https://doordash.com',  ARRAY['pricing','features','blog','press'], 9),
('consumer-tech', 'Pinterest', 'pinterest.com', 'https://pinterest.com', ARRAY['pricing','features','blog','press'], 10)

ON CONFLICT (sector, domain) DO NOTHING;
