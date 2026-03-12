// ── Catalog category type ─────────────────────────────────────────────────────
// SaaS categories (original)
// Defense categories (new)
// Energy categories (new)

export type CatalogCategory =
  // SaaS
  | "project-management"
  | "developer-tools"
  | "analytics"
  | "crm"
  | "ai-tools"
  | "design-tools"
  // Defense & Aerospace
  | "defense-primes"
  | "aerospace"
  | "cyber-intel"
  | "defense-services"
  // Energy & Resources
  | "oil-gas"
  | "renewables"
  | "energy-services"
  | "energy-tech";

export type CatalogEntry = {
  id: string;
  domain: string;
  company_name: string;
  category: CatalogCategory;
  popularity_score: number;
};

// Category → human-readable label
export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  // SaaS
  "project-management": "Project Management",
  "developer-tools":    "Developer Tools",
  analytics:            "Analytics",
  crm:                  "CRM",
  "ai-tools":           "AI Tools",
  "design-tools":       "Design Tools",
  // Defense
  "defense-primes":   "Defense Primes",
  aerospace:          "Aerospace & Space",
  "cyber-intel":      "Cyber & Intelligence",
  "defense-services": "Defense Services",
  // Energy
  "oil-gas":          "Oil & Gas",
  renewables:         "Renewables",
  "energy-services":  "Energy Services",
  "energy-tech":      "Energy Technology",
};

// Category → sector — single source of truth for sector membership
export const CATEGORY_SECTOR: Record<CatalogCategory, "saas" | "defense" | "energy"> = {
  "project-management": "saas",
  "developer-tools":    "saas",
  analytics:            "saas",
  crm:                  "saas",
  "ai-tools":           "saas",
  "design-tools":       "saas",
  "defense-primes":     "defense",
  aerospace:            "defense",
  "cyber-intel":        "defense",
  "defense-services":   "defense",
  "oil-gas":            "energy",
  renewables:           "energy",
  "energy-services":    "energy",
  "energy-tech":        "energy",
};

