-- Competitor catalog: shared system table for discovery feature
-- No RLS required — read-only public catalog managed by service role.
-- Run this in your Supabase SQL editor.

create table if not exists competitor_catalog (
  id               uuid primary key default gen_random_uuid(),
  domain           text not null unique,
  company_name     text not null,
  category         text not null,
  popularity_score integer not null default 50,
  created_at       timestamptz not null default now()
);

-- Allow authenticated users to read the catalog
alter table competitor_catalog enable row level security;

create policy "catalog read for authenticated"
  on competitor_catalog for select
  to authenticated
  using (true);

-- Seed: insert catalog entries from lib/catalog.ts
-- Run the following inserts to populate initial data.
-- These match the entries in radar-ui/lib/catalog.ts exactly.

insert into competitor_catalog (domain, company_name, category, popularity_score) values
  -- Project Management
  ('notion.so',     'Notion',       'project-management', 98),
  ('linear.app',    'Linear',       'project-management', 94),
  ('asana.com',     'Asana',        'project-management', 96),
  ('monday.com',    'Monday.com',   'project-management', 95),
  ('clickup.com',   'ClickUp',      'project-management', 91),
  ('basecamp.com',  'Basecamp',     'project-management', 82),
  ('todoist.com',   'Todoist',      'project-management', 85),
  ('height.app',    'Height',       'project-management', 68),
  ('atlassian.com', 'Jira',         'project-management', 97),
  -- Developer Tools
  ('vercel.com',      'Vercel',      'developer-tools', 95),
  ('supabase.com',    'Supabase',    'developer-tools', 90),
  ('netlify.com',     'Netlify',     'developer-tools', 88),
  ('render.com',      'Render',      'developer-tools', 82),
  ('railway.app',     'Railway',     'developer-tools', 78),
  ('sentry.io',       'Sentry',      'developer-tools', 91),
  ('datadoghq.com',   'Datadog',     'developer-tools', 94),
  ('planetscale.com', 'PlanetScale', 'developer-tools', 80),
  ('neon.tech',       'Neon',        'developer-tools', 74),
  ('turso.tech',      'Turso',       'developer-tools', 64),
  -- Analytics
  ('mixpanel.com',  'Mixpanel',  'analytics', 90),
  ('amplitude.com', 'Amplitude', 'analytics', 91),
  ('posthog.com',   'PostHog',   'analytics', 85),
  ('segment.com',   'Segment',   'analytics', 88),
  ('heap.io',       'Heap',      'analytics', 80),
  ('fullstory.com', 'FullStory', 'analytics', 82),
  ('hotjar.com',    'Hotjar',    'analytics', 86),
  ('metabase.com',  'Metabase',  'analytics', 84),
  ('june.so',       'June',      'analytics', 70),
  -- CRM
  ('hubspot.com',    'HubSpot',    'crm', 96),
  ('salesforce.com', 'Salesforce', 'crm', 99),
  ('pipedrive.com',  'Pipedrive',  'crm', 87),
  ('close.com',      'Close',      'crm', 80),
  ('attio.com',      'Attio',      'crm', 76),
  ('streak.com',     'Streak',     'crm', 72),
  ('apollo.io',      'Apollo',     'crm', 86),
  -- AI Tools
  ('openai.com',    'OpenAI',     'ai-tools', 99),
  ('anthropic.com', 'Anthropic',  'ai-tools', 96),
  ('perplexity.ai', 'Perplexity', 'ai-tools', 91),
  ('cursor.sh',     'Cursor',     'ai-tools', 88),
  ('jasper.ai',     'Jasper',     'ai-tools', 83),
  ('cohere.com',    'Cohere',     'ai-tools', 85),
  ('replicate.com', 'Replicate',  'ai-tools', 82),
  ('mistral.ai',    'Mistral',    'ai-tools', 87),
  -- Design Tools
  ('figma.com',     'Figma',   'design-tools', 98),
  ('sketch.com',    'Sketch',  'design-tools', 84),
  ('framer.com',    'Framer',  'design-tools', 88),
  ('webflow.com',   'Webflow', 'design-tools', 91),
  ('canva.com',     'Canva',   'design-tools', 95),
  ('spline.design', 'Spline',  'design-tools', 78),
  ('penpot.app',    'Penpot',  'design-tools', 72)
on conflict (domain) do nothing;
