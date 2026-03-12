export type CatalogCategory =
  | "project-management"
  | "developer-tools"
  | "analytics"
  | "crm"
  | "ai-tools"
  | "design-tools";

export type CatalogEntry = {
  id: string;
  domain: string;
  company_name: string;
  category: CatalogCategory;
  popularity_score: number;
};

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  "project-management": "Project Management",
  "developer-tools": "Developer Tools",
  analytics: "Analytics",
  crm: "CRM",
  "ai-tools": "AI Tools",
  "design-tools": "Design Tools",
};

export const COMPETITOR_CATALOG: CatalogEntry[] = [
  // ── Project Management ───────────────────────────────────────────────────────
  { id: "notion",       domain: "notion.so",        company_name: "Notion",         category: "project-management", popularity_score: 98 },
  { id: "jira",         domain: "atlassian.com",     company_name: "Jira",           category: "project-management", popularity_score: 97 },
  { id: "asana",        domain: "asana.com",         company_name: "Asana",          category: "project-management", popularity_score: 96 },
  { id: "monday",       domain: "monday.com",        company_name: "Monday.com",     category: "project-management", popularity_score: 95 },
  { id: "linear",       domain: "linear.app",        company_name: "Linear",         category: "project-management", popularity_score: 94 },
  { id: "clickup",      domain: "clickup.com",       company_name: "ClickUp",        category: "project-management", popularity_score: 91 },
  { id: "airtable",     domain: "airtable.com",      company_name: "Airtable",       category: "project-management", popularity_score: 90 },
  { id: "trello",       domain: "trello.com",        company_name: "Trello",         category: "project-management", popularity_score: 89 },
  { id: "coda",         domain: "coda.io",           company_name: "Coda",           category: "project-management", popularity_score: 86 },
  { id: "todoist",      domain: "todoist.com",       company_name: "Todoist",        category: "project-management", popularity_score: 85 },
  { id: "basecamp",     domain: "basecamp.com",      company_name: "Basecamp",       category: "project-management", popularity_score: 82 },
  { id: "wrike",        domain: "wrike.com",         company_name: "Wrike",          category: "project-management", popularity_score: 80 },
  { id: "smartsheet",   domain: "smartsheet.com",    company_name: "Smartsheet",     category: "project-management", popularity_score: 79 },
  { id: "confluence",   domain: "confluence.atlassian.com", company_name: "Confluence", category: "project-management", popularity_score: 78 },
  { id: "teamwork",     domain: "teamwork.com",      company_name: "Teamwork",       category: "project-management", popularity_score: 76 },
  { id: "craft",        domain: "craft.do",          company_name: "Craft",          category: "project-management", popularity_score: 74 },
  { id: "fibery",       domain: "fibery.io",         company_name: "Fibery",         category: "project-management", popularity_score: 70 },
  { id: "height",       domain: "height.app",        company_name: "Height",         category: "project-management", popularity_score: 68 },
  { id: "taskade",      domain: "taskade.com",       company_name: "Taskade",        category: "project-management", popularity_score: 66 },
  { id: "hive",         domain: "hive.com",          company_name: "Hive",           category: "project-management", popularity_score: 64 },
  { id: "proofhub",     domain: "proofhub.com",      company_name: "ProofHub",       category: "project-management", popularity_score: 62 },
  { id: "zoho-projects",domain: "zoho.com",          company_name: "Zoho Projects",  category: "project-management", popularity_score: 60 },

  // ── Developer Tools ──────────────────────────────────────────────────────────
  { id: "github",       domain: "github.com",        company_name: "GitHub",         category: "developer-tools", popularity_score: 99 },
  { id: "datadog",      domain: "datadoghq.com",     company_name: "Datadog",        category: "developer-tools", popularity_score: 94 },
  { id: "vercel",       domain: "vercel.com",        company_name: "Vercel",         category: "developer-tools", popularity_score: 95 },
  { id: "cloudflare",   domain: "cloudflare.com",    company_name: "Cloudflare",     category: "developer-tools", popularity_score: 96 },
  { id: "sentry",       domain: "sentry.io",         company_name: "Sentry",         category: "developer-tools", popularity_score: 91 },
  { id: "supabase",     domain: "supabase.com",      company_name: "Supabase",       category: "developer-tools", popularity_score: 90 },
  { id: "gitlab",       domain: "gitlab.com",        company_name: "GitLab",         category: "developer-tools", popularity_score: 90 },
  { id: "netlify",      domain: "netlify.com",       company_name: "Netlify",        category: "developer-tools", popularity_score: 88 },
  { id: "grafana",      domain: "grafana.com",       company_name: "Grafana",        category: "developer-tools", popularity_score: 87 },
  { id: "stripe",       domain: "stripe.com",        company_name: "Stripe",         category: "developer-tools", popularity_score: 97 },
  { id: "twilio",       domain: "twilio.com",        company_name: "Twilio",         category: "developer-tools", popularity_score: 89 },
  { id: "new-relic",    domain: "newrelic.com",      company_name: "New Relic",      category: "developer-tools", popularity_score: 86 },
  { id: "render",       domain: "render.com",        company_name: "Render",         category: "developer-tools", popularity_score: 82 },
  { id: "planetscale",  domain: "planetscale.com",   company_name: "PlanetScale",    category: "developer-tools", popularity_score: 80 },
  { id: "fly",          domain: "fly.io",            company_name: "Fly.io",         category: "developer-tools", popularity_score: 79 },
  { id: "railway",      domain: "railway.app",       company_name: "Railway",        category: "developer-tools", popularity_score: 78 },
  { id: "retool",       domain: "retool.com",        company_name: "Retool",         category: "developer-tools", popularity_score: 84 },
  { id: "elastic",      domain: "elastic.co",        company_name: "Elastic",        category: "developer-tools", popularity_score: 83 },
  { id: "hashicorp",    domain: "hashicorp.com",     company_name: "HashiCorp",      category: "developer-tools", popularity_score: 82 },
  { id: "launchdarkly", domain: "launchdarkly.com",  company_name: "LaunchDarkly",   category: "developer-tools", popularity_score: 78 },
  { id: "dynatrace",    domain: "dynatrace.com",     company_name: "Dynatrace",      category: "developer-tools", popularity_score: 81 },
  { id: "neon",         domain: "neon.tech",         company_name: "Neon",           category: "developer-tools", popularity_score: 74 },
  { id: "turso",        domain: "turso.tech",        company_name: "Turso",          category: "developer-tools", popularity_score: 64 },
  { id: "resend",       domain: "resend.com",        company_name: "Resend",         category: "developer-tools", popularity_score: 72 },
  { id: "upstash",      domain: "upstash.com",       company_name: "Upstash",        category: "developer-tools", popularity_score: 70 },

  // ── Analytics ────────────────────────────────────────────────────────────────
  { id: "amplitude",    domain: "amplitude.com",     company_name: "Amplitude",      category: "analytics", popularity_score: 91 },
  { id: "mixpanel",     domain: "mixpanel.com",      company_name: "Mixpanel",       category: "analytics", popularity_score: 90 },
  { id: "hotjar",       domain: "hotjar.com",        company_name: "Hotjar",         category: "analytics", popularity_score: 86 },
  { id: "segment",      domain: "segment.com",       company_name: "Segment",        category: "analytics", popularity_score: 88 },
  { id: "metabase",     domain: "metabase.com",      company_name: "Metabase",       category: "analytics", popularity_score: 84 },
  { id: "fullstory",    domain: "fullstory.com",     company_name: "FullStory",      category: "analytics", popularity_score: 82 },
  { id: "heap",         domain: "heap.io",           company_name: "Heap",           category: "analytics", popularity_score: 80 },
  { id: "posthog",      domain: "posthog.com",       company_name: "PostHog",        category: "analytics", popularity_score: 85 },
  { id: "looker",       domain: "looker.com",        company_name: "Looker",         category: "analytics", popularity_score: 88 },
  { id: "tableau",      domain: "tableau.com",       company_name: "Tableau",        category: "analytics", popularity_score: 91 },
  { id: "pendo",        domain: "pendo.io",          company_name: "Pendo",          category: "analytics", popularity_score: 82 },
  { id: "rudderstack",  domain: "rudderstack.com",   company_name: "RudderStack",    category: "analytics", popularity_score: 74 },
  { id: "plausible",    domain: "plausible.io",      company_name: "Plausible",      category: "analytics", popularity_score: 72 },
  { id: "june",         domain: "june.so",           company_name: "June",           category: "analytics", popularity_score: 70 },
  { id: "matomo",       domain: "matomo.org",        company_name: "Matomo",         category: "analytics", popularity_score: 68 },
  { id: "fathom",       domain: "usefathom.com",     company_name: "Fathom",         category: "analytics", popularity_score: 66 },
  { id: "countly",      domain: "count.ly",          company_name: "Countly",        category: "analytics", popularity_score: 62 },
  { id: "domo",         domain: "domo.com",          company_name: "Domo",           category: "analytics", popularity_score: 76 },
  { id: "mode",         domain: "mode.com",          company_name: "Mode",           category: "analytics", popularity_score: 70 },

  // ── CRM ──────────────────────────────────────────────────────────────────────
  { id: "salesforce",   domain: "salesforce.com",    company_name: "Salesforce",     category: "crm", popularity_score: 99 },
  { id: "hubspot",      domain: "hubspot.com",       company_name: "HubSpot",        category: "crm", popularity_score: 96 },
  { id: "pipedrive",    domain: "pipedrive.com",     company_name: "Pipedrive",      category: "crm", popularity_score: 87 },
  { id: "apollo",       domain: "apollo.io",         company_name: "Apollo",         category: "crm", popularity_score: 86 },
  { id: "intercom",     domain: "intercom.com",      company_name: "Intercom",       category: "crm", popularity_score: 88 },
  { id: "zendesk",      domain: "zendesk.com",       company_name: "Zendesk",        category: "crm", popularity_score: 89 },
  { id: "activecampaign", domain: "activecampaign.com", company_name: "ActiveCampaign", category: "crm", popularity_score: 84 },
  { id: "close",        domain: "close.com",         company_name: "Close",          category: "crm", popularity_score: 80 },
  { id: "attio",        domain: "attio.com",         company_name: "Attio",          category: "crm", popularity_score: 76 },
  { id: "zoho-crm",     domain: "zoho.com/crm",      company_name: "Zoho CRM",       category: "crm", popularity_score: 82 },
  { id: "freshsales",   domain: "freshsales.io",     company_name: "Freshsales",     category: "crm", popularity_score: 78 },
  { id: "copper",       domain: "copper.com",        company_name: "Copper",         category: "crm", popularity_score: 74 },
  { id: "streak",       domain: "streak.com",        company_name: "Streak",         category: "crm", popularity_score: 72 },
  { id: "folk",         domain: "folk.app",          company_name: "Folk",           category: "crm", popularity_score: 70 },
  { id: "twenty",       domain: "twenty.com",        company_name: "Twenty",         category: "crm", popularity_score: 62 },
  { id: "nimble",       domain: "nimble.com",        company_name: "Nimble",         category: "crm", popularity_score: 68 },

  // ── AI Tools ─────────────────────────────────────────────────────────────────
  { id: "openai",       domain: "openai.com",        company_name: "OpenAI",         category: "ai-tools", popularity_score: 99 },
  { id: "anthropic",    domain: "anthropic.com",     company_name: "Anthropic",      category: "ai-tools", popularity_score: 96 },
  { id: "google-gemini",domain: "gemini.google.com", company_name: "Google Gemini",  category: "ai-tools", popularity_score: 95 },
  { id: "perplexity",   domain: "perplexity.ai",     company_name: "Perplexity",     category: "ai-tools", popularity_score: 91 },
  { id: "mistral",      domain: "mistral.ai",        company_name: "Mistral",        category: "ai-tools", popularity_score: 87 },
  { id: "cohere",       domain: "cohere.com",        company_name: "Cohere",         category: "ai-tools", popularity_score: 85 },
  { id: "cursor",       domain: "cursor.sh",         company_name: "Cursor",         category: "ai-tools", popularity_score: 88 },
  { id: "jasper",       domain: "jasper.ai",         company_name: "Jasper",         category: "ai-tools", popularity_score: 83 },
  { id: "replicate",    domain: "replicate.com",     company_name: "Replicate",      category: "ai-tools", popularity_score: 82 },
  { id: "runway",       domain: "runwayml.com",      company_name: "Runway",         category: "ai-tools", popularity_score: 86 },
  { id: "elevenlabs",   domain: "elevenlabs.io",     company_name: "ElevenLabs",     category: "ai-tools", popularity_score: 85 },
  { id: "stability",    domain: "stability.ai",      company_name: "Stability AI",   category: "ai-tools", popularity_score: 83 },
  { id: "midjourney",   domain: "midjourney.com",    company_name: "Midjourney",     category: "ai-tools", popularity_score: 89 },
  { id: "character-ai", domain: "character.ai",      company_name: "Character.AI",   category: "ai-tools", popularity_score: 86 },
  { id: "together-ai",  domain: "together.ai",       company_name: "Together AI",    category: "ai-tools", popularity_score: 74 },
  { id: "groq",         domain: "groq.com",          company_name: "Groq",           category: "ai-tools", popularity_score: 78 },
  { id: "pinecone",     domain: "pinecone.io",       company_name: "Pinecone",       category: "ai-tools", popularity_score: 76 },
  { id: "huggingface",  domain: "huggingface.co",    company_name: "Hugging Face",   category: "ai-tools", popularity_score: 93 },
  { id: "xai",          domain: "x.ai",              company_name: "xAI",            category: "ai-tools", popularity_score: 88 },
  { id: "qdrant",       domain: "qdrant.tech",       company_name: "Qdrant",         category: "ai-tools", popularity_score: 66 },

  // ── Design Tools ─────────────────────────────────────────────────────────────
  { id: "figma",        domain: "figma.com",         company_name: "Figma",          category: "design-tools", popularity_score: 98 },
  { id: "canva",        domain: "canva.com",         company_name: "Canva",          category: "design-tools", popularity_score: 95 },
  { id: "webflow",      domain: "webflow.com",       company_name: "Webflow",        category: "design-tools", popularity_score: 91 },
  { id: "framer",       domain: "framer.com",        company_name: "Framer",         category: "design-tools", popularity_score: 88 },
  { id: "adobe",        domain: "adobe.com",         company_name: "Adobe Creative Cloud", category: "design-tools", popularity_score: 97 },
  { id: "miro",         domain: "miro.com",          company_name: "Miro",           category: "design-tools", popularity_score: 90 },
  { id: "sketch",       domain: "sketch.com",        company_name: "Sketch",         category: "design-tools", popularity_score: 84 },
  { id: "invision",     domain: "invisionapp.com",   company_name: "InVision",       category: "design-tools", popularity_score: 78 },
  { id: "mural",        domain: "mural.co",          company_name: "Mural",          category: "design-tools", popularity_score: 80 },
  { id: "zeplin",       domain: "zeplin.io",         company_name: "Zeplin",         category: "design-tools", popularity_score: 76 },
  { id: "marvel",       domain: "marvelapp.com",     company_name: "Marvel",         category: "design-tools", popularity_score: 72 },
  { id: "whimsical",    domain: "whimsical.com",     company_name: "Whimsical",      category: "design-tools", popularity_score: 74 },
  { id: "spline",       domain: "spline.design",     company_name: "Spline",         category: "design-tools", popularity_score: 78 },
  { id: "penpot",       domain: "penpot.app",        company_name: "Penpot",         category: "design-tools", popularity_score: 72 },
  { id: "maze",         domain: "maze.co",           company_name: "Maze",           category: "design-tools", popularity_score: 70 },
  { id: "uizard",       domain: "uizard.io",         company_name: "Uizard",         category: "design-tools", popularity_score: 66 },
];
