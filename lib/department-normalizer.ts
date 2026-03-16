// Deterministic department → canonical function mapping.
//
// Maps a raw ATS department/team name to one of the canonical functions below.
// Matching is keyword-based (case-insensitive substring search) with priority ordering:
// more-specific keywords win over more-general ones.
//
// Canonical functions:
//   engineering | infrastructure | data | research | sales | marketing |
//   operations  | security | design | product | legal | finance | hr |
//   support | executive | other

export type CanonicalFunction =
  | "engineering"
  | "infrastructure"
  | "data"
  | "research"
  | "sales"
  | "marketing"
  | "operations"
  | "security"
  | "design"
  | "product"
  | "legal"
  | "finance"
  | "hr"
  | "support"
  | "executive"
  | "other";

// Each rule: list of keywords to match against lowercased department string.
// Rules are evaluated in order — first match wins.
// Put more-specific rules (e.g., "infrastructure") before broad ones ("engineering").
const RULES: Array<{ fn: CanonicalFunction; keywords: string[] }> = [
  {
    fn: "infrastructure",
    keywords: [
      "infrastructure", "infra", "devops", "dev ops", "sre",
      "site reliability", "platform engineering", "cloud ops",
      "cloud infrastructure", "network operations", "netops",
    ],
  },
  {
    fn: "security",
    keywords: [
      "security", "cybersecurity", "cyber security", "appsec",
      "information security", "infosec", "compliance", "risk",
      "trust and safety", "trust & safety", "privacy",
    ],
  },
  {
    fn: "data",
    keywords: [
      "data science", "data engineering", "data analytics",
      "analytics", "machine learning", "ml", "ai ", " ai",
      "artificial intelligence", "data platform", "data infra",
      "business intelligence", "bi ", " bi", "data warehouse",
      "data ops", "dataops", "nlp",
    ],
  },
  {
    fn: "research",
    keywords: [
      "research", "r&d", "r & d", "science", "lab", "innovation",
      "applied research", "fundamental research",
    ],
  },
  {
    fn: "engineering",
    keywords: [
      "engineering", "software", "backend", "back end", "back-end",
      "frontend", "front end", "front-end", "fullstack", "full stack",
      "full-stack", "mobile", "ios", "android", "firmware",
      "embedded", "systems", "hardware", "developer", "development",
      "technical", "tech ", " tech",
    ],
  },
  {
    fn: "product",
    keywords: [
      "product", "product management", "product manager", "pm",
      "program management", "technical program",
    ],
  },
  {
    fn: "design",
    keywords: [
      "design", "ux", "ui", "user experience", "user interface",
      "creative", "brand", "visual", "interaction", "content design",
    ],
  },
  {
    fn: "sales",
    keywords: [
      "sales", "business development", "biz dev", "account executive",
      "account management", "revenue", "growth", "partnerships",
      "alliance", "channel", "pre-sales", "presales", "solutions engineer",
      "sales engineer", "commercial",
    ],
  },
  {
    fn: "marketing",
    keywords: [
      "marketing", "demand gen", "demand generation", "content",
      "seo", "sem", "growth marketing", "field marketing",
      "product marketing", "brand marketing", "comms", "communications",
      "public relations", "pr ", " pr", "social media",
    ],
  },
  {
    fn: "hr",
    keywords: [
      "human resources", "hr", "people", "talent", "recruiting",
      "recruitment", "talent acquisition", "people ops", "people operations",
      "total rewards", "compensation", "benefits", "hrbp", "culture",
      "employee experience", "workforce",
    ],
  },
  {
    fn: "finance",
    keywords: [
      "finance", "financial", "accounting", "treasury", "tax",
      "investor relations", "fp&a", "fp & a", "financial planning",
      "audit", "controller", "cfo", "billing",
    ],
  },
  {
    fn: "legal",
    keywords: [
      "legal", "counsel", "attorney", "law", "regulatory",
      "governance", "intellectual property", "ip ", " ip",
      "contracts", "litigation",
    ],
  },
  {
    fn: "support",
    keywords: [
      "support", "customer success", "customer service", "customer care",
      "technical support", "helpdesk", "help desk", "service desk",
      "onboarding", "implementation", "professional services",
    ],
  },
  {
    fn: "operations",
    keywords: [
      "operations", "ops ", " ops", "business ops", "revenue ops",
      "revops", "sales ops", "marketing ops", "it ", " it",
      "information technology", "procurement", "supply chain",
      "facilities", "workplace", "admin", "administrative",
    ],
  },
  {
    fn: "executive",
    keywords: [
      "executive", "c-suite", "c suite", "ceo", "cto", "coo", "cmo",
      "chief", "leadership", "general manager", "managing director",
      "vp ", " vp", "vice president", "svp", "evp", "president",
    ],
  },
];

// Normalise a raw department string to a canonical function.
// Returns "other" when no rule matches.
export function normalizeDepartment(raw: string | null | undefined): CanonicalFunction {
  if (!raw || raw.trim() === "") return "other";

  const lower = raw.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.fn;
    }
  }

  return "other";
}
