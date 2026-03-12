// ── Sector catalog — default competitors per sector ───────────────────────────
//
// Used by /api/initialize-sector to seed tracked_competitors when a new user
// selects their sector during onboarding.
//
// Priorities (1 = highest, 10 = lowest) control insert order and future
// radar prominence. default_pages are the page types the runtime pipeline
// should create monitored_pages entries for.
//
// NOTE: "initialize monitoring pages" is handled by the metrivant-runtime
// pipeline, which reads tracked_competitors and creates monitored_pages entries
// on its next scheduled crawl. Inserting into tracked_competitors here is the
// correct trigger point.

export type SectorDefaultCompetitor = {
  name: string;
  domain: string;
  website_url: string;
  priority: number;
  default_pages: string[];
};

const SAAS_PAGES    = ["pricing", "features", "changelog", "blog"];
const DEFENSE_PAGES = ["capabilities", "programs", "news", "contracts"];
const ENERGY_PAGES  = ["investor-relations", "news", "projects", "operations"];

// ── SaaS ──────────────────────────────────────────────────────────────────────

const SAAS_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "Salesforce",    domain: "salesforce.com",    website_url: "https://salesforce.com",    priority: 1,  default_pages: SAAS_PAGES },
  { name: "HubSpot",       domain: "hubspot.com",       website_url: "https://hubspot.com",       priority: 2,  default_pages: SAAS_PAGES },
  { name: "Notion",        domain: "notion.so",         website_url: "https://notion.so",         priority: 3,  default_pages: SAAS_PAGES },
  { name: "GitHub",        domain: "github.com",        website_url: "https://github.com",        priority: 4,  default_pages: SAAS_PAGES },
  { name: "Figma",         domain: "figma.com",         website_url: "https://figma.com",         priority: 5,  default_pages: SAAS_PAGES },
  { name: "OpenAI",        domain: "openai.com",        website_url: "https://openai.com",        priority: 6,  default_pages: SAAS_PAGES },
  { name: "Stripe",        domain: "stripe.com",        website_url: "https://stripe.com",        priority: 7,  default_pages: SAAS_PAGES },
  { name: "Datadog",       domain: "datadoghq.com",     website_url: "https://datadoghq.com",     priority: 8,  default_pages: SAAS_PAGES },
  { name: "Vercel",        domain: "vercel.com",        website_url: "https://vercel.com",        priority: 9,  default_pages: SAAS_PAGES },
  { name: "Anthropic",     domain: "anthropic.com",     website_url: "https://anthropic.com",     priority: 10, default_pages: SAAS_PAGES },
];

// ── Defense ───────────────────────────────────────────────────────────────────

const DEFENSE_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "Lockheed Martin",  domain: "lockheedmartin.com",  website_url: "https://lockheedmartin.com",  priority: 1,  default_pages: DEFENSE_PAGES },
  { name: "Raytheon",         domain: "rtx.com",             website_url: "https://rtx.com",             priority: 2,  default_pages: DEFENSE_PAGES },
  { name: "BAE Systems",      domain: "baesystems.com",      website_url: "https://baesystems.com",      priority: 3,  default_pages: DEFENSE_PAGES },
  { name: "Northrop Grumman", domain: "northropgrumman.com", website_url: "https://northropgrumman.com", priority: 4,  default_pages: DEFENSE_PAGES },
  { name: "General Dynamics", domain: "gd.com",              website_url: "https://gd.com",              priority: 5,  default_pages: DEFENSE_PAGES },
  { name: "Palantir",         domain: "palantir.com",        website_url: "https://palantir.com",        priority: 6,  default_pages: DEFENSE_PAGES },
  { name: "Anduril",          domain: "anduril.com",         website_url: "https://anduril.com",         priority: 7,  default_pages: DEFENSE_PAGES },
  { name: "Thales",           domain: "thalesgroup.com",     website_url: "https://thalesgroup.com",     priority: 8,  default_pages: DEFENSE_PAGES },
  { name: "Saab",             domain: "saab.com",            website_url: "https://saab.com",            priority: 9,  default_pages: DEFENSE_PAGES },
  { name: "Rheinmetall",      domain: "rheinmetall.com",     website_url: "https://rheinmetall.com",     priority: 10, default_pages: DEFENSE_PAGES },
];

