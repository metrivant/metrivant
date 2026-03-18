// ── Knowledge Panels Content Library ──────────────────────────────────────────
//
// 38 slides across 3 types: history, feature, science.
// No React imports — pure content library.

export type SlideType = "history" | "feature" | "science";

export type VisualKey =
  // History
  | "store" | "camera" | "phone" | "glass" | "deal"
  | "clock" | "server" | "map" | "book" | "chart"
  // Feature
  | "radar-gravity" | "signal-detection" | "movement-detection"
  | "sector-intelligence" | "weekly-brief" | "pressure-index"
  | "selector-repair" | "signal-velocity" | "confidence-model"
  | "page-classes" | "critical-alert" | "momentum-states"
  // Science
  | "brain" | "asymmetry" | "loss-aversion" | "availability"
  | "pattern" | "vigilance" | "sensemaking" | "confirmation"
  | "dopamine" | "planning-fallacy" | "working-memory" | "exposure";

export type KnowledgeSlide = {
  id: string;
  type: SlideType;
  badge: string;
  accent: string;
  era: string;
  visual: VisualKey;
  title: string;
  hook: string;
  points: [string, string, string];
  cta: string;
  priority: number;
};

export const KNOWLEDGE_SLIDES: KnowledgeSlide[] = [
  // ── HISTORY ──────────────────────────────────────────────────────────────────

  {
    id: "toys-r-us",
    type: "history",
    badge: "HISTORY",
    accent: "#F59E0B",
    era: "2000–2006",
    visual: "store",
    title: "The Toy Store That Handed Amazon Its Playbook",
    hook: "In 2000, Toys R Us outsourced its entire e-commerce operation to Amazon — giving Amazon full visibility into toy category demand, fulfillment patterns, and customer data. By 2006, Amazon used that knowledge to compete directly with every toy retailer on Earth.",
    points: [
      "Toys R Us granted Amazon access to buyer demand and category fulfillment data in exchange for a revenue share that never built competitive capability",
      "Amazon simultaneously listed competing toy brands on the same platform, violating exclusivity terms — by the time litigation completed, Amazon had already learned everything it needed",
      "The competitive signals were visible: annual warehouse expansions, third-party seller growth, and logistics investment were all public movements available to anyone watching",
    ],
    cta: "Metrivant tracks the logistics signals and category expansions your competitors hope you're not watching.",
    priority: 9,
  },

  {
    id: "blockbuster",
    type: "history",
    badge: "HISTORY",
    accent: "#EF4444",
    era: "1997–2010",
    visual: "chart",
    title: "The Video Store That Watched Netflix Arrive",
    hook: "Netflix mailed Blockbuster its business plan in 1997. Blockbuster passed. By 2010, Netflix had 20 million subscribers and Blockbuster had filed for bankruptcy. The signals were never missing — the attention was.",
    points: [
      "Blockbuster's late-fee revenue was $800M per year — the exact thing Netflix was positioned to eliminate. Leadership couldn't see past the line item protecting them",
      "Between 2003 and 2007, Netflix grew 600%. Blockbuster launched a competitive response in 2006 — after Netflix had already locked 6 million subscribers into a habit loop",
      "The customer behaviour change was measurable: online sign-ups, DVD-by-mail adoption, and streaming test signals were all trackable before the transition became irreversible",
    ],
    cta: "Metrivant surfaces competitor growth signals before they become revenue lines you can no longer defend.",
    priority: 10,
  },

  {
    id: "kodak",
    type: "history",
    badge: "HISTORY",
    accent: "#3B82F6",
    era: "1975–2012",
    visual: "camera",
    title: "The Company That Invented Digital — Then Buried It",
    hook: "Kodak engineer Steve Sasson invented the first digital camera in 1975. Kodak's response was to classify the project and return to selling film. They had the intelligence. They chose the margin.",
    points: [
      "Kodak's own research divisions produced accurate reports in the 1990s predicting digital's disruption timeline. Leadership had the intelligence — and suppressed it to protect film revenue",
      "By 2003, digital cameras outsold film cameras globally. Kodak had spent 8 years watching the transition happen at measurable speed, building digital capability too slowly to compete",
      "Kodak held 1,000+ digital imaging patents and licensed them to the companies that displaced them — generating royalty income instead of market position",
    ],
    cta: "Metrivant ensures competitive intelligence doesn't stay buried. It surfaces on the radar where it can be acted on.",
    priority: 9,
  },

  {
    id: "nokia",
    type: "history",
    badge: "HISTORY",
    accent: "#8B5CF6",
    era: "2005–2013",
    visual: "phone",
    title: "The Phone Giant That Never Saw the Touchscreen Coming",
    hook: "In 2007, Nokia controlled 49% of the global mobile phone market. By 2013, they sold their phone division to Microsoft for a fraction of peak value. The technology existed at Nokia. The organizational will to use it did not.",
    points: [
      "Nokia's internal labs had working touchscreen prototypes and smartphone concepts as early as 2001 — years before iPhone. The capability gap was organizational, not technical",
      "When Apple launched in 2007, Nokia's public response was confidence. Internally, executives acknowledged Symbian was uncompetitive and the app ecosystem model would define mobile",
      "Nokia's failure was not lack of intelligence — it was a structure that couldn't act on what it knew. The signals reached the analyst teams. They stopped at the boardroom door",
    ],
    cta: "Metrivant delivers intelligence to the people who can act — not into organizational silence.",
    priority: 10,
  },

  {
    id: "myspace",
    type: "history",
    badge: "HISTORY",
    accent: "#06B6D4",
    era: "2005–2009",
    visual: "map",
    title: "The Social Network That Gave Facebook a Blueprint",
    hook: "In 2005, MySpace had 25 million users and sold to News Corp for $580M. In 2009, Facebook overtook them in global users. In 2011, MySpace sold for $35M. Every relevant signal was public and trackable.",
    points: [
      "Facebook's growth velocity was visible from 2006: college rollout speed, engagement time (2.5× MySpace's metric), and API ecosystem partnerships all pointed to a platform strategy MySpace wasn't executing",
      "MySpace responded to Facebook's simplicity by adding features — increasing complexity exactly when users were choosing Facebook for clarity. Each competitive 'response' made the product worse",
      "News Corp's media instincts led them to monetize MySpace as an advertising vehicle rather than a social platform — a fundamental misread of competitor intent that Facebook exploited",
    ],
    cta: "Metrivant reads competitor moves as strategy — not just as feature launches.",
    priority: 8,
  },

  {
    id: "borders",
    type: "history",
    badge: "HISTORY",
    accent: "#F59E0B",
    era: "1997–2011",
    visual: "book",
    title: "The Bookstore That Outsourced Its Future to Amazon",
    hook: "In 2001, Borders outsourced its entire online operation to Amazon. In 2011, it filed for bankruptcy. Amazon became the world's largest bookseller. Borders gave them the roadmap.",
    points: [
      "Borders gave Amazon full visibility into book buyer demand and customer segments — in exchange for a revenue share that never built competitive infrastructure",
      "Between 2001 and 2010, Amazon's signals were consistent: warehouse announcements, Kindle development (public from 2004), and digital book rights acquisitions. Borders tracked none of it as strategic movement",
      "Borders' e-reader launch (Kobo, 2010) came 3 years after Kindle. The competitive window had opened and closed with no signal capture",
    ],
    cta: "Metrivant tracks the capability acquisitions that define who owns the next category.",
    priority: 8,
  },

  {
    id: "blackberry",
    type: "history",
    badge: "HISTORY",
    accent: "#A78BFA",
    era: "2007–2012",
    visual: "phone",
    title: "The Keyboard That Refused to Disappear",
    hook: "In 2009, BlackBerry controlled 20% of the US smartphone market. By 2012, that share was under 5%. CEO Mike Lazaridis publicly dismissed iPhone's battery life in 2007 — and the organization stopped watching.",
    points: [
      "BlackBerry's enterprise lock-in gave them a false competitive moat. They classified the consumer smartphone market as separate from their enterprise base — until enterprise users started bringing iPhones to work",
      "Apple's App Store (2008) was the decisive competitive movement. BlackBerry App World launched 11 months later — enough time for iOS to establish 50,000 apps and developer loyalty that never transferred",
      "The signals were all measurable: App Store submission volume, iOS activation rates, and enterprise BYOD policy shifts were all observable movements. BlackBerry's team categorized them as 'consumer' rather than 'threat'",
    ],
    cta: "Metrivant doesn't let you categorize a threat as irrelevant. Every signal reaches the radar.",
    priority: 8,
  },

  {
    id: "sears",
    type: "history",
    badge: "HISTORY",
    accent: "#64748B",
    era: "1996–2018",
    visual: "store",
    title: "The World's First Amazon, Undone by Its Own Catalogue",
    hook: "In 1894, Sears invented the idea of ordering anything from a catalogue and having it delivered to your door. In 2018, they filed for bankruptcy — displaced by a company doing exactly that, online. The capability gap was a choice.",
    points: [
      "Sears launched Sears.com in 1999 and had functioning e-commerce before Amazon was profitable. They had the capability; they lacked the commitment to cannibalize store traffic",
      "Amazon's signals from 1999–2010 — warehouse network expansion, Prime loyalty, third-party marketplace, AWS — were all public. Sears responded to none of them at strategic scale",
      "By 2010, Sears generated $44B revenue with no technology infrastructure, no loyalty data platform, and no modern fulfilment network. Amazon had built all three while Sears watched",
    ],
    cta: "Metrivant tracks infrastructure signals — warehouse announcements, platform launches, loyalty programs — before they become competitive moats.",
    priority: 7,
  },

  {
    id: "yahoo-google",
    type: "history",
    badge: "HISTORY",
    accent: "#F97316",
    era: "1998–2004",
    visual: "glass",
    title: "The Search Giant That Said No to Larry Page",
    hook: "In 2002, Yahoo had the opportunity to acquire Google for $1 billion. They counter-offered $3 billion. Google refused. In 2008, Google was worth $150 billion. Yahoo tracked Google's growth and still misread its trajectory.",
    points: [
      "Yahoo's competitive team had full visibility into Google's search quality, advertiser growth, and API ecosystem expansion from 2000–2004. The intelligence existed — the strategic framing was wrong",
      "Yahoo classified Google as a 'search utility' — a commodity feature. Every Google product launch (AdWords, Gmail, Maps, News) was a visible signal that the classification was incorrect. Yahoo underreacted to each one",
      "The 2002 acquisition negotiation failed because Yahoo valued Google at 2002 revenue, not strategic trajectory. A momentum model would have shown Google as the highest-velocity node in the field",
    ],
    cta: "Metrivant shows trajectory, not just position. Your competitor's momentum today is your market tomorrow.",
    priority: 9,
  },

  {
    id: "tower-records",
    type: "history",
    badge: "HISTORY",
    accent: "#EF4444",
    era: "2001–2006",
    visual: "book",
    title: "The Music Empire That Heard iTunes Coming",
    hook: "Tower Records' 2001 annual report named digital distribution as a primary risk. In 2006, they liquidated 89 stores. The signal was in their own filings — and it wasn't acted on.",
    points: [
      "iTunes launched in April 2003 with 200,000 tracks. Tower Records' response was: 'People still want to own CDs.' By December 2003, iTunes had sold 25 million songs — velocity that was measurable and ignored",
      "Napster's 80 million users (2001) was the most important competitive signal Tower ever received. Their response was litigation rather than understanding what the demand signal meant",
      "Tower's internal strategy documents show detailed awareness of digital transition economics. They tracked it, modelled it, and chose to optimize existing stores rather than build digital capability",
    ],
    cta: "Intelligence without action is a filing cabinet. Metrivant makes signals impossible to dismiss.",
    priority: 7,
  },

  {
    id: "palm",
    type: "history",
    badge: "HISTORY",
    accent: "#34D399",
    era: "2000–2010",
    visual: "phone",
    title: "The Pocket Computer That Defined Smartphones — Then Missed Them",
    hook: "Palm's Treo 600 (2003) was arguably the world's first true smartphone. By 2010, Palm sold to HP with 1% market share. They invented the category and then watched it be taken.",
    points: [
      "Palm saw the app ecosystem concept in 2003 but never built a developer platform with the strategic commitment Apple would bring to the App Store — the distribution model that actually won",
      "Between 2005 and 2008, Windows Mobile, BlackBerry, and iPhone captured the smartphone narrative. Palm tracked feature parity but missed the platform shift — the signal they needed was in developer adoption",
      "Palm's webOS (2009) was technically praised but arrived 23 months after iPhone — after developer attention and consumer habit were locked. Timing windows in competitive markets close faster than organizations move",
    ],
    cta: "Metrivant tracks developer ecosystem signals and timing windows that determine competitive outcomes.",
    priority: 6,
  },

  {
    id: "britannica",
    type: "history",
    badge: "HISTORY",
    accent: "#06B6D4",
    era: "1995–2012",
    visual: "book",
    title: "The Encyclopedia That Watched Wikipedia Happen in Real Time",
    hook: "Encyclopaedia Britannica had been the world's authority on knowledge for 244 years. In 2012, they discontinued the print edition — ended by a free website built entirely by volunteers. The disruption was trackable from day one.",
    points: [
      "Wikipedia launched January 2001 with 20,000 articles. Britannica's response: 'We maintain expert contributors.' By 2004, Wikipedia had 1 million articles. By 2006, 5 million. The velocity was a visible signal",
      "The competitive threat was not accuracy — it was access. Britannica tracked the quality signal (correctness) and missed the distribution signal (free, everywhere, instantly). The wrong metric governed the competitive response",
      "Britannica's online service launched in 1994 — 7 years before Wikipedia. They had every structural advantage and chose a premium paywall model while their competitor chose free. Strategy, not capability, was the failure",
    ],
    cta: "Metrivant tracks which signals define whether a competitor's move threatens your position.",
    priority: 7,
  },

  {
    id: "mapquest",
    type: "history",
    badge: "HISTORY",
    accent: "#94A3B8",
    era: "2004–2008",
    visual: "map",
    title: "The World's Dominant Map, Outflanked in 18 Months",
    hook: "In 2004, MapQuest served 65% of all online map requests. By 2008, Google Maps had taken most of that. The entire transition took 18 months. It was signalled by a public API announcement most teams dismissed.",
    points: [
      "Google Maps launched February 2005 with a tile-based interface and an open API. MapQuest had no API strategy — no way for developers to embed their maps. Distribution was the competitive movement, not the product",
      "The API signal was the moat being built: within 6 months of launch, thousands of developers were building on Google Maps. MapQuest tracked this as a technical feature, not as a distribution advantage that would be permanent",
      "Satellite view, Street View (public 2006), and mobile integration — every Google Maps expansion was trackable. MapQuest's parent (AOL/Time Warner) treated each as a feature gap, not a platform strategy",
    ],
    cta: "Metrivant reads competitor product moves as platform strategy — not just feature updates.",
    priority: 6,
  },

  {
    id: "netscape",
    type: "history",
    badge: "HISTORY",
    accent: "#10B981",
    era: "1995–2001",
    visual: "server",
    title: "The Browser That Invented the Web — Then Lost It to Free",
    hook: "Netscape Navigator made the web accessible to the world. Microsoft released Internet Explorer for free, bundled it with Windows, and within 4 years held 96% of browser market share. The strategy was announced in writing.",
    points: [
      "Bill Gates' May 1995 memo 'The Internet Tidal Wave' declared the browser Microsoft's primary strategic priority. The memo was public. Netscape's response was to focus on the enterprise market rather than address the distribution signal",
      "The 'free bundled with OS' signal was visible from IE 1.0 in 1995. Netscape continued pricing Navigator at $39 for 3 years. By 1998, they dropped to zero — 3 years after the competitive signal was clear",
      "Netscape's antitrust victory in 2001 confirmed the harm — but the market share was already gone. Legal responses operate on a different timescale than competitive ones. Monitoring is not the same as litigation",
    ],
    cta: "Metrivant watches pricing moves and distribution signals before they reshape your market.",
    priority: 8,
  },

  // ── FEATURE ──────────────────────────────────────────────────────────────────

  {
    id: "feat-radar-gravity",
    type: "feature",
    badge: "SYSTEM",
    accent: "#2EE6A6",
    era: "Interface",
    visual: "radar-gravity",
    title: "The Radar Gravity Field",
    hook: "Every node on the Metrivant radar occupies a position earned by its evidence record. Momentum is computed from signals and movement confidence — and position is its visual expression. Nothing on the radar is decorative.",
    points: [
      "Nodes are placed using the golden angle spiral — a pattern from nature that prevents clustering regardless of competitor count, giving every node equal visual weight",
      "Four momentum states govern appearance: Cooling (<1.5), Stable (1.5–3), Rising (3–5), Accelerating (≥5). Color, size, and echo ring speed all encode momentum simultaneously",
      "The critical alert requires all five conditions at once: momentum ≥ 7, signals_7d ≥ 3, confidence ≥ 0.70, confirmed movement type, and last seen within 48 hours",
    ],
    cta: "Your radar is live. Every node position is a fact, not an estimate.",
    priority: 9,
  },

  {
    id: "feat-signal-detection",
    type: "feature",
    badge: "SYSTEM",
    accent: "#3B82F6",
    era: "Detection",
    visual: "signal-detection",
    title: "The Signal Detection Engine",
    hook: "Metrivant doesn't alert on web page changes. It detects strategic signals — by isolating what changed, validating the change is meaningful, and classifying what the change means. The filter is as important as the detector.",
    points: [
      "Pages are segmented into logical sections (pricing blocks, feature lists, headlines). Each section is diffed against a stable baseline — not the previous snapshot — reducing noise from A/B tests and dynamic content",
      "Two noise filters run before any signal is created: whitespace-only changes and dynamic-content changes (timestamps, UTM parameters) are suppressed before confidence scoring even begins",
      "A signal is created only when a real change in a meaningful section crosses a confidence threshold. Most page changes never become signals. That ratio is intentional",
    ],
    cta: "When a Metrivant signal appears, it has passed three gates. It is real.",
    priority: 10,
  },

  {
    id: "feat-confidence",
    type: "feature",
    badge: "SYSTEM",
    accent: "#A78BFA",
    era: "Detection",
    visual: "confidence-model",
    title: "The Confidence Model",
    hook: "Every signal Metrivant creates carries a 0–1 confidence score built from four factors: section type, page class, recency, and observation count. Signals below 0.35 are suppressed entirely. This is precision, not conservatism.",
    points: [
      "Section type is the primary factor: a pricing block change starts at 0.85 confidence; a generic text section starts at 0.25. The type of page predicts signal quality before any content analysis",
      "Page class adds +0.08 for high-value pages (pricing, changelog, newsroom), recency adds up to +0.15, and repeated observations add up to +0.15 — creating a composite that reflects actual evidence weight",
      "The pressure_index promotion at 5.0 overrides the confidence gate: high competitor activity can elevate pending_review signals to active interpretation even when individual confidence is moderate",
    ],
    cta: "Metrivant's confidence model ensures every signal in your feed has earned its place.",
    priority: 8,
  },

  {
    id: "feat-movement",
    type: "feature",
    badge: "SYSTEM",
    accent: "#8B5CF6",
    era: "Analysis",
    visual: "movement-detection",
    title: "When Signals Become Strategy",
    hook: "A single pricing change is evidence. Three pricing changes in 10 days, combined with a repositioned headline and a new enterprise section — that is a movement. Metrivant waits for the pattern.",
    points: [
      "Movements require a minimum of 2 correlated signals within a 14-day window for the same competitor. A single anomaly never becomes a movement — the system waits for confirmation",
      "GPT-4o-mini classifies the movement type (pricing_strategy_shift, product_expansion, market_reposition, enterprise_push, ecosystem_expansion) with a confidence score and velocity measure",
      "Every confirmed movement receives a GPT-4o analyst narrative: what the competitor did, why it matters strategically, and what to watch for next — grounded in the underlying signals",
    ],
    cta: "Metrivant reads patterns, not events. Your intelligence drawer shows strategy.",
    priority: 9,
  },

  {
    id: "feat-pressure",
    type: "feature",
    badge: "SYSTEM",
    accent: "#EF4444",
    era: "Analysis",
    visual: "pressure-index",
    title: "The Pressure Index",
    hook: "Each competitor carries a pressure index from 0.0 to 10.0 — a weighted, time-decaying measure of competitive activity intensity. It is not a count of signals. It is a measure of current momentum.",
    points: [
      "Signals decay exponentially with age: a signal from 14 days ago contributes only 5.5% of a same-day signal's weight. The pressure index is always about now, not history",
      "Ambient events — press mentions, hiring announcements, product updates — feed the index without requiring interpretation. A competitor can accumulate pressure without triggering a signal",
      "When a competitor's index reaches 5.0, their pending_review signals are promoted to active interpretation. High ambient activity accelerates signal processing",
    ],
    cta: "Watch the pressure index. It shows who is about to move before the movement is confirmed.",
    priority: 8,
  },

  {
    id: "feat-page-classes",
    type: "feature",
    badge: "SYSTEM",
    accent: "#34D399",
    era: "Detection",
    visual: "page-classes",
    title: "How Monitoring Frequency Is Assigned",
    hook: "Not all competitor pages carry equal intelligence value. Pricing pages change rarely but critically. Blog pages change often but ambiguously. Metrivant monitors each class at the frequency it deserves.",
    points: [
      "High-value pages (pricing, changelog, newsroom) are crawled every hour at :02 past — a pricing change can be detected within 58 minutes of going live on a competitor's site",
      "Standard pages (homepage, features) run every 3 hours. Ambient pages (blog, careers) run every 30 minutes — feeding activity signals rather than strategic diffs",
      "High-value pages receive a +0.08 confidence bonus on all their signals, because evidence from a pricing page is structurally more reliable than evidence from a blog post",
    ],
    cta: "Metrivant knows which pages matter. It watches them hardest.",
    priority: 7,
  },

  {
    id: "feat-sector",
    type: "feature",
    badge: "SYSTEM",
    accent: "#06B6D4",
    era: "Analysis",
    visual: "sector-intelligence",
    title: "Sector-Wide Pattern Analysis",
    hook: "Every Monday at 07:00 UTC, Metrivant runs a cross-competitor analysis across all signals from the last 30 days — looking for patterns no single competitor's feed would reveal alone.",
    points: [
      "The analysis pivots all signals by section_type across every tracked competitor, structured to surface which change types are happening simultaneously across your competitive field",
      "GPT-4o identifies sector_trends (multiple competitors converging on similar moves) and divergences (competitors moving opposite to peers, often signalling a strategic differentiation bet)",
      "Every sector insight is post-linked to real signal IDs — every trend is traceable to specific page changes on specific competitor sites, not generated from inference alone",
    ],
    cta: "Metrivant sees your entire competitive field simultaneously — not one competitor at a time.",
    priority: 7,
  },

  {
    id: "feat-brief",
    type: "feature",
    badge: "SYSTEM",
    accent: "#F59E0B",
    era: "Delivery",
    visual: "weekly-brief",
    title: "Monday Intelligence Brief",
    hook: "Every Monday at 10:00 UTC, Metrivant delivers a competitive intelligence brief — assembled from the week's movements, sector analysis, and competitor narratives, written by GPT-4o, grounded in evidence.",
    points: [
      "The brief is assembled from pre-generated artifacts: sector intelligence summaries, movement narratives, and per-competitor radar narratives — not by re-analyzing raw signals. Assembly is fast and evidence-complete",
      "Output is structured: headline summary, competitors analyzed, major moves, strategic implications, and recommended actions. Every section traces back to observed page changes",
      "The brief arrives via email from briefs@metrivant.com and is available in-app on the Briefs page — covering only intelligence generated since the previous brief, never recycling old data",
    ],
    cta: "Monday morning. Your Metrivant brief is ready. It was written while you slept.",
    priority: 8,
  },

  {
    id: "feat-velocity",
    type: "feature",
    badge: "SYSTEM",
    accent: "#F97316",
    era: "Analysis",
    visual: "signal-velocity",
    title: "Signal Velocity — The Leading Indicator",
    hook: "A competitor silent for 30 days who suddenly emits 6 signals in 72 hours is more alarming than one who emits 2 signals a week for a year. Velocity measures rate of change — not total count.",
    points: [
      "Velocity is computed as signals per day within a rolling window, weighted toward recency. A burst of signals in a short window registers higher velocity than the same number spread over a month",
      "Velocity feeds momentum_score: a high-velocity competitor accelerates toward the radar center faster than a high-count competitor with gradual consistent activity",
      "Velocity is a leading indicator. When it spikes, movement confirmation typically follows within 3–7 days. The radar shows the acceleration before the label is confirmed",
    ],
    cta: "The velocity spike is the signal. Metrivant shows it to you before the analysis catches up.",
    priority: 8,
  },

  {
    id: "feat-repair",
    type: "feature",
    badge: "SYSTEM",
    accent: "#10B981",
    era: "System",
    visual: "selector-repair",
    title: "The System That Fixes Itself",
    hook: "When a competitor redesigns their website, the CSS selectors Metrivant uses to extract sections may break. The auto-repair system detects drift, re-fetches the live page, and proposes a corrected selector — without losing the monitoring chain.",
    points: [
      "Drift detection triggers when a (page, section) pair shows 3 consecutive suspect validations within 72 hours — Metrivant recognises it may be missing real changes due to structural breakage",
      "The repair process re-fetches live HTML and sends it to GPT-4o-mini with a description of what the section should contain. The model proposes a new CSS selector, validated with Cheerio before storage",
      "Repairs are never auto-applied. Every suggestion goes to operator review — because a wrong selector silently creates a monitoring gap, and data integrity depends on human confirmation",
    ],
    cta: "Metrivant maintains its own collection integrity. The watch never silently goes dark.",
    priority: 6,
  },

  {
    id: "feat-alert",
    type: "feature",
    badge: "SYSTEM",
    accent: "#EF4444",
    era: "Delivery",
    visual: "critical-alert",
    title: "Five Conditions. One Alert.",
    hook: "A critical alert fires only when five conditions are simultaneously true. This is not caution — it is the architecture of trust. One false alarm destroys more attention than ten missed signals.",
    points: [
      "The five conditions: momentum ≥ 7, signals in 7 days ≥ 3, movement confidence ≥ 0.70, a confirmed movement type, and last seen within 48 hours. All five simultaneously — no partial triggers",
      "When an alert fires: radar rings pulse in the movement's color, the alerted node blooms, and a navigation path to the Strategy page appears. At most one alert fires per radar load — the highest-momentum qualifier wins",
      "Session dedup prevents the same alert from firing twice: competitor_id + last_movement_seen_at. You see each alert once, and only when the intelligence is genuinely fresh",
    ],
    cta: "When Metrivant fires a critical alert, act. Every threshold was designed to make this moment real.",
    priority: 9,
  },

  {
    id: "feat-momentum",
    type: "feature",
    badge: "SYSTEM",
    accent: "#2EE6A6",
    era: "Interface",
    visual: "momentum-states",
    title: "Reading the Radar's Visual Language",
    hook: "Every competitor on the radar is in one of four states. Each state changes not just the color of the node — but its size, echo ring speed, glow intensity, and position. The visual language is a data encoding.",
    points: [
      "Cooling (<1.5): slate, slow echo. Stable (1.5–3): green, moderate echo. Rising (3–5): amber, faster echo. Accelerating (≥5): red, fastest echo at 1.5-second cycle. Speed is data",
      "Signal type micro-shapes appear inside active nodes: a dash for pricing shifts, a plus for product expansion, a diamond for repositioning, an arrow for enterprise push — the primary signal type visible at a glance",
      "Confidence-proportional opacity: nodes with movement confidence above 0.65 render at full opacity; nodes with lower confidence appear at 75–88%. Your eye naturally focuses where the evidence is strongest",
    ],
    cta: "Read the radar. The pattern of who is moving is the intelligence.",
    priority: 7,
  },

  // ── SCIENCE ──────────────────────────────────────────────────────────────────

  {
    id: "sci-threat",
    type: "science",
    badge: "SCIENCE",
    accent: "#EF4444",
    era: "Neuroscience",
    visual: "brain",
    title: "The Threat Detection Circuit",
    hook: "The human amygdala fires 40 milliseconds before the prefrontal cortex begins processing a threat. We are built to detect danger before we understand it — but competitive threats move on timescales the amygdala was never designed for.",
    points: [
      "Preconscious threat detection evolved for predators in open savannah — stimuli in peripheral vision requiring immediate motor response. Competitive threats are the inverse: slow, indirect, and structural",
      "The threat circuit prioritises salient, sudden signals over gradual accumulation. A competitor's pricing page that changes 12% over 8 months triggers no neurological alarm in any human reviewer — but represents a confirmed strategic movement",
      "Systematic monitoring extends threat detection to the timescales where competitive threats actually operate — months and years, not milliseconds and seconds",
    ],
    cta: "Your amygdala can't watch a competitor's pricing page. Metrivant can.",
    priority: 9,
  },

  {
    id: "sci-asymmetry",
    type: "science",
    badge: "SCIENCE",
    accent: "#06B6D4",
    era: "Economics",
    visual: "asymmetry",
    title: "Information Asymmetry",
    hook: "In 2001, George Akerlof won the Nobel Prize for proving that markets fail when one party knows more than the other. Competitive markets are not exempt. The company that knows its competitor's next move first wins more often than the company with the better product.",
    points: [
      "Information asymmetry in competitive markets means knowing a competitor's next move first enables pre-emption, copying, or countering before the market settles. The intelligence window is the structural advantage",
      "Akerlof's 'market for lemons' model shows that asymmetry creates rational disengagement: buyers stop trusting markets they can't evaluate. In competitive strategy, the equivalent is executive teams stop acting on intelligence they can't source and verify",
      "The solution to asymmetry is always the same: systematic collection, verification, and delivery of information to the disadvantaged party. This is what monitoring systems have been built for across every domain and century",
    ],
    cta: "Metrivant closes the information asymmetry between you and your best-resourced competitor.",
    priority: 8,
  },

  {
    id: "sci-loss",
    type: "science",
    badge: "SCIENCE",
    accent: "#F59E0B",
    era: "Behavioral Economics",
    visual: "loss-aversion",
    title: "Loss Aversion and Competitive Risk",
    hook: "Daniel Kahneman proved that losses feel 2.5 times more painful than equivalent gains feel pleasurable. In competitive strategy, this means missing a competitor's move hurts more than capturing it early helps — but the asymmetry only becomes visible after it's too late.",
    points: [
      "Loss aversion creates a systematic bias toward the status quo in competitive decision-making. Leaders who know a competitor is moving are still more likely to wait for confirmation than to act early — because acting early and being wrong feels worse than waiting and being late",
      "The bias operates at the organizational level: a team that misses a signal and loses share suffers visible, attributable pain. A team that acts early on a signal that proves false suffers smaller, diffuse embarrassment. The asymmetry systematically under-invests in early action",
      "Awareness of loss aversion allows calibration: if missing a true signal costs 2.5× the cost of acting on a false one, your confidence threshold for action should be lower than intuition suggests",
    ],
    cta: "Metrivant makes missing a competitive signal impossible to overlook — and acting on it impossible to delay.",
    priority: 8,
  },

  {
    id: "sci-availability",
    type: "science",
    badge: "SCIENCE",
    accent: "#8B5CF6",
    era: "Cognitive Psychology",
    visual: "availability",
    title: "The Availability Heuristic",
    hook: "Kahneman and Tversky showed that humans judge probability by how easily an example comes to mind. In competitive strategy, this means you systematically overestimate threats you've faced before and underestimate the ones you haven't.",
    points: [
      "The availability heuristic causes teams to focus monitoring on companies they already know — incumbents they've faced, products they've lost deals to — while systematically underweighting new entrants and adjacent-category movers",
      "Novel competitive threats are by definition the ones that don't come to mind easily. The competitor who disrupts your market almost always starts as someone your team didn't track, in a category you didn't consider adjacent",
      "Systematic, broad competitive monitoring is the structural override for availability bias — it forces attention onto what is actually happening, not onto what memory suggests is probable",
    ],
    cta: "Metrivant tracks the competitors your availability heuristic forgets to worry about.",
    priority: 7,
  },

  {
    id: "sci-pattern",
    type: "science",
    badge: "SCIENCE",
    accent: "#34D399",
    era: "Cognitive Neuroscience",
    visual: "pattern",
    title: "Pattern Recognition Before Conscious Thought",
    hook: "The visual cortex recognises patterns 150–200 milliseconds before the brain constructs conscious awareness of them. Strategic radar is designed around this same principle: the pattern of movement is the intelligence, visible before the analysis is complete.",
    points: [
      "Preattentive processing allows humans to detect motion, color change, and spatial clustering without directed attention — the same dimensions encoded in the Metrivant radar. Size, color, and position communicate threat level before you consciously read a number",
      "Expert pattern recognition — as studied in chess grandmasters, military commanders, and veteran fund managers — operates by storing configurations and recognizing deviations. Competitive intelligence systems formalise this: baselines are configurations, diffs are deviations",
      "The radar's visual language exploits preattentive processing: an accelerating node in red near the center, pulsing fast, is distinguished from a cooling node at the periphery in under 200 milliseconds",
    ],
    cta: "Metrivant's radar speaks to the part of your visual system that thinks faster than language.",
    priority: 8,
  },

  {
    id: "sci-vigilance",
    type: "science",
    badge: "SCIENCE",
    accent: "#2EE6A6",
    era: "Evolutionary Psychology",
    visual: "vigilance",
    title: "Competitive Vigilance — The Evolutionary Basis",
    hook: "For 99% of human evolutionary history, failing to monitor the environment for threats was fatal. The organisms that survived were the ones who never stopped watching. That instinct is now catastrophically mismatched to the pace and scale of market competition.",
    points: [
      "Vigilance in nature is a group behavior: dedicated lookouts maintain continuous observation while others feed. The cognitive cost is distributed — no individual bears the full attention burden. In competitive markets, this distribution almost always fails",
      "In organizations, the 'vigilance equivalent' — continuous monitoring of competitor behavior — is distributed across analyst teams, product managers, and sales. Signal leakage from this system is enormous. No single person holds the full picture at once",
      "Evolutionary vigilance systems have one property modern competitive intelligence mostly lacks: they are always on. Competitors do not pause their strategic moves because your monitoring cycle hasn't refreshed",
    ],
    cta: "Metrivant is the always-on lookout your team cannot be at human scale.",
    priority: 9,
  },

  {
    id: "sci-sensemaking",
    type: "science",
    badge: "SCIENCE",
    accent: "#3B82F6",
    era: "Cognitive Science",
    visual: "sensemaking",
    title: "The Sensemaking Loop",
    hook: "Karl Weick showed that organizations don't discover the environment and then act — they act, observe the consequences, and construct meaning retrospectively. In competitive markets, by the time you've made sense of a signal, the window to respond may have already closed.",
    points: [
      "Sensemaking is inherently retrospective: organizations look for signals that confirm a narrative they've already constructed. Signals that contradict the current strategic story are systematically deprioritized — not through malice, but through the cognitive mechanics of meaning-making",
      "The solution is prospective monitoring: tracking signals before a narrative is needed, creating an evidence archive that can be interrogated when a decision is required. Evidence assembled after the fact is always biased toward the conclusion already drawn",
      "Metrivant's pipeline creates the prospective archive: signals are created when changes are detected, not when someone decides to look. The retrospective sensemaking problem is structurally eliminated",
    ],
    cta: "Metrivant builds your evidence archive prospectively — so your analysis is never retrospectively biased.",
    priority: 7,
  },

  {
    id: "sci-confirmation",
    type: "science",
    badge: "SCIENCE",
    accent: "#F97316",
    era: "Cognitive Psychology",
    visual: "confirmation",
    title: "Confirmation Bias in Competitive Strategy",
    hook: "We seek, interpret, and remember information that confirms what we already believe. In competitive strategy, this means the companies that most need competitive intelligence — incumbents defending an existing model — are the ones least likely to correctly interpret it.",
    points: [
      "Confirmation bias in strategy manifests as 'competitor fit' framing: when a competitor launches a new product, incumbents assess it against their own strengths, not against their own weaknesses. The assessment always finds the new product lacking",
      "Nokia's engineers correctly assessed that iPhone's battery life was inferior to their hardware. This was true and irrelevant. The confirmation they sought led them to dismiss the signal that actually mattered: the app ecosystem",
      "Systematic monitoring creates a confirmation-resistant evidence base: the signals are what happened, not what you expected. The diff between the pricing page before and after is not subject to interpretation until after it is observed",
    ],
    cta: "Metrivant's evidence is what happened. Your analysis may be biased. The signal is not.",
    priority: 8,
  },

  {
    id: "sci-dopamine",
    type: "science",
    badge: "SCIENCE",
    accent: "#A78BFA",
    era: "Neuroscience",
    visual: "dopamine",
    title: "The Intelligence Habit — Dopamine and Routine",
    hook: "Dopamine is not the molecule of pleasure — it is the molecule of anticipated reward. Regular, reliable delivery of valuable intelligence creates a dopamine-driven habit loop that fundamentally changes how competitive teams make decisions.",
    points: [
      "The habit loop (cue → routine → reward) applies to intelligence consumption: a reliable Monday morning brief creates a behavioral cue, a reading routine, and a reward response when the brief confirms or challenges a strategic assumption",
      "Teams that receive regular competitive intelligence become demonstrably more likely to act on it: the routine creates a cognitive frame for decision-making that sporadic intelligence does not. The cadence is as important as the content",
      "Dopaminergic anticipation extends to monitoring interfaces: a system that surfaces new signals reliably and visually creates the same anticipation loop that makes great information products habitual — applied to strategically valuable data",
    ],
    cta: "Monday morning, your Metrivant brief is ready. The cadence is designed to rewire how your team decides.",
    priority: 7,
  },

  {
    id: "sci-planning",
    type: "science",
    badge: "SCIENCE",
    accent: "#EF4444",
    era: "Behavioral Economics",
    visual: "planning-fallacy",
    title: "The Planning Fallacy",
    hook: "Kahneman and Tversky showed that humans systematically underestimate how long their own plans take while overestimating the friction in their competitors' plans. In markets, this asymmetry is the margin of defeat.",
    points: [
      "The planning fallacy is strongest for complex multi-stage projects — exactly what competitive movements represent. Incumbents believe they have more time to respond than they do because they apply optimistic timelines to their own response plans",
      "When Blockbuster's leadership computed how long Netflix would take to scale, they applied realistic friction to Netflix's projections — while applying optimistic timelines to their own competitive response. The 3-year asymmetry was their undoing",
      "The antidote is competitor movement tracking from first signal: when signals appear, you see rate of change, not endpoint. Velocity tracking shows how fast a competitor is actually moving — not how fast you estimate they could",
    ],
    cta: "Metrivant shows you how fast your competitors are actually moving. Build your response to match their pace.",
    priority: 8,
  },

  {
    id: "sci-working-memory",
    type: "science",
    badge: "SCIENCE",
    accent: "#64748B",
    era: "Cognitive Neuroscience",
    visual: "working-memory",
    title: "Working Memory and the Limits of Attention",
    hook: "Working memory holds approximately 4 discrete chunks of information simultaneously. Your competitive landscape has 15–25 relevant actors, each generating multiple signals per week. The mismatch between cognitive capacity and competitive complexity is structural — not a failure of diligence.",
    points: [
      "Miller's Law (1956) established 7±2 working memory capacity. Cowan's 2001 refinement reduced it to 4 chunks. No analyst team can maintain a coherent model of 20 competitors' simultaneous movements in working memory — not because they are inadequate, but because no human brain can",
      "Cognitive offloading — extending working memory to external systems — is how humans have managed complex environments since writing was invented. The radar is a cognitive offload: it holds the state of your competitive field so working memory can hold strategy",
      "Each element of the Metrivant interface — the intelligence drawer, the momentum states, the signal feed — is a working memory extension, representing one 'chunk' of the competitive field in a form the brain can rapidly parse",
    ],
    cta: "Metrivant is your team's cognitive offload for competitive complexity.",
    priority: 7,
  },

  {
    id: "sci-exposure",
    type: "science",
    badge: "SCIENCE",
    accent: "#06B6D4",
    era: "Social Psychology",
    visual: "exposure",
    title: "The Mere Exposure Effect and Competitive Blindness",
    hook: "Robert Zajonc showed in 1968 that repeated exposure to a stimulus increases its positive evaluation — regardless of the stimulus's objective quality. Familiarity with your competitors distorts your threat assessment in a systematic and measurable way.",
    points: [
      "The mere exposure effect causes teams to rate familiar competitors as more threatening than equivalently positioned new entrants. The known threat is overweighted; the novel threat is underweighted — the exact inverse of rational competitive monitoring",
      "Long-tenured competitors lose their signal freshness: teams stop registering behavior changes because the overall pattern feels familiar. A competitor who has changed their pricing 4 times in 18 months may not trigger alarm because that company 'always changes pricing'",
      "Signal-based monitoring overrides the exposure effect: each signal is evaluated on its evidence, not on background familiarity. A pricing page diff has the same weight whether it comes from a 2-year rival or a 2-week new entrant",
    ],
    cta: "Metrivant evaluates every signal on its evidence — not on your familiarity with its source.",
    priority: 7,
  },
];