export const COMPETITOR_CATALOG: CatalogEntry[] = [

  // ── Project Management ───────────────────────────────────────────────────────
  { id: "notion",        domain: "notion.so",          company_name: "Notion",               category: "project-management", popularity_score: 98 },
  { id: "jira",          domain: "atlassian.com",       company_name: "Jira",                 category: "project-management", popularity_score: 97 },
  { id: "asana",         domain: "asana.com",           company_name: "Asana",                category: "project-management", popularity_score: 96 },
  { id: "monday",        domain: "monday.com",          company_name: "Monday.com",           category: "project-management", popularity_score: 95 },
  { id: "linear",        domain: "linear.app",          company_name: "Linear",               category: "project-management", popularity_score: 94 },
  { id: "clickup",       domain: "clickup.com",         company_name: "ClickUp",              category: "project-management", popularity_score: 91 },
  { id: "airtable",      domain: "airtable.com",        company_name: "Airtable",             category: "project-management", popularity_score: 90 },
  { id: "trello",        domain: "trello.com",          company_name: "Trello",               category: "project-management", popularity_score: 89 },
  { id: "coda",          domain: "coda.io",             company_name: "Coda",                 category: "project-management", popularity_score: 86 },
  { id: "todoist",       domain: "todoist.com",         company_name: "Todoist",              category: "project-management", popularity_score: 85 },
  { id: "basecamp",      domain: "basecamp.com",        company_name: "Basecamp",             category: "project-management", popularity_score: 82 },
  { id: "wrike",         domain: "wrike.com",           company_name: "Wrike",                category: "project-management", popularity_score: 80 },
  { id: "smartsheet",    domain: "smartsheet.com",      company_name: "Smartsheet",           category: "project-management", popularity_score: 79 },
  { id: "confluence",    domain: "confluence.atlassian.com", company_name: "Confluence",      category: "project-management", popularity_score: 78 },
  { id: "teamwork",      domain: "teamwork.com",        company_name: "Teamwork",             category: "project-management", popularity_score: 76 },
  { id: "craft",         domain: "craft.do",            company_name: "Craft",                category: "project-management", popularity_score: 74 },
  { id: "fibery",        domain: "fibery.io",           company_name: "Fibery",               category: "project-management", popularity_score: 70 },
  { id: "height",        domain: "height.app",          company_name: "Height",               category: "project-management", popularity_score: 68 },
  { id: "taskade",       domain: "taskade.com",         company_name: "Taskade",              category: "project-management", popularity_score: 66 },
  { id: "hive",          domain: "hive.com",            company_name: "Hive",                 category: "project-management", popularity_score: 64 },
  { id: "proofhub",      domain: "proofhub.com",        company_name: "ProofHub",             category: "project-management", popularity_score: 62 },
  { id: "zoho-projects", domain: "zoho.com",            company_name: "Zoho Projects",        category: "project-management", popularity_score: 60 },

  // ── Developer Tools ──────────────────────────────────────────────────────────
  { id: "github",        domain: "github.com",          company_name: "GitHub",               category: "developer-tools", popularity_score: 99 },
  { id: "cloudflare",    domain: "cloudflare.com",      company_name: "Cloudflare",           category: "developer-tools", popularity_score: 96 },
  { id: "stripe",        domain: "stripe.com",          company_name: "Stripe",               category: "developer-tools", popularity_score: 97 },
  { id: "datadog",       domain: "datadoghq.com",       company_name: "Datadog",              category: "developer-tools", popularity_score: 94 },
  { id: "vercel",        domain: "vercel.com",          company_name: "Vercel",               category: "developer-tools", popularity_score: 95 },
  { id: "sentry",        domain: "sentry.io",           company_name: "Sentry",               category: "developer-tools", popularity_score: 91 },
  { id: "supabase",      domain: "supabase.com",        company_name: "Supabase",             category: "developer-tools", popularity_score: 90 },
  { id: "gitlab",        domain: "gitlab.com",          company_name: "GitLab",               category: "developer-tools", popularity_score: 90 },
  { id: "netlify",       domain: "netlify.com",         company_name: "Netlify",              category: "developer-tools", popularity_score: 88 },
  { id: "grafana",       domain: "grafana.com",         company_name: "Grafana",              category: "developer-tools", popularity_score: 87 },
  { id: "twilio",        domain: "twilio.com",          company_name: "Twilio",               category: "developer-tools", popularity_score: 89 },
  { id: "new-relic",     domain: "newrelic.com",        company_name: "New Relic",            category: "developer-tools", popularity_score: 86 },
  { id: "render",        domain: "render.com",          company_name: "Render",               category: "developer-tools", popularity_score: 82 },
  { id: "fly",           domain: "fly.io",              company_name: "Fly.io",               category: "developer-tools", popularity_score: 79 },
  { id: "railway",       domain: "railway.app",         company_name: "Railway",              category: "developer-tools", popularity_score: 78 },
  { id: "retool",        domain: "retool.com",          company_name: "Retool",               category: "developer-tools", popularity_score: 84 },
  { id: "elastic",       domain: "elastic.co",          company_name: "Elastic",              category: "developer-tools", popularity_score: 83 },
  { id: "hashicorp",     domain: "hashicorp.com",       company_name: "HashiCorp",            category: "developer-tools", popularity_score: 82 },
  { id: "launchdarkly",  domain: "launchdarkly.com",    company_name: "LaunchDarkly",         category: "developer-tools", popularity_score: 78 },
  { id: "dynatrace",     domain: "dynatrace.com",       company_name: "Dynatrace",            category: "developer-tools", popularity_score: 81 },
  { id: "neon",          domain: "neon.tech",           company_name: "Neon",                 category: "developer-tools", popularity_score: 74 },
  { id: "turso",         domain: "turso.tech",          company_name: "Turso",                category: "developer-tools", popularity_score: 64 },
  { id: "resend",        domain: "resend.com",          company_name: "Resend",               category: "developer-tools", popularity_score: 72 },
  { id: "upstash",       domain: "upstash.com",         company_name: "Upstash",              category: "developer-tools", popularity_score: 70 },
  { id: "planetscale",   domain: "planetscale.com",     company_name: "PlanetScale",          category: "developer-tools", popularity_score: 80 },

  // ── Analytics ────────────────────────────────────────────────────────────────
  { id: "amplitude",     domain: "amplitude.com",       company_name: "Amplitude",            category: "analytics", popularity_score: 91 },
  { id: "mixpanel",      domain: "mixpanel.com",        company_name: "Mixpanel",             category: "analytics", popularity_score: 90 },
  { id: "hotjar",        domain: "hotjar.com",          company_name: "Hotjar",               category: "analytics", popularity_score: 86 },
  { id: "segment",       domain: "segment.com",         company_name: "Segment",              category: "analytics", popularity_score: 88 },
  { id: "metabase",      domain: "metabase.com",        company_name: "Metabase",             category: "analytics", popularity_score: 84 },
  { id: "fullstory",     domain: "fullstory.com",       company_name: "FullStory",            category: "analytics", popularity_score: 82 },
  { id: "heap",          domain: "heap.io",             company_name: "Heap",                 category: "analytics", popularity_score: 80 },
  { id: "posthog",       domain: "posthog.com",         company_name: "PostHog",              category: "analytics", popularity_score: 85 },
  { id: "looker",        domain: "looker.com",          company_name: "Looker",               category: "analytics", popularity_score: 88 },
  { id: "tableau",       domain: "tableau.com",         company_name: "Tableau",              category: "analytics", popularity_score: 91 },
  { id: "pendo",         domain: "pendo.io",            company_name: "Pendo",                category: "analytics", popularity_score: 82 },
  { id: "rudderstack",   domain: "rudderstack.com",     company_name: "RudderStack",          category: "analytics", popularity_score: 74 },
  { id: "plausible",     domain: "plausible.io",        company_name: "Plausible",            category: "analytics", popularity_score: 72 },
  { id: "june",          domain: "june.so",             company_name: "June",                 category: "analytics", popularity_score: 70 },
  { id: "matomo",        domain: "matomo.org",          company_name: "Matomo",               category: "analytics", popularity_score: 68 },
  { id: "fathom",        domain: "usefathom.com",       company_name: "Fathom",               category: "analytics", popularity_score: 66 },
  { id: "countly",       domain: "count.ly",            company_name: "Countly",              category: "analytics", popularity_score: 62 },
  { id: "domo",          domain: "domo.com",            company_name: "Domo",                 category: "analytics", popularity_score: 76 },
  { id: "mode",          domain: "mode.com",            company_name: "Mode",                 category: "analytics", popularity_score: 70 },

  // ── CRM ──────────────────────────────────────────────────────────────────────
  { id: "salesforce",    domain: "salesforce.com",      company_name: "Salesforce",           category: "crm", popularity_score: 99 },
  { id: "hubspot",       domain: "hubspot.com",         company_name: "HubSpot",              category: "crm", popularity_score: 96 },
  { id: "pipedrive",     domain: "pipedrive.com",       company_name: "Pipedrive",            category: "crm", popularity_score: 87 },
  { id: "apollo",        domain: "apollo.io",           company_name: "Apollo",               category: "crm", popularity_score: 86 },
  { id: "intercom",      domain: "intercom.com",        company_name: "Intercom",             category: "crm", popularity_score: 88 },
  { id: "zendesk",       domain: "zendesk.com",         company_name: "Zendesk",              category: "crm", popularity_score: 89 },
  { id: "activecampaign",domain: "activecampaign.com",  company_name: "ActiveCampaign",       category: "crm", popularity_score: 84 },
  { id: "close",         domain: "close.com",           company_name: "Close",                category: "crm", popularity_score: 80 },
  { id: "attio",         domain: "attio.com",           company_name: "Attio",                category: "crm", popularity_score: 76 },
  { id: "zoho-crm",      domain: "zoho.com/crm",        company_name: "Zoho CRM",             category: "crm", popularity_score: 82 },
  { id: "freshsales",    domain: "freshsales.io",       company_name: "Freshsales",           category: "crm", popularity_score: 78 },
  { id: "copper",        domain: "copper.com",          company_name: "Copper",               category: "crm", popularity_score: 74 },
  { id: "streak",        domain: "streak.com",          company_name: "Streak",               category: "crm", popularity_score: 72 },
  { id: "folk",          domain: "folk.app",            company_name: "Folk",                 category: "crm", popularity_score: 70 },
  { id: "twenty",        domain: "twenty.com",          company_name: "Twenty",               category: "crm", popularity_score: 62 },
  { id: "nimble",        domain: "nimble.com",          company_name: "Nimble",               category: "crm", popularity_score: 68 },

  // ── AI Tools ─────────────────────────────────────────────────────────────────
  { id: "openai",        domain: "openai.com",          company_name: "OpenAI",               category: "ai-tools", popularity_score: 99 },
  { id: "anthropic",     domain: "anthropic.com",       company_name: "Anthropic",            category: "ai-tools", popularity_score: 96 },
  { id: "google-gemini", domain: "gemini.google.com",   company_name: "Google Gemini",        category: "ai-tools", popularity_score: 95 },
  { id: "perplexity",    domain: "perplexity.ai",       company_name: "Perplexity",           category: "ai-tools", popularity_score: 91 },
  { id: "mistral",       domain: "mistral.ai",          company_name: "Mistral",              category: "ai-tools", popularity_score: 87 },
  { id: "cohere",        domain: "cohere.com",          company_name: "Cohere",               category: "ai-tools", popularity_score: 85 },
  { id: "cursor",        domain: "cursor.sh",           company_name: "Cursor",               category: "ai-tools", popularity_score: 88 },
  { id: "jasper",        domain: "jasper.ai",           company_name: "Jasper",               category: "ai-tools", popularity_score: 83 },
  { id: "replicate",     domain: "replicate.com",       company_name: "Replicate",            category: "ai-tools", popularity_score: 82 },
  { id: "runway",        domain: "runwayml.com",        company_name: "Runway",               category: "ai-tools", popularity_score: 86 },
  { id: "elevenlabs",    domain: "elevenlabs.io",       company_name: "ElevenLabs",           category: "ai-tools", popularity_score: 85 },
  { id: "stability",     domain: "stability.ai",        company_name: "Stability AI",         category: "ai-tools", popularity_score: 83 },
  { id: "midjourney",    domain: "midjourney.com",      company_name: "Midjourney",           category: "ai-tools", popularity_score: 89 },
  { id: "character-ai",  domain: "character.ai",        company_name: "Character.AI",         category: "ai-tools", popularity_score: 86 },
  { id: "together-ai",   domain: "together.ai",         company_name: "Together AI",          category: "ai-tools", popularity_score: 74 },
  { id: "groq",          domain: "groq.com",            company_name: "Groq",                 category: "ai-tools", popularity_score: 78 },
  { id: "pinecone",      domain: "pinecone.io",         company_name: "Pinecone",             category: "ai-tools", popularity_score: 76 },
  { id: "huggingface",   domain: "huggingface.co",      company_name: "Hugging Face",         category: "ai-tools", popularity_score: 93 },
  { id: "xai",           domain: "x.ai",                company_name: "xAI",                  category: "ai-tools", popularity_score: 88 },
  { id: "qdrant",        domain: "qdrant.tech",         company_name: "Qdrant",               category: "ai-tools", popularity_score: 66 },

  // ── Design Tools ─────────────────────────────────────────────────────────────
  { id: "figma",         domain: "figma.com",           company_name: "Figma",                category: "design-tools", popularity_score: 98 },
  { id: "canva",         domain: "canva.com",           company_name: "Canva",                category: "design-tools", popularity_score: 95 },
  { id: "webflow",       domain: "webflow.com",         company_name: "Webflow",              category: "design-tools", popularity_score: 91 },
  { id: "framer",        domain: "framer.com",          company_name: "Framer",               category: "design-tools", popularity_score: 88 },
  { id: "adobe",         domain: "adobe.com",           company_name: "Adobe Creative Cloud", category: "design-tools", popularity_score: 97 },
  { id: "miro",          domain: "miro.com",            company_name: "Miro",                 category: "design-tools", popularity_score: 90 },
  { id: "sketch",        domain: "sketch.com",          company_name: "Sketch",               category: "design-tools", popularity_score: 84 },
  { id: "invision",      domain: "invisionapp.com",     company_name: "InVision",             category: "design-tools", popularity_score: 78 },
  { id: "mural",         domain: "mural.co",            company_name: "Mural",                category: "design-tools", popularity_score: 80 },
  { id: "zeplin",        domain: "zeplin.io",           company_name: "Zeplin",               category: "design-tools", popularity_score: 76 },
  { id: "marvel",        domain: "marvelapp.com",       company_name: "Marvel",               category: "design-tools", popularity_score: 72 },
  { id: "whimsical",     domain: "whimsical.com",       company_name: "Whimsical",            category: "design-tools", popularity_score: 74 },
  { id: "spline",        domain: "spline.design",       company_name: "Spline",               category: "design-tools", popularity_score: 78 },
  { id: "penpot",        domain: "penpot.app",          company_name: "Penpot",               category: "design-tools", popularity_score: 72 },
  { id: "maze",          domain: "maze.co",             company_name: "Maze",                 category: "design-tools", popularity_score: 70 },
  { id: "uizard",        domain: "uizard.io",           company_name: "Uizard",               category: "design-tools", popularity_score: 66 },

  // ── Defense Primes ────────────────────────────────────────────────────────────
  { id: "lockheed",      domain: "lockheedmartin.com",  company_name: "Lockheed Martin",      category: "defense-primes", popularity_score: 99 },
  { id: "rtx",           domain: "rtx.com",             company_name: "RTX (Raytheon)",       category: "defense-primes", popularity_score: 98 },
  { id: "northrop",      domain: "northropgrumman.com", company_name: "Northrop Grumman",     category: "defense-primes", popularity_score: 97 },
  { id: "gd",            domain: "gd.com",              company_name: "General Dynamics",     category: "defense-primes", popularity_score: 96 },
  { id: "l3harris",      domain: "l3harris.com",        company_name: "L3Harris",             category: "defense-primes", popularity_score: 93 },
  { id: "boeing-defense",domain: "boeing.com",          company_name: "Boeing Defense",       category: "defense-primes", popularity_score: 95 },
  { id: "bae-systems",   domain: "baesystems.com",      company_name: "BAE Systems",          category: "defense-primes", popularity_score: 92 },
  { id: "leonardo-drs",  domain: "leonardodrs.com",     company_name: "Leonardo DRS",         category: "defense-primes", popularity_score: 82 },
  { id: "textron",       domain: "textron.com",         company_name: "Textron",              category: "defense-primes", popularity_score: 84 },
  { id: "huntington",    domain: "hii.com",             company_name: "HII (Huntington)",     category: "defense-primes", popularity_score: 83 },

  // ── Aerospace & Space ─────────────────────────────────────────────────────────
  { id: "spacex",        domain: "spacex.com",          company_name: "SpaceX",               category: "aerospace", popularity_score: 99 },
  { id: "blue-origin",   domain: "blueorigin.com",      company_name: "Blue Origin",          category: "aerospace", popularity_score: 88 },
  { id: "rocket-lab",    domain: "rocketlabusa.com",    company_name: "Rocket Lab",           category: "aerospace", popularity_score: 86 },
  { id: "airbus",        domain: "airbus.com",          company_name: "Airbus Defence",       category: "aerospace", popularity_score: 95 },
  { id: "kratos",        domain: "kratosdefense.com",   company_name: "Kratos Defense",       category: "aerospace", popularity_score: 78 },
  { id: "sierra-space",  domain: "sierraspace.com",     company_name: "Sierra Space",         category: "aerospace", popularity_score: 74 },
  { id: "aerojet",       domain: "rocket.com",          company_name: "Aerojet Rocketdyne",   category: "aerospace", popularity_score: 80 },
  { id: "maxar",         domain: "maxar.com",           company_name: "Maxar Technologies",   category: "aerospace", popularity_score: 77 },

  // ── Cyber & Intelligence ──────────────────────────────────────────────────────
  { id: "palantir",      domain: "palantir.com",        company_name: "Palantir",             category: "cyber-intel", popularity_score: 94 },
  { id: "anduril",       domain: "anduril.com",         company_name: "Anduril Industries",   category: "cyber-intel", popularity_score: 89 },
  { id: "shield-ai",     domain: "shield.ai",           company_name: "Shield AI",            category: "cyber-intel", popularity_score: 80 },
  { id: "crowdstrike",   domain: "crowdstrike.com",     company_name: "CrowdStrike",          category: "cyber-intel", popularity_score: 93 },
  { id: "saic-cyber",    domain: "saic.com",            company_name: "SAIC",                 category: "cyber-intel", popularity_score: 85 },
  { id: "leidos",        domain: "leidos.com",          company_name: "Leidos",               category: "cyber-intel", popularity_score: 87 },
  { id: "mitre",         domain: "mitre.org",           company_name: "MITRE",                category: "cyber-intel", popularity_score: 82 },
  { id: "sas-cyber",     domain: "sas.com",             company_name: "SAS (Defense)",        category: "cyber-intel", popularity_score: 76 },

  // ── Defense Services ──────────────────────────────────────────────────────────
  { id: "booz-allen",    domain: "boozallen.com",       company_name: "Booz Allen Hamilton",  category: "defense-services", popularity_score: 90 },
  { id: "caci",          domain: "caci.com",            company_name: "CACI",                 category: "defense-services", popularity_score: 84 },
  { id: "mantech",       domain: "mantech.com",         company_name: "ManTech",              category: "defense-services", popularity_score: 78 },
  { id: "peraton",       domain: "peraton.com",         company_name: "Peraton",              category: "defense-services", popularity_score: 76 },
  { id: "kbr-defense",   domain: "kbr.com",             company_name: "KBR",                  category: "defense-services", popularity_score: 80 },
  { id: "accenture-fed", domain: "accenturefederal.com",company_name: "Accenture Federal",    category: "defense-services", popularity_score: 82 },

  // ── Oil & Gas ─────────────────────────────────────────────────────────────────
  { id: "exxon",         domain: "exxonmobil.com",      company_name: "ExxonMobil",           category: "oil-gas", popularity_score: 99 },
  { id: "chevron",       domain: "chevron.com",         company_name: "Chevron",              category: "oil-gas", popularity_score: 98 },
  { id: "shell",         domain: "shell.com",           company_name: "Shell",                category: "oil-gas", popularity_score: 97 },
  { id: "bp",            domain: "bp.com",              company_name: "BP",                   category: "oil-gas", popularity_score: 96 },
  { id: "totalenergies", domain: "totalenergies.com",   company_name: "TotalEnergies",        category: "oil-gas", popularity_score: 95 },
  { id: "conocophillips",domain: "conocophillips.com",  company_name: "ConocoPhillips",       category: "oil-gas", popularity_score: 90 },
  { id: "pioneer",       domain: "pxd.com",             company_name: "Pioneer Natural Res.", category: "oil-gas", popularity_score: 82 },
  { id: "devon",         domain: "devonenergy.com",     company_name: "Devon Energy",         category: "oil-gas", popularity_score: 80 },
  { id: "equinor",       domain: "equinor.com",         company_name: "Equinor",              category: "oil-gas", popularity_score: 88 },
  { id: "petrobras",     domain: "petrobras.com.br",    company_name: "Petrobras",            category: "oil-gas", popularity_score: 85 },

  // ── Renewables ───────────────────────────────────────────────────────────────
  { id: "nextera",       domain: "nexteraenergy.com",   company_name: "NextEra Energy",       category: "renewables", popularity_score: 95 },
  { id: "orsted",        domain: "orsted.com",          company_name: "Ørsted",               category: "renewables", popularity_score: 90 },
  { id: "vestas",        domain: "vestas.com",          company_name: "Vestas",               category: "renewables", popularity_score: 88 },
  { id: "first-solar",   domain: "firstsolar.com",      company_name: "First Solar",          category: "renewables", popularity_score: 87 },
  { id: "enphase",       domain: "enphaseenergy.com",   company_name: "Enphase Energy",       category: "renewables", popularity_score: 86 },
  { id: "siemens-energy",domain: "siemens-energy.com",  company_name: "Siemens Energy",       category: "renewables", popularity_score: 89 },
  { id: "brookfield-re", domain: "brookfieldrenewable.com", company_name: "Brookfield Renewable", category: "renewables", popularity_score: 82 },
  { id: "sunrun",        domain: "sunrun.com",          company_name: "Sunrun",               category: "renewables", popularity_score: 78 },
  { id: "ge-vernova",    domain: "gevernova.com",       company_name: "GE Vernova",           category: "renewables", popularity_score: 85 },
  { id: "iberdrola",     domain: "iberdrola.com",       company_name: "Iberdrola",            category: "renewables", popularity_score: 84 },

  // ── Energy Services ───────────────────────────────────────────────────────────
  { id: "slb",           domain: "slb.com",             company_name: "SLB (Schlumberger)",   category: "energy-services", popularity_score: 97 },
  { id: "halliburton",   domain: "halliburton.com",     company_name: "Halliburton",          category: "energy-services", popularity_score: 95 },
  { id: "baker-hughes",  domain: "bakerhughes.com",     company_name: "Baker Hughes",         category: "energy-services", popularity_score: 93 },
  { id: "weatherford",   domain: "weatherford.com",     company_name: "Weatherford",          category: "energy-services", popularity_score: 78 },
  { id: "core-labs",     domain: "corelab.com",         company_name: "Core Laboratories",    category: "energy-services", popularity_score: 72 },
  { id: "wood-group",    domain: "woodplc.com",         company_name: "Wood Group",           category: "energy-services", popularity_score: 75 },

  // ── Energy Technology ─────────────────────────────────────────────────────────
  { id: "abb-energy",    domain: "abb.com",             company_name: "ABB",                  category: "energy-tech", popularity_score: 88 },
  { id: "schneider",     domain: "se.com",              company_name: "Schneider Electric",   category: "energy-tech", popularity_score: 87 },
  { id: "honeywell-e",   domain: "honeywell.com",       company_name: "Honeywell Energy",     category: "energy-tech", popularity_score: 85 },
  { id: "emerson",       domain: "emerson.com",         company_name: "Emerson Electric",     category: "energy-tech", popularity_score: 83 },
  { id: "osp-group",     domain: "ospregroup.com",      company_name: "Ospre Group",          category: "energy-tech", popularity_score: 62 },
  { id: "aspentech",     domain: "aspentech.com",       company_name: "AspenTech",            category: "energy-tech", popularity_score: 76 },
];
