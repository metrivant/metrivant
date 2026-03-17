// ── Feature Discovery Panels ──────────────────────────────────────────────────
//
// Catalog of Metrivant feature explanation panels.
// Used by FeatureDiscoveryPanel to teach users how the product works.
//
// Each panel explains one feature with a diagram key, 3 bullet points,
// and a detailed AI expansion prompt.

export type FeatureCategory =
  | "detection"    // how Metrivant monitors and detects changes
  | "analysis"     // how signals become movements and intelligence
  | "interface"    // how the radar UI works
  | "delivery"     // how intelligence is surfaced to users
  | "system";      // operational internals

export type DiagramKey =
  | "radar-gravity"
  | "signal-detection"
  | "movement-detection"
  | "sector-intelligence"
  | "weekly-brief"
  | "pressure-index"
  | "selector-repair"
  | "signal-velocity"
  | "confidence-model"
  | "page-classes"
  | "critical-alert"
  | "momentum-states";

export type FeaturePanel = {
  id: string;
  feature_name: string;
  short_title: string;
  category: FeatureCategory;
  diagram: DiagramKey;
  accent: string;
  key_points: [string, string, string];
  explanation_prompt: string;
  /** Prompt for Tier 3 deep mode: guides GPT to find historical parallels for this feature's core concept. */
  historical_context_prompt: string;
  priority_weight: number; // 1–10, higher = shown sooner in the rotation
};

