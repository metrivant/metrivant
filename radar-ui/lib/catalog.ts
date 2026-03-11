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
  // Project Management
  { id: "notion",    domain: "notion.so",      company_name: "Notion",         category: "project-management", popularity_score: 98 },
  { id: "linear",    domain: "linear.app",     company_name: "Linear",         category: "project-management", popularity_score: 94 },
  { id: "asana",     domain: "asana.com",      company_name: "Asana",          category: "project-management", popularity_score: 96 },
  { id: "monday",    domain: "monday.com",     company_name: "Monday.com",     category: "project-management", popularity_score: 95 },
  { id: "clickup",   domain: "clickup.com",    company_name: "ClickUp",        category: "project-management", popularity_score: 91 },
  { id: "basecamp",  domain: "basecamp.com",   company_name: "Basecamp",       category: "project-management", popularity_score: 82 },
  { id: "todoist",   domain: "todoist.com",    company_name: "Todoist",        category: "project-management", popularity_score: 85 },
  { id: "height",    domain: "height.app",     company_name: "Height",         category: "project-management", popularity_score: 68 },
  { id: "jira",      domain: "atlassian.com",  company_name: "Jira",           category: "project-management", popularity_score: 97 },

  // Developer Tools
  { id: "vercel",       domain: "vercel.com",       company_name: "Vercel",       category: "developer-tools", popularity_score: 95 },
  { id: "supabase",     domain: "supabase.com",     company_name: "Supabase",     category: "developer-tools", popularity_score: 90 },
  { id: "netlify",      domain: "netlify.com",      company_name: "Netlify",      category: "developer-tools", popularity_score: 88 },
  { id: "render",       domain: "render.com",       company_name: "Render",       category: "developer-tools", popularity_score: 82 },
  { id: "railway",      domain: "railway.app",      company_name: "Railway",      category: "developer-tools", popularity_score: 78 },
  { id: "sentry",       domain: "sentry.io",        company_name: "Sentry",       category: "developer-tools", popularity_score: 91 },
  { id: "datadog",      domain: "datadoghq.com",    company_name: "Datadog",      category: "developer-tools", popularity_score: 94 },
  { id: "planetscale",  domain: "planetscale.com",  company_name: "PlanetScale",  category: "developer-tools", popularity_score: 80 },
  { id: "neon",         domain: "neon.tech",        company_name: "Neon",         category: "developer-tools", popularity_score: 74 },
  { id: "turso",        domain: "turso.tech",       company_name: "Turso",        category: "developer-tools", popularity_score: 64 },

  // Analytics
  { id: "mixpanel",   domain: "mixpanel.com",   company_name: "Mixpanel",   category: "analytics", popularity_score: 90 },
  { id: "amplitude",  domain: "amplitude.com",  company_name: "Amplitude",  category: "analytics", popularity_score: 91 },
  { id: "posthog",    domain: "posthog.com",    company_name: "PostHog",    category: "analytics", popularity_score: 85 },
  { id: "segment",    domain: "segment.com",    company_name: "Segment",    category: "analytics", popularity_score: 88 },
  { id: "heap",       domain: "heap.io",        company_name: "Heap",       category: "analytics", popularity_score: 80 },
  { id: "fullstory",  domain: "fullstory.com",  company_name: "FullStory",  category: "analytics", popularity_score: 82 },
  { id: "hotjar",     domain: "hotjar.com",     company_name: "Hotjar",     category: "analytics", popularity_score: 86 },
  { id: "metabase",   domain: "metabase.com",   company_name: "Metabase",   category: "analytics", popularity_score: 84 },
  { id: "june",       domain: "june.so",        company_name: "June",       category: "analytics", popularity_score: 70 },

  // CRM
  { id: "hubspot",    domain: "hubspot.com",    company_name: "HubSpot",    category: "crm", popularity_score: 96 },
  { id: "salesforce", domain: "salesforce.com", company_name: "Salesforce", category: "crm", popularity_score: 99 },
  { id: "pipedrive",  domain: "pipedrive.com",  company_name: "Pipedrive",  category: "crm", popularity_score: 87 },
  { id: "close",      domain: "close.com",      company_name: "Close",      category: "crm", popularity_score: 80 },
  { id: "attio",      domain: "attio.com",      company_name: "Attio",      category: "crm", popularity_score: 76 },
  { id: "streak",     domain: "streak.com",     company_name: "Streak",     category: "crm", popularity_score: 72 },
  { id: "apollo",     domain: "apollo.io",      company_name: "Apollo",     category: "crm", popularity_score: 86 },

  // AI Tools
  { id: "openai",     domain: "openai.com",     company_name: "OpenAI",     category: "ai-tools", popularity_score: 99 },
  { id: "anthropic",  domain: "anthropic.com",  company_name: "Anthropic",  category: "ai-tools", popularity_score: 96 },
  { id: "perplexity", domain: "perplexity.ai",  company_name: "Perplexity", category: "ai-tools", popularity_score: 91 },
  { id: "cursor",     domain: "cursor.sh",      company_name: "Cursor",     category: "ai-tools", popularity_score: 88 },
  { id: "jasper",     domain: "jasper.ai",      company_name: "Jasper",     category: "ai-tools", popularity_score: 83 },
  { id: "cohere",     domain: "cohere.com",     company_name: "Cohere",     category: "ai-tools", popularity_score: 85 },
  { id: "replicate",  domain: "replicate.com",  company_name: "Replicate",  category: "ai-tools", popularity_score: 82 },
  { id: "mistral",    domain: "mistral.ai",     company_name: "Mistral",    category: "ai-tools", popularity_score: 87 },

  // Design Tools
  { id: "figma",    domain: "figma.com",     company_name: "Figma",    category: "design-tools", popularity_score: 98 },
  { id: "sketch",   domain: "sketch.com",    company_name: "Sketch",   category: "design-tools", popularity_score: 84 },
  { id: "framer",   domain: "framer.com",    company_name: "Framer",   category: "design-tools", popularity_score: 88 },
  { id: "webflow",  domain: "webflow.com",   company_name: "Webflow",  category: "design-tools", popularity_score: 91 },
  { id: "canva",    domain: "canva.com",     company_name: "Canva",    category: "design-tools", popularity_score: 95 },
  { id: "spline",   domain: "spline.design", company_name: "Spline",   category: "design-tools", popularity_score: 78 },
  { id: "penpot",   domain: "penpot.app",    company_name: "Penpot",   category: "design-tools", popularity_score: 72 },
];