// ── Energy ────────────────────────────────────────────────────────────────────

const ENERGY_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "ExxonMobil",      domain: "exxonmobil.com",     website_url: "https://exxonmobil.com",     priority: 1,  default_pages: ENERGY_PAGES },
  { name: "Chevron",         domain: "chevron.com",         website_url: "https://chevron.com",        priority: 2,  default_pages: ENERGY_PAGES },
  { name: "Shell",           domain: "shell.com",           website_url: "https://shell.com",          priority: 3,  default_pages: ENERGY_PAGES },
  { name: "BP",              domain: "bp.com",              website_url: "https://bp.com",             priority: 4,  default_pages: ENERGY_PAGES },
  { name: "TotalEnergies",   domain: "totalenergies.com",   website_url: "https://totalenergies.com",  priority: 5,  default_pages: ENERGY_PAGES },
  { name: "Saudi Aramco",    domain: "aramco.com",          website_url: "https://aramco.com",         priority: 6,  default_pages: ENERGY_PAGES },
  { name: "Equinor",         domain: "equinor.com",         website_url: "https://equinor.com",        priority: 7,  default_pages: ENERGY_PAGES },
  { name: "Petrobras",       domain: "petrobras.com.br",    website_url: "https://petrobras.com.br",   priority: 8,  default_pages: ENERGY_PAGES },
  { name: "ConocoPhillips",  domain: "conocophillips.com",  website_url: "https://conocophillips.com", priority: 9,  default_pages: ENERGY_PAGES },
  { name: "Eni",             domain: "eni.com",             website_url: "https://eni.com",            priority: 10, default_pages: ENERGY_PAGES },
];

// ── Cybersecurity ─────────────────────────────────────────────────────────────

const CYBER_PAGES = ["products", "pricing", "blog", "research"];

const CYBERSECURITY_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "CrowdStrike",  domain: "crowdstrike.com",  website_url: "https://crowdstrike.com",  priority: 1,  default_pages: CYBER_PAGES },
  { name: "Palo Alto Networks", domain: "paloaltonetworks.com", website_url: "https://paloaltonetworks.com", priority: 2, default_pages: CYBER_PAGES },
  { name: "SentinelOne",  domain: "sentinelone.com",  website_url: "https://sentinelone.com",  priority: 3,  default_pages: CYBER_PAGES },
  { name: "Fortinet",     domain: "fortinet.com",     website_url: "https://fortinet.com",     priority: 4,  default_pages: CYBER_PAGES },
  { name: "Okta",         domain: "okta.com",         website_url: "https://okta.com",         priority: 5,  default_pages: CYBER_PAGES },
  { name: "Zscaler",      domain: "zscaler.com",      website_url: "https://zscaler.com",      priority: 6,  default_pages: CYBER_PAGES },
  { name: "Wiz",          domain: "wiz.io",           website_url: "https://wiz.io",           priority: 7,  default_pages: CYBER_PAGES },
  { name: "Cloudflare",   domain: "cloudflare.com",   website_url: "https://cloudflare.com",   priority: 8,  default_pages: CYBER_PAGES },
  { name: "Rapid7",       domain: "rapid7.com",       website_url: "https://rapid7.com",       priority: 9,  default_pages: CYBER_PAGES },
  { name: "Tenable",      domain: "tenable.com",      website_url: "https://tenable.com",      priority: 10, default_pages: CYBER_PAGES },
];

// ── Fintech ───────────────────────────────────────────────────────────────────

const FINTECH_PAGES = ["pricing", "features", "blog", "changelog"];

const FINTECH_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "Stripe",    domain: "stripe.com",   website_url: "https://stripe.com",   priority: 1, default_pages: FINTECH_PAGES },
  { name: "Brex",      domain: "brex.com",     website_url: "https://brex.com",     priority: 2, default_pages: FINTECH_PAGES },
  { name: "Plaid",     domain: "plaid.com",    website_url: "https://plaid.com",    priority: 3, default_pages: FINTECH_PAGES },
  { name: "Adyen",     domain: "adyen.com",    website_url: "https://adyen.com",    priority: 4, default_pages: FINTECH_PAGES },
  { name: "Mercury",   domain: "mercury.com",  website_url: "https://mercury.com",  priority: 5, default_pages: FINTECH_PAGES },
  { name: "Ramp",      domain: "ramp.com",     website_url: "https://ramp.com",     priority: 6, default_pages: FINTECH_PAGES },
  { name: "Rippling",  domain: "rippling.com", website_url: "https://rippling.com", priority: 7, default_pages: FINTECH_PAGES },
  { name: "Marqeta",   domain: "marqeta.com",  website_url: "https://marqeta.com",  priority: 8, default_pages: FINTECH_PAGES },
  { name: "Chime",     domain: "chime.com",    website_url: "https://chime.com",    priority: 9, default_pages: FINTECH_PAGES },
  { name: "Robinhood", domain: "robinhood.com",website_url: "https://robinhood.com",priority: 10, default_pages: FINTECH_PAGES },
];