export const FEATURE_PANELS: FeaturePanel[] = [

  {
    id: "radar-gravity",
    feature_name: "Radar Gravity Field",
    short_title: "Why Nodes Move on the Radar",
    category: "interface",
    diagram: "radar-gravity",
    accent: "#2EE6A6",
    key_points: [
      "Each competitor occupies a position on the radar determined by its momentum score",
      "More signals and higher-confidence movements pull a node closer to the active zone",
      "Cooling competitors drift outward — the radar shows velocity, not just presence",
    ],
    explanation_prompt:
      "Explain how the Metrivant radar positioning system works. Cover: (1) how momentum_score is computed from signals, movements, and velocity, (2) how the golden spiral distribution places nodes — and why it prevents clustering, (3) the four momentum states (cooling < 1.5, stable 1.5–3, rising 3–5, accelerating ≥ 5) and how they affect node appearance, (4) the critical alert threshold (momentum ≥ 7, signals_7d ≥ 3, confidence ≥ 0.70, movement present, last seen < 48h), (5) a concrete example using a competitor like 'Competitor A' repricing their product, generating 3 pricing_strategy_shift signals over 7 days, and watching their node animate toward the radar center.",
    historical_context_prompt:
      "Trace the history of visualizing enemy or competitor movement in real time — from naval plotting rooms to air-defense radar to competitive intelligence. Focus on: how strategists have always needed a single instrument that shows who is accelerating, who is dormant, and where the threats are concentrating. Each era should show the 'field of movement' concept: tracking velocity and position as primary inputs to strategic decision-making.",
    priority_weight: 9,
  },

  {
    id: "signal-detection",
    feature_name: "Signal Detection Engine",
    short_title: "How Metrivant Finds Changes",
    category: "detection",
    diagram: "signal-detection",
    accent: "#3B82F6",
    key_points: [
      "Metrivant crawls monitored pages on a schedule, capturing full HTML snapshots",
      "Pages are segmented into sections; each section is diffed against its stable baseline",
      "Only meaningful changes pass confidence gates — cosmetic noise is filtered before any signal is created",
    ],
    explanation_prompt:
      "Explain how Metrivant's deterministic signal detection pipeline works step by step. Cover: (1) the snapshot stage — what gets captured and how raw HTML is processed, (2) section extraction — how pages are broken into logical blocks (pricing tables, feature lists, headlines), (3) section baselines — the stable reference state used for diffing (insert-only, never overwritten), (4) the diff stage — how textual changes are computed and noise is filtered (whitespace-only diffs, dynamic content like timestamps are suppressed), (5) the signal creation stage — how diff records become typed signals with confidence scores, (6) a concrete example: a SaaS company quietly updating their pricing table from $49 to $79 — trace this change from snapshot to signal.",
    historical_context_prompt:
      "Trace the history of early-warning and signal detection systems — from ancient watchtower networks to telegraph tripwires to radar. Focus on: how civilizations built systems to detect the faint first signs of an approaching threat before it became visible. Each era should illustrate the snapshot-diff-signal logic: someone maintained a baseline of 'normal,' observed a deviation, and extracted meaning from the difference.",
    priority_weight: 9,
  },

  {
    id: "confidence-model",
    feature_name: "Confidence Scoring",
    short_title: "How Signals Are Filtered for Quality",
    category: "detection",
    diagram: "confidence-model",
    accent: "#A78BFA",
    key_points: [
      "Every signal gets a 0–1 confidence score built from section type, page class, recency, and observation count",
      "Signals below 0.35 are suppressed entirely — they never reach interpretation",
      "Signals 0.35–0.64 wait in pending_review; high competitor pressure can promote them",
    ],
    explanation_prompt:
      "Explain Metrivant's confidence scoring model in detail. Cover: (1) the four components of the score — SECTION_WEIGHTS (0.25 for generic sections, 0.85 for pricing blocks), recency_bonus (0.05/0.10/0.15 based on how recently the section changed), observation_bonus (capped at 0.15), and page_class_bonus (+0.08 for high_value pages), (2) the three confidence gate outcomes: suppressed (< 0.35), pending_review (0.35–0.64), and active pending (≥ 0.65), (3) how the pressure_index promotion works — when a competitor's pressure_index reaches 5.0, their pending_review signals are promoted to pending and sent to interpretation, (4) why these gates exist — false positives are worse than missed signals in a precision intelligence product, (5) a concrete example tracing a low-confidence pricing hint vs. a high-confidence pricing change through the gates.",
    historical_context_prompt:
      "Trace the history of intelligence filtering and source credibility — from Roman HUMINT grading to Bletchley Park's source confidence ratings to CIA analytic standards. Focus on: how every serious intelligence operation has needed a systematic way to weigh evidence quality, reject noise, and avoid acting on unverified reports. Each era should show the cost of acting on low-confidence intelligence vs. the value of calibrated thresholds.",
    priority_weight: 8,
  },

  {
    id: "movement-detection",
    feature_name: "Movement Detection",
    short_title: "When Signals Become Strategy",
    category: "analysis",
    diagram: "movement-detection",
    accent: "#8B5CF6",
    key_points: [
      "Individual signals are evidence — movements are the pattern they form across time",
      "Metrivant groups signals by type and competitor to identify strategic intent",
      "A confirmed movement requires a minimum of 2 correlated signals within a 14-day window",
    ],
    explanation_prompt:
      "Explain how Metrivant detects strategic movements from clusters of signals. Cover: (1) the distinction between a signal (single observed change) and a movement (confirmed strategic pattern), (2) the movement detection logic — minimum 2 signals, 14-day window, same competitor, compatible signal types, (3) the movement types: pricing_strategy_shift, product_expansion, market_reposition, enterprise_push, ecosystem_expansion, hiring_surge, (4) how GPT-4o-mini interprets signals to classify the movement type with confidence 0–1 and velocity (signal rate per day), (5) the movement narrative system — how synthesize-movement-narratives generates 2-3 sentence analyst summaries with strategic_implication and confidence_level (high/medium/low), (6) a concrete example: three signals detected over 10 days — a pricing page change, a new features section, and a headline reposition — combining into an 'enterprise_push' movement.",
    historical_context_prompt:
      "Trace the history of reading strategic intent from correlated signals — from Roman military scouts correlating troop movements to WWI intelligence synthesis to Cold War pattern analysis. Focus on: how isolated events mean little, but correlated patterns across time reveal intent. Each era should illustrate the pattern-of-life concept: individual data points become strategic understanding only when clustered and interpreted over a time window.",
    priority_weight: 8,
  },

  {
    id: "pressure-index",
    feature_name: "Pressure Index",
    short_title: "The Activity Score Behind Each Competitor",
    category: "analysis",
    diagram: "pressure-index",
    accent: "#EF4444",
    key_points: [
      "Each competitor carries a pressure_index from 0.0 to 10.0 — a weighted activity intensity score",
      "Signals decay exponentially with age so recent activity counts more than old",
      "Ambient events (press mentions, hiring, announcements) contribute without triggering interpretation",
    ],
    explanation_prompt:
      "Explain Metrivant's pressure_index calculation in detail. Cover: (1) the formula: pressure = Σ(severity_weight × confidence × exp(-age_days × 0.2)) across recent signals, plus Σ(ambient_event_weight) from the activity_events table for the last 48h, (2) the ambient event weight table — press_mention=0.30, announcement=0.25, hiring_activity=0.20, product_update=0.15, messaging_update=0.12, content_update=0.10, blog_post=0.08, (3) why exponential decay matters — a signal from 14 days ago contributes only ~5.5% of a same-day signal's weight, keeping the index responsive to current activity, (4) the 5.0 threshold that promotes pending_review signals to active interpretation, (5) how pressure_index affects the radar — high-pressure competitors emit stronger echo rings and appear brighter, (6) a concrete example tracing a competitor's index rising from 0.8 to 6.2 over a 5-day burst of activity.",
    historical_context_prompt:
      "Trace the history of threat pressure indexing — from Roman legions grading frontier threat levels to WWI barometric pressure as a war metaphor to Cold War threat level systems (DEFCON). Focus on: how strategists have always needed a single composite number that aggregates disparate signals into an actionable urgency score. Each era should show the recency-weighted aspect: recent activity counts more than old, and the index drives resource allocation decisions.",
    priority_weight: 8,
  },

  {
    id: "page-classes",
    feature_name: "Page Classification",
    short_title: "How Monitoring Frequency Is Assigned",
    category: "detection",
    diagram: "page-classes",
    accent: "#34D399",
    key_points: [
      "Every monitored page belongs to one of three classes: high_value, standard, or ambient",
      "High-value pages (pricing, changelog, newsroom) are crawled hourly — they carry the most strategic signal",
      "Ambient pages (blog, careers) are crawled every 30 minutes for activity-level data only",
    ],
    explanation_prompt:
      "Explain Metrivant's page classification system and why it exists. Cover: (1) the three page classes — high_value (pricing, changelog, newsroom), standard (homepage, features), ambient (blog, careers) — and the monitoring frequency for each, (2) why page class affects signal quality — high_value pages receive a +0.08 confidence bonus and are included in standard pipeline interpretation, while ambient pages feed only the activity_events table (never interpreted), (3) the concept of page_class_bonus in the confidence model, (4) how the pipeline schedule works: ambient crawled at :00 and :30, high_value at :02 past each hour, standard every 3 hours at :04, (5) why this design matters — crawling every page every 30 minutes would be expensive and noisy; page classification focuses compute budget on the pages where strategic changes actually appear, (6) a real example: a competitor quietly pushing a pricing page change that gets detected in the :02 high_value crawl within 58 minutes of the change going live.",
    historical_context_prompt:
      "Trace the history of tiered surveillance and intelligence prioritization — from Roman frontier watchtowers (some manned, some just signaling stations) to WWII signal priority classifications to satellite overpass scheduling. Focus on: how every intelligence operation has limited resources and must assign different monitoring intensity to different targets based on their strategic value. Each era shows a resource allocation decision: which locations/actors get constant watch vs. periodic check vs. ambient awareness.",
    priority_weight: 7,
  },

  {
    id: "sector-intelligence",
    feature_name: "Sector Intelligence",
    short_title: "Finding Patterns Across All Competitors",
    category: "analysis",
    diagram: "sector-intelligence",
    accent: "#06B6D4",
    key_points: [
      "Every Monday, Metrivant runs a cross-competitor analysis across all signals from the last 30 days",
      "GPT-4o identifies convergence patterns — multiple rivals moving in the same direction simultaneously",
      "Sector trends and divergences are reported with evidence signal IDs attached deterministically",
    ],
    explanation_prompt:
      "Explain how Metrivant's sector_intelligence system works. Cover: (1) when it runs — Monday 07:00 UTC, generating one row per org with a 30-day analysis window, (2) the input data — signals pivoted by section_type across all tracked competitors, structured to show which competitors are showing similar signal patterns, (3) what GPT-4o-4o identifies — sector_trends (themes where multiple competitors are converging, with direction and evidence), divergences (competitors moving opposite to peers, which may signal a strategic differentiation), (4) the deterministic post-LLM step — evidence signal IDs are attached to each finding after the AI call, ensuring every insight is traceable to real data, (5) how sector_intelligence feeds the weekly brief — the summary field becomes the brief's sector_summary section, (6) a concrete example: three competitors in a SaaS market all updating pricing pages in the same week, triggering a 'pricing_competition' sector trend.",
    historical_context_prompt:
      "Trace the history of sector-wide pattern analysis — from Venetian merchant guilds tracking spice route competitors collectively, to 19th-century industry intelligence bureaus, to Cold War national intelligence estimates. Focus on: how the most powerful intelligence is not about one actor but about the whole competitive field — identifying when multiple actors are converging on the same strategy simultaneously. Each era shows the cross-competitor synthesis concept.",
    priority_weight: 7,
  },

  {
    id: "weekly-brief",
    feature_name: "Weekly Intelligence Brief",
    short_title: "Intelligence Delivered Every Monday",
    category: "delivery",
    diagram: "weekly-brief",
    accent: "#F59E0B",
    key_points: [
      "Every Monday at 10:00 UTC, Metrivant assembles a competitive intelligence report from pre-built artifacts",
      "The brief is generated from movements, narratives, and sector analysis — not by re-reading raw signals",
      "GPT-4o produces structured output: headline, major moves, strategic implications, recommended actions",
    ],
    explanation_prompt:
      "Explain how Metrivant's weekly brief generation works. Cover: (1) the three artifact sources assembled before the LLM call — sector_intelligence.summary (cross-competitor analysis from Monday 07:00 UTC), strategic_movements with movement_summary and strategic_implication (up to 10, ordered by confidence), radar_narratives (latest per-competitor activity explanation), (2) why the brief uses pre-generated artifacts rather than re-analyzing raw signals — this makes generation fast, cost-predictable, and avoids redundant inference, (3) the GPT-4o prompt structure and output format — BriefContent with headline, competitors_analyzed[], major_moves[], strategic_implications[], recommended_actions[], (4) where the brief is stored and how it's surfaced — weekly_briefs table (org-scoped), email via Resend from briefs@metrivant.com, in-app Briefs page, (5) the fallback behavior — if no artifacts exist for an org, the brief is skipped (no LLM call), (6) a concrete example: how three pricing signals from different competitors combine into a 'pricing competition' movement narrative that surfaces in the brief as a recommended action.",
    historical_context_prompt:
      "Trace the history of the intelligence summary delivered to decision-makers on a regular cycle — from Roman daily military dispatches (acta diurna) to Nelson's weekly fleet intelligence summaries to the CIA's President's Daily Brief. Focus on: how the most strategically valuable intelligence has always been distilled from raw reports into a compact, actionable document delivered at a regular cadence. Each era shows the synthesis-over-raw-data principle.",
    priority_weight: 7,
  },

  {
    id: "signal-velocity",
    feature_name: "Signal Velocity",
    short_title: "How Acceleration Changes Everything",
    category: "analysis",
    diagram: "signal-velocity",
    accent: "#F97316",
    key_points: [
      "Velocity measures the rate at which signals are accumulating for a competitor, not just their total count",
      "A competitor silent for weeks who suddenly emits 4 signals in 3 days registers high velocity",
      "Velocity is a leading indicator — it precedes movement confirmation by days",
    ],
    explanation_prompt:
      "Explain Metrivant's signal velocity system. Cover: (1) how velocity is calculated — signals per day within a rolling window, weighted toward recency, (2) how velocity feeds into momentum_score — higher velocity raises the score, which moves the node closer to the radar center, (3) why velocity is more predictive than raw signal count — a competitor accumulating 2 signals per week for months has low velocity even with high total count; a competitor with 0 signals for 30 days who suddenly emits 6 in 4 days has high velocity, (4) the detect-movements cron job that runs at :55 past each hour — how it looks at velocity alongside signal count and correlation to decide if a movement is forming, (5) the update-signal-velocity cron at :50 past each hour — what it computes and writes, (6) a concrete example: a competitor silent for 3 weeks who suddenly updates pricing, changelog, and features in a 72-hour window — trace how their velocity score changes and how quickly that appears on the radar.",
    historical_context_prompt:
      "Trace the history of using rate-of-change rather than absolute position as the key strategic signal — from Napoleonic cavalry scouts reporting troop march speed to WWI submarine detection by propeller frequency to Cold War missile launch detection by velocity signatures. Focus on: why the speed of change has always been more militarily significant than the fact of change. A force that was distant yesterday but moving fast is more dangerous than one that is close but stationary.",
    priority_weight: 6,
  },

  {
    id: "selector-repair",
    feature_name: "Extraction Auto-Repair",
    short_title: "The System That Fixes Itself",
    category: "system",
    diagram: "selector-repair",
    accent: "#10B981",
    key_points: [
      "If a page changes structure and a CSS selector stops matching, the extraction engine detects the drift",
      "The selector repair system re-fetches the live page and proposes a corrected selector via GPT-4o-mini",
      "Repairs are reviewed by operators — never auto-applied — to maintain data integrity",
    ],
    explanation_prompt:
      "Explain Metrivant's selector repair system. Cover: (1) what triggers a repair suggestion — 3 consecutive suspect validations within 72 hours for a (page, section) pair, (2) the suggest-selector-repairs cron job (daily 04:00 UTC) — how it fetects drift and re-fetches the live page HTML, (3) the GPT-4o-mini step — the live HTML is passed to the model with a description of what the section should contain; the model proposes a new CSS selector, (4) the Cheerio validation step — the proposed selector is tested against the live HTML before being stored, (5) the operator review flow — suggestions are stored in selector_repair_suggestions and never auto-applied; a human must approve, (6) why this matters — without selector repair, a competitor's website redesign would silently stop all monitoring for affected sections, making gaps in the signal history look like 'no changes' when really monitoring had failed.",
    historical_context_prompt:
      "Trace the history of self-repairing intelligence networks — from Roman cursus publicus relay stations that rerouted around broken links, to WWII codebreakers adapting to Enigma machine changes, to Cold War SOSUS hydrophone network recalibration after environmental shifts. Focus on: how every long-running surveillance system must adapt when the target changes their surface — the observer must update their collection method or lose visibility entirely. The human-in-the-loop approval step is key in each era.",
    priority_weight: 5,
  },

  {
    id: "critical-alert",
    feature_name: "Critical Alert System",
    short_title: "Five Conditions That Fire One Alert",
    category: "delivery",
    diagram: "critical-alert",
    accent: "#EF4444",
    key_points: [
      "A critical alert fires only when all five criteria are met simultaneously — false positives are worse than misses",
      "The thresholds: momentum ≥ 7, signals in 7 days ≥ 3, confidence ≥ 0.70, movement type confirmed, last seen < 48h",
      "At most one critical alert fires per radar load — the highest-momentum qualifier wins",
    ],
    explanation_prompt:
      "Explain Metrivant's critical alert system and why it uses five simultaneous criteria. Cover: (1) all five criteria and the reasoning behind each threshold — momentum ≥ 7 (significantly above the accelerating floor of 5), signals_7d ≥ 3 (not a single anomaly), confidence ≥ 0.70 (above the pending gate), movement_type present (a specific pattern identified), last_seen < 48h (data is fresh, not historical), (2) why the conservative thresholds exist — in an intelligence product, false positives cause alert fatigue and destroy trust faster than occasional missed alerts, (3) the session dedup mechanism — sessionStorage key prevents the same alert from firing twice in a session, (4) what happens when an alert fires — the radar SVG rings pulse in the movement's color, the alerted node blooms, an alert banner overlays the bottom of the radar, a navigation link to the Strategy page appears, (5) how alerts are stored and emailed — alerts table per org, email sent via Resend from alerts@metrivant.com, (6) a concrete example: a competitor emitting 5 signals in 7 days with a confirmed enterprise_push movement at 0.78 confidence — trace the exact moment the alert fires.",
    historical_context_prompt:
      "Trace the history of multi-condition alert systems designed to prevent false alarms — from the Byzantine beacon fire chain that required confirmation before escalating a border alarm, to WWII 'Two-Man Rule' nuclear authorization requiring simultaneous independent confirmation, to Cold War NORAD's requirement for multiple correlated radar contacts before declaring a launch event. Focus on: why the most consequential alerts have always required multiple simultaneous conditions to fire — the cost of a false positive in high-stakes environments is catastrophic.",
    priority_weight: 8,
  },

  {
    id: "momentum-states",
    feature_name: "Momentum States",
    short_title: "Reading the Radar's Color Language",
    category: "interface",
    diagram: "momentum-states",
    accent: "#2EE6A6",
    key_points: [
      "Every competitor on the radar is in one of four states: Cooling, Stable, Rising, or Accelerating",
      "State affects node color, size, echo ring speed, and position on the radar",
      "Accelerating competitors (score ≥ 5) pulse faster — this is not decoration, it is data",
    ],
    explanation_prompt:
      "Explain Metrivant's four momentum states and how they are encoded visually. Cover: (1) the score thresholds and visual properties for each state — Cooling (< 1.5, slate #64748b, slow echo), Stable (1.5–3, green #2EE6A6, moderate echo), Rising (3–5, amber #f59e0b, faster echo), Accelerating (≥ 5, red #ef4444, fastest echo at 1.5s), (2) how each visual dimension — color, node size, echo ring animation speed, opacity — encodes a different dimension of competitor activity, (3) the confidence-proportional opacity system — nodes with lower-confidence movements appear at 75–88% opacity; nodes with high-confidence movements at full opacity, (4) signal type micro-shapes — small icons inside each node indicate the type of last signal (dash for pricing shift, plus for product expansion, diamond for repositioning, arrow for enterprise push), (5) the golden spiral distribution — why competitors are placed in a deterministic position rather than randomly, and how this makes the radar readable even with 25+ competitors, (6) how to read the radar in practice: which quadrant shows the most activity, what the combination of size + color + echo speed communicates about competitive threat level.",
    historical_context_prompt:
      "Trace the history of color-coded and state-coded battlefield status displays — from the Roman military's colored signal flags distinguishing march/hold/attack states, to Nelson's signal flag vocabulary at Trafalgar, to WWII RAF sector operations rooms using colored blocks on plotting tables to show aircraft state (in-flight/low-fuel/returning). Focus on: how encoding multiple dimensions of information into a single visual token (color + position + size) allows an operator to read a complex field at a glance without reading text.",
    priority_weight: 7,
  },

];
