// Curated sector media source configuration.
//
// Each source is a manually selected RSS feed covering a specific sector.
// 5–10 feeds per sector. No automated discovery.
//
// Sector IDs match organizations.sector values in the Metrivant database.
//
// To add or remove a source: edit this file. No code changes required elsewhere.
// The ingestion handler reads SECTOR_MEDIA_SOURCES at runtime.

export interface MediaSource {
  sector:      string;
  source_name: string;
  feed_url:    string;
}

export const SECTOR_MEDIA_SOURCES: MediaSource[] = [

  // ── Defense ─────────────────────────────────────────────────────────────────
  { sector: "defense", source_name: "Defense News",       feed_url: "https://www.defensenews.com/arc/outboundfeeds/rss/" },
  { sector: "defense", source_name: "Breaking Defense",   feed_url: "https://breakingdefense.com/feed/" },
  { sector: "defense", source_name: "Defense One",        feed_url: "https://www.defenseone.com/rss/all/" },
  { sector: "defense", source_name: "USNI News",          feed_url: "https://news.usni.org/feed" },
  { sector: "defense", source_name: "The War Zone",       feed_url: "https://www.thedrive.com/the-war-zone/rss" },
  { sector: "defense", source_name: "Janes",              feed_url: "https://www.janes.com/feeds/news" },
  { sector: "defense", source_name: "National Defense",   feed_url: "https://www.nationaldefensemagazine.org/rss/articles" },

  // ── Energy ──────────────────────────────────────────────────────────────────
  { sector: "energy", source_name: "Utility Dive",        feed_url: "https://www.utilitydive.com/feeds/news/" },
  { sector: "energy", source_name: "Energy Monitor",      feed_url: "https://www.energymonitor.ai/feed/" },
  { sector: "energy", source_name: "Rigzone",             feed_url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx" },
  { sector: "energy", source_name: "Upstream Online",     feed_url: "https://www.upstreamonline.com/rss" },
  { sector: "energy", source_name: "Renew Economy",       feed_url: "https://reneweconomy.com.au/feed/" },
  { sector: "energy", source_name: "Oil Price",           feed_url: "https://oilprice.com/rss/main" },
  { sector: "energy", source_name: "PV Tech",             feed_url: "https://www.pv-tech.org/feed/" },

  // ── Cybersecurity ────────────────────────────────────────────────────────────
  { sector: "cybersecurity", source_name: "Dark Reading",       feed_url: "https://www.darkreading.com/rss.xml" },
  { sector: "cybersecurity", source_name: "The Record",         feed_url: "https://therecord.media/feed" },
  { sector: "cybersecurity", source_name: "BleepingComputer",   feed_url: "https://www.bleepingcomputer.com/feed/" },
  { sector: "cybersecurity", source_name: "Krebs on Security",  feed_url: "https://krebsonsecurity.com/feed/" },
  { sector: "cybersecurity", source_name: "SecurityWeek",       feed_url: "https://feeds.feedburner.com/Securityweek" },
  { sector: "cybersecurity", source_name: "Threatpost",         feed_url: "https://threatpost.com/feed/" },
  { sector: "cybersecurity", source_name: "SC Media",           feed_url: "https://www.scmagazine.com/feed" },

  // ── AI Infrastructure ────────────────────────────────────────────────────────
  { sector: "ai-infrastructure", source_name: "MIT Tech Review AI", feed_url: "https://www.technologyreview.com/feed/" },
  { sector: "ai-infrastructure", source_name: "Import AI",           feed_url: "https://importai.substack.com/feed" },
  { sector: "ai-infrastructure", source_name: "The Batch",           feed_url: "https://www.deeplearning.ai/the-batch/rss/" },
  { sector: "ai-infrastructure", source_name: "VentureBeat AI",      feed_url: "https://venturebeat.com/category/ai/feed/" },
  { sector: "ai-infrastructure", source_name: "AI Business",         feed_url: "https://aibusiness.com/rss.xml" },
  { sector: "ai-infrastructure", source_name: "Synced AI",           feed_url: "https://syncedreview.com/feed/" },

  // ── Fintech ──────────────────────────────────────────────────────────────────
  { sector: "fintech", source_name: "Finextra",          feed_url: "https://www.finextra.com/rss/rss.aspx" },
  { sector: "fintech", source_name: "TechCrunch Fintech", feed_url: "https://techcrunch.com/tag/fintech/feed/" },
  { sector: "fintech", source_name: "Bankless Times",    feed_url: "https://www.banklesstimes.com/feed/" },
  { sector: "fintech", source_name: "Payments Source",   feed_url: "https://www.paymentssource.com/feed" },
  { sector: "fintech", source_name: "The Paypers",       feed_url: "https://thepaypers.com/rss/payment-news.rss" },
  { sector: "fintech", source_name: "Crowdfund Insider",  feed_url: "https://www.crowdfundinsider.com/feed/" },

  // ── Healthcare ───────────────────────────────────────────────────────────────
  { sector: "healthcare", source_name: "STAT News",             feed_url: "https://www.statnews.com/feed/" },
  { sector: "healthcare", source_name: "MedCity News",          feed_url: "https://medcitynews.com/feed/" },
  { sector: "healthcare", source_name: "Healthcare IT News",    feed_url: "https://www.healthcareitnews.com/rss" },
  { sector: "healthcare", source_name: "Modern Healthcare",     feed_url: "https://www.modernhealthcare.com/section/rss" },
  { sector: "healthcare", source_name: "FierceHealthcare",      feed_url: "https://www.fiercehealthcare.com/rss/xml" },
  { sector: "healthcare", source_name: "Becker's Health IT",    feed_url: "https://www.beckershospitalreview.com/health-it-analytics-quality.rss" },

  // ── Dev Tools ────────────────────────────────────────────────────────────────
  { sector: "devtools", source_name: "Hacker News",        feed_url: "https://hnrss.org/frontpage" },
  { sector: "devtools", source_name: "The Changelog",      feed_url: "https://changelog.com/news/feed" },
  { sector: "devtools", source_name: "The New Stack",      feed_url: "https://thenewstack.io/feed/" },
  { sector: "devtools", source_name: "InfoQ",              feed_url: "https://www.infoq.com/feed" },
  { sector: "devtools", source_name: "Dev.to",             feed_url: "https://dev.to/feed" },
  { sector: "devtools", source_name: "Smashing Magazine",  feed_url: "https://www.smashingmagazine.com/feed" },

  // ── Consumer Tech ────────────────────────────────────────────────────────────
  { sector: "consumer-tech", source_name: "The Verge",    feed_url: "https://www.theverge.com/rss/index.xml" },
  { sector: "consumer-tech", source_name: "Ars Technica", feed_url: "https://feeds.arstechnica.com/arstechnica/index" },
  { sector: "consumer-tech", source_name: "TechCrunch",   feed_url: "https://techcrunch.com/feed/" },
  { sector: "consumer-tech", source_name: "Wired",        feed_url: "https://www.wired.com/feed/rss" },
  { sector: "consumer-tech", source_name: "Engadget",     feed_url: "https://www.engadget.com/rss.xml" },
  { sector: "consumer-tech", source_name: "9to5Mac",      feed_url: "https://9to5mac.com/feed/" },

  // ── SaaS / Software ──────────────────────────────────────────────────────────
  { sector: "saas", source_name: "TechCrunch Enterprise", feed_url: "https://techcrunch.com/category/enterprise/feed/" },
  { sector: "saas", source_name: "The New Stack",         feed_url: "https://thenewstack.io/feed/" },
  { sector: "saas", source_name: "InfoQ",                 feed_url: "https://www.infoq.com/feed" },
  { sector: "saas", source_name: "ZDNet",                 feed_url: "https://www.zdnet.com/news/rss.xml" },
  { sector: "saas", source_name: "SaaStr",                feed_url: "https://www.saastr.com/feed/" },
  { sector: "saas", source_name: "Software Advice Blog",  feed_url: "https://www.softwareadvice.com/resources/feed/" },
];

// Return all media sources for a given sector (case-insensitive match).
export function getSourcesForSector(sector: string): MediaSource[] {
  const normalized = sector.toLowerCase();
  return SECTOR_MEDIA_SOURCES.filter((s) => s.sector === normalized);
}

// Return all unique sectors that have at least one configured source.
export function getConfiguredSectors(): string[] {
  return [...new Set(SECTOR_MEDIA_SOURCES.map((s) => s.sector))];
}
