// Per-sector keyword allowlists for media narrative detection.
//
// Only article title tokens matching these terms (or bigrams containing them)
// contribute to cluster detection. Keeps noise from generic words out of
// sector_narratives.
//
// To tune: add/remove terms here. No code changes required elsewhere.
// Terms are lowercase; matching is case-insensitive at extraction time.
//
// Sector IDs match organizations.sector values in the Metrivant database.

export type SectorAllowlist = Record<string, readonly string[]>;

export const SECTOR_KEYWORD_ALLOWLISTS: SectorAllowlist = {

  defense: [
    "autonomy", "autonomous", "isr", "jadc2", "hypersonic", "directed energy",
    "electronic warfare", "c2", "c4isr", "loitering munition", "drone", "uav",
    "uas", "counter-uas", "counter-drone", "missile defense", "interceptor",
    "satellite", "space domain", "cyber warfare", "stealth", "fifth generation",
    "sixth generation", "fighter", "bomber", "submarine", "destroyer", "frigate",
    "aircraft carrier", "amphibious", "littoral", "special operations", "socom",
    "darpa", "dod", "pentagon", "nato", "indo-pacific", "pacific command",
    "procurement", "contract award", "rfp", "solicitation", "foreign military sale",
    "fms", "itar", "export control", "budget request", "continuing resolution",
    "ndaa", "readiness", "sustainment", "logistics", "supply chain",
    "munitions", "ammunition", "artillery", "armor", "ground vehicle",
    "command post", "network", "resilience", "contested environment",
  ],

  energy: [
    "renewable", "solar", "wind", "offshore wind", "onshore wind", "pv",
    "photovoltaic", "battery storage", "grid storage", "energy storage",
    "hydrogen", "green hydrogen", "electrolysis", "fuel cell", "nuclear",
    "small modular reactor", "smr", "lng", "liquefied natural gas",
    "natural gas", "pipeline", "refinery", "upstream", "downstream",
    "midstream", "oil price", "crude", "brent", "wti", "opec", "opec+",
    "carbon capture", "ccs", "ccus", "emissions", "decarbonization",
    "net zero", "carbon neutral", "esg", "energy transition",
    "grid operator", "transmission", "distribution", "interconnection",
    "capacity market", "ppa", "power purchase agreement", "offtake",
    "utility", "rate case", "ferc", "nerc", "microgrid", "virtual power plant",
    "demand response", "ev charging", "electrification", "heat pump",
    "geothermal", "tidal", "hydropower",
  ],

  cybersecurity: [
    "zero trust", "ransomware", "endpoint", "edr", "xdr", "siem", "soar",
    "threat intelligence", "apt", "nation state", "supply chain attack",
    "vulnerability", "cve", "patch", "exploit", "zero day", "zero-day",
    "phishing", "social engineering", "credential", "identity", "iam",
    "privileged access", "pam", "mfa", "authentication", "sso",
    "cloud security", "posture", "cspm", "cwpp", "cnapp", "devsecops",
    "secure by design", "cisa", "nist", "cyber incident", "breach",
    "data breach", "exfiltration", "lateral movement", "persistence",
    "command and control", "c2", "botnet", "malware", "spyware",
    "encryption", "key management", "pki", "certificate", "tls",
    "penetration testing", "red team", "bug bounty", "responsible disclosure",
    "operational technology", "ot security", "ics", "scada", "critical infrastructure",
    "ai security", "llm security", "prompt injection",
  ],

  "ai-infrastructure": [
    "foundation model", "large language model", "llm", "generative ai",
    "multimodal", "fine-tuning", "rlhf", "reinforcement learning",
    "inference", "training compute", "gpu cluster", "h100", "b200",
    "tensor processing", "tpu", "accelerator", "data center ai",
    "model evaluation", "benchmark", "evals", "alignment", "safety",
    "hallucination", "retrieval augmented", "rag", "vector database",
    "embedding", "semantic search", "agent", "agentic", "autonomous agent",
    "tool use", "function calling", "orchestration", "workflow automation",
    "mlops", "model serving", "model deployment", "inference cost",
    "context window", "tokenization", "quantization", "distillation",
    "open source model", "open weight", "proprietary model", "api",
    "enterprise ai", "ai governance", "regulation", "ai act",
    "synthetic data", "data labeling", "annotation", "dataset",
    "diffusion model", "image generation", "video generation", "code generation",
  ],

  fintech: [
    "payments", "payment processing", "acquiring", "issuing", "interchange",
    "card network", "visa", "mastercard", "real-time payment", "rtp",
    "faster payments", "ach", "wire transfer", "cross-border payment",
    "remittance", "fx", "foreign exchange", "stablecoin", "cbdc",
    "central bank digital currency", "cryptocurrency", "blockchain",
    "defi", "decentralized finance", "neobank", "challenger bank",
    "embedded finance", "banking as a service", "baas", "open banking",
    "api banking", "buy now pay later", "bnpl", "lending", "credit scoring",
    "underwriting", "kyc", "aml", "compliance", "regtech", "fraud detection",
    "chargeback", "dispute", "tokenization", "wallet", "digital wallet",
    "wealthtech", "robo-advisor", "algorithmic trading", "clearinghouse",
    "settlement", "custody", "brokerage", "ipo", "spac", "valuation",
    "funding round", "series a", "series b", "fintech regulation",
  ],

  healthcare: [
    "clinical trial", "phase 1", "phase 2", "phase 3", "fda approval",
    "510k", "pma", "breakthrough therapy", "fast track", "priority review",
    "ehr", "electronic health record", "interoperability", "fhir",
    "telehealth", "telemedicine", "remote patient monitoring", "rpm",
    "digital health", "health ai", "clinical decision support", "cds",
    "genomics", "precision medicine", "oncology", "immunotherapy",
    "gene therapy", "cell therapy", "radiopharmaceutical", "biosimilar",
    "drug pricing", "formulary", "pharmacy benefit", "pbm",
    "value-based care", "bundled payment", "accountable care", "aco",
    "prior authorization", "claims", "revenue cycle", "coding",
    "medicare", "medicaid", "cms", "reimbursement", "hospital system",
    "health plan", "payer", "provider", "ambulatory", "surgical center",
    "mental health", "behavioral health", "addiction", "substance use",
    "public health", "epidemic", "outbreak", "vaccine", "wearable",
  ],

  devtools: [
    "developer experience", "dx", "ci/cd", "continuous integration",
    "continuous delivery", "pipeline", "github actions", "gitops",
    "kubernetes", "k8s", "container", "docker", "service mesh", "istio",
    "observability", "tracing", "logging", "metrics", "opentelemetry",
    "platform engineering", "internal developer platform", "idp",
    "infrastructure as code", "iac", "terraform", "pulumi", "crossplane",
    "api gateway", "graphql", "rest api", "grpc", "event streaming",
    "kafka", "message queue", "serverless", "edge computing", "wasm",
    "webassembly", "ide", "code editor", "lsp", "copilot", "ai coding",
    "code review", "static analysis", "linting", "testing", "tdd",
    "feature flag", "a/b testing", "canary", "blue-green", "rollout",
    "monorepo", "polyrepo", "package manager", "dependency", "supply chain",
    "open source", "license", "sdk", "cli", "terminal", "shell",
    "database", "orm", "migration", "query optimization", "caching",
  ],

  "consumer-tech": [
    "smartphone", "iphone", "android", "foldable", "wearable", "smartwatch",
    "airpods", "earbuds", "headphones", "spatial audio", "augmented reality",
    "ar", "virtual reality", "vr", "mixed reality", "mr", "vision pro",
    "app store", "play store", "subscription", "streaming", "platform",
    "social media", "short video", "creator economy", "influencer",
    "gaming", "console", "cloud gaming", "esports", "marketplace",
    "e-commerce", "super app", "digital wallet", "tap to pay",
    "privacy", "data collection", "tracking", "cookie", "antitrust",
    "regulation", "digital markets", "dma", "app sideloading",
    "chip", "silicon", "processor", "battery", "charging", "usb-c",
    "5g", "connectivity", "satellite internet", "starlink",
    "smart home", "iot", "home automation", "voice assistant",
    "ai features", "on-device ai", "neural engine",
  ],

  saas: [
    "arr", "annual recurring revenue", "mrr", "net revenue retention",
    "nrr", "churn", "expansion revenue", "land and expand", "plg",
    "product led growth", "self-serve", "freemium", "enterprise sales",
    "seat-based", "usage-based pricing", "consumption pricing",
    "multi-tenant", "single-tenant", "private cloud", "hybrid cloud",
    "horizontal saas", "vertical saas", "platform play", "workflow automation",
    "low-code", "no-code", "integration", "marketplace", "ecosystem",
    "api-first", "data platform", "analytics", "bi", "business intelligence",
    "crm", "erp", "hrm", "hcm", "procurement software", "source to pay",
    "contract lifecycle", "clm", "security posture", "compliance management",
    "identity governance", "endpoint management", "mdm", "collaboration",
    "productivity", "project management", "customer success", "support",
    "ai features", "copilot", "automation", "workflow", "agent",
    "series a", "series b", "growth round", "ipo readiness", "m&a",
    "consolidation", "category leader", "market share",
  ],

};

// Return the allowlist for a given sector (case-insensitive).
// Returns an empty array if the sector has no configured allowlist.
export function getAllowlistForSector(sector: string): readonly string[] {
  return SECTOR_KEYWORD_ALLOWLISTS[sector.toLowerCase()] ?? [];
}

// Return all sectors that have a configured allowlist.
export function getConfiguredAllowlistSectors(): string[] {
  return Object.keys(SECTOR_KEYWORD_ALLOWLISTS);
}