// ── AI Infrastructure ─────────────────────────────────────────────────────────

const AI_PAGES = ["pricing", "docs", "blog", "changelog"];

const AI_INFRASTRUCTURE_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "OpenAI",        domain: "openai.com",        website_url: "https://openai.com",        priority: 1,  default_pages: AI_PAGES },
  { name: "Anthropic",     domain: "anthropic.com",     website_url: "https://anthropic.com",     priority: 2,  default_pages: AI_PAGES },
  { name: "Mistral",       domain: "mistral.ai",        website_url: "https://mistral.ai",        priority: 3,  default_pages: AI_PAGES },
  { name: "Groq",          domain: "groq.com",          website_url: "https://groq.com",          priority: 4,  default_pages: AI_PAGES },
  { name: "Together AI",   domain: "together.ai",       website_url: "https://together.ai",       priority: 5,  default_pages: AI_PAGES },
  { name: "Replicate",     domain: "replicate.com",     website_url: "https://replicate.com",     priority: 6,  default_pages: AI_PAGES },
  { name: "Hugging Face",  domain: "huggingface.co",    website_url: "https://huggingface.co",    priority: 7,  default_pages: AI_PAGES },
  { name: "Cohere",        domain: "cohere.com",        website_url: "https://cohere.com",        priority: 8,  default_pages: AI_PAGES },
  { name: "xAI",           domain: "x.ai",              website_url: "https://x.ai",              priority: 9,  default_pages: AI_PAGES },
  { name: "Pinecone",      domain: "pinecone.io",       website_url: "https://pinecone.io",       priority: 10, default_pages: AI_PAGES },
];

// ── DevTools ──────────────────────────────────────────────────────────────────

const DEVTOOLS_PAGES = ["pricing", "changelog", "docs", "blog"];

const DEVTOOLS_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "GitHub",        domain: "github.com",        website_url: "https://github.com",        priority: 1,  default_pages: DEVTOOLS_PAGES },
  { name: "GitLab",        domain: "gitlab.com",        website_url: "https://gitlab.com",        priority: 2,  default_pages: DEVTOOLS_PAGES },
  { name: "Vercel",        domain: "vercel.com",        website_url: "https://vercel.com",        priority: 3,  default_pages: DEVTOOLS_PAGES },
  { name: "Netlify",       domain: "netlify.com",       website_url: "https://netlify.com",       priority: 4,  default_pages: DEVTOOLS_PAGES },
  { name: "Datadog",       domain: "datadoghq.com",     website_url: "https://datadoghq.com",     priority: 5,  default_pages: DEVTOOLS_PAGES },
  { name: "Supabase",      domain: "supabase.com",      website_url: "https://supabase.com",      priority: 6,  default_pages: DEVTOOLS_PAGES },
  { name: "HashiCorp",     domain: "hashicorp.com",     website_url: "https://hashicorp.com",     priority: 7,  default_pages: DEVTOOLS_PAGES },
  { name: "Retool",        domain: "retool.com",        website_url: "https://retool.com",        priority: 8,  default_pages: DEVTOOLS_PAGES },
  { name: "Neon",          domain: "neon.tech",         website_url: "https://neon.tech",         priority: 9,  default_pages: DEVTOOLS_PAGES },
  { name: "Render",        domain: "render.com",        website_url: "https://render.com",        priority: 10, default_pages: DEVTOOLS_PAGES },
];

// ── Healthcare ────────────────────────────────────────────────────────────────

const HEALTH_PAGES = ["products", "solutions", "news", "blog"];

const HEALTHCARE_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "Epic Systems",   domain: "epic.com",          website_url: "https://epic.com",          priority: 1,  default_pages: HEALTH_PAGES },
  { name: "Veeva Systems",  domain: "veeva.com",         website_url: "https://veeva.com",         priority: 2,  default_pages: HEALTH_PAGES },
  { name: "Cerner",         domain: "oracle.com/health", website_url: "https://oracle.com/health", priority: 3,  default_pages: HEALTH_PAGES },
  { name: "Doximity",       domain: "doximity.com",      website_url: "https://doximity.com",      priority: 4,  default_pages: HEALTH_PAGES },
  { name: "Nuvation Health",domain: "nuance.com",        website_url: "https://nuance.com",        priority: 5,  default_pages: HEALTH_PAGES },
  { name: "Athenahealth",   domain: "athenahealth.com",  website_url: "https://athenahealth.com",  priority: 6,  default_pages: HEALTH_PAGES },
  { name: "Phreesia",       domain: "phreesia.com",      website_url: "https://phreesia.com",      priority: 7,  default_pages: HEALTH_PAGES },
  { name: "Samsara",        domain: "samsara.com",       website_url: "https://samsara.com",       priority: 8,  default_pages: HEALTH_PAGES },
  { name: "Health Catalyst",domain: "healthcatalyst.com",website_url: "https://healthcatalyst.com",priority: 9,  default_pages: HEALTH_PAGES },
  { name: "Evolent Health", domain: "evolent.com",       website_url: "https://evolent.com",       priority: 10, default_pages: HEALTH_PAGES },
];

// ── Consumer Tech ─────────────────────────────────────────────────────────────

const CONSUMER_PAGES = ["pricing", "features", "blog", "press"];

const CONSUMER_TECH_DEFAULTS: SectorDefaultCompetitor[] = [
  { name: "Apple",     domain: "apple.com",    website_url: "https://apple.com",    priority: 1,  default_pages: CONSUMER_PAGES },
  { name: "Samsung",   domain: "samsung.com",  website_url: "https://samsung.com",  priority: 2,  default_pages: CONSUMER_PAGES },
  { name: "Google",    domain: "google.com",   website_url: "https://google.com",   priority: 3,  default_pages: CONSUMER_PAGES },
  { name: "Meta",      domain: "meta.com",     website_url: "https://meta.com",     priority: 4,  default_pages: CONSUMER_PAGES },
  { name: "Spotify",   domain: "spotify.com",  website_url: "https://spotify.com",  priority: 5,  default_pages: CONSUMER_PAGES },
  { name: "Netflix",   domain: "netflix.com",  website_url: "https://netflix.com",  priority: 6,  default_pages: CONSUMER_PAGES },
  { name: "Airbnb",    domain: "airbnb.com",   website_url: "https://airbnb.com",   priority: 7,  default_pages: CONSUMER_PAGES },
  { name: "Uber",      domain: "uber.com",     website_url: "https://uber.com",     priority: 8,  default_pages: CONSUMER_PAGES },
  { name: "DoorDash",  domain: "doordash.com", website_url: "https://doordash.com", priority: 9,  default_pages: CONSUMER_PAGES },
  { name: "Pinterest", domain: "pinterest.com",website_url: "https://pinterest.com",priority: 10, default_pages: CONSUMER_PAGES },
];

// ── Catalog map ───────────────────────────────────────────────────────────────

export const SECTOR_CATALOG: Record<string, SectorDefaultCompetitor[]> = {
  saas:              SAAS_DEFAULTS,
  defense:           DEFENSE_DEFAULTS,
  energy:            ENERGY_DEFAULTS,
  cybersecurity:     CYBERSECURITY_DEFAULTS,
  fintech:           FINTECH_DEFAULTS,
  "ai-infrastructure": AI_INFRASTRUCTURE_DEFAULTS,
  devtools:          DEVTOOLS_DEFAULTS,
  healthcare:        HEALTHCARE_DEFAULTS,
  "consumer-tech":   CONSUMER_TECH_DEFAULTS,
  // "custom" has no defaults — user adds manually
};

/** Returns default competitors for a sector, or empty array for unknown sectors. */
export function getSectorDefaults(sector: string): SectorDefaultCompetitor[] {
  return SECTOR_CATALOG[sector] ?? [];
}
