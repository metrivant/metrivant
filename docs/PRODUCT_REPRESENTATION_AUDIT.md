# Metrivant Product Representation Audit
Audit date: 2026-03-17
Type: Current-state visualization — no changes made

---

> **This is a read-only audit. Nothing was modified.**
> All claims are grounded in actual file paths and field names.

---

## 1. Backend Truth Inventory

### 1.1 signals

| Property | Value |
|---|---|
| Table | `signals` |
| Produced by | `api/detect-signals.ts` |
| Type | Deterministic (confidence gates) + AI-classified (relevance) |
| Org-scoped | Via `competitor_id` → `tracked_competitors` |
| Active | Yes |

**Key fields:**

| Field | Meaning | Computed by |
|---|---|---|
| `confidence_score` | 0.0–1.0 deterministic score from section weights + bonuses | detect-signals |
| `status` | `pending` / `pending_review` / `interpreted` / `suppressed` | detect-signals + update-pressure-index |
| `relevance_level` | `high` / `medium` / `low` — AI pre-filter | interpret-signals (classifySignalRelevance) |
| `relevance_rationale` | One-sentence AI rationale for relevance classification | interpret-signals |
| `signal_type` | Classified type (feature_launch, pricing_change, etc.) | detect-signals |
| `signal_data` | `{ previous_excerpt, current_excerpt }` — raw evidence strings | detect-signals |
| `severity` | `high` / `medium` / `low` | detect-signals |
| `source_type` | `page_diff` / `feed_press_release` / `feed_newsroom_post` | detect-signals / promote-feed-signals |
| `signal_hash` | sha256 dedup key per competitor+type+section+diff | detect-signals |
| `section_diff_id` | FK to source diff | detect-signals |
| `monitored_page_id` | FK to source page | detect-signals |
| `suppressed_at` / `suppressed_reason` | Suppression record | detect-signals |
| `is_duplicate` | Boolean dedup flag | detect-signals |

**Confidence gate model** (detect-signals.ts):
- `< 0.35` → no signal created (silently suppressed)
- `0.35–0.64` → `status=pending_review` (held; promoted when `pressure_index >= 5.0`)
- `>= 0.65` → `status=pending` (sent to interpretation)

---

### 1.2 interpretations

| Property | Value |
|---|---|
| Table | `interpretations` |
| Produced by | `api/interpret-signals.ts` |
| Type | AI-derived (gpt-4o or gpt-4o-mini) |
| Org-scoped | Via signal → competitor |
| Active | Yes |

**Key fields:** `signal_id`, `model_used`, `change_type`, `summary`, `strategic_implication`, `recommended_action`, `urgency` (1–5), `confidence` (0.0–1.0), `old_content`, `new_content`

**Model routing:** gpt-4o if `page_class=high_value` OR `confidence_score >= 0.75`; otherwise gpt-4o-mini.

---

### 1.3 strategic_movements

| Property | Value |
|---|---|
| Table | `strategic_movements` |
| Produced by | `api/detect-movements.ts` (creation) + `api/synthesize-movement-narratives.ts` (enrichment) |
| Type | Deterministic detection + AI narrative synthesis (gpt-4o) |
| Org-scoped | Via `competitor_id` |
| Active | Yes |

**Key fields:** `movement_type`, `confidence` (computed), `signal_count`, `velocity`, `first_seen_at`, `last_seen_at`, `movement_summary`, `strategic_implication`, `confidence_level` (low/medium/high), `confidence_reason`

**Minimum requirement:** 2 signals per movement (14-day window).

---

### 1.4 radar_narratives

| Property | Value |
|---|---|
| Table | `radar_narratives` |
| Produced by | `api/generate-radar-narratives.ts` + `lib/radar-narrative.ts` |
| Type | AI-derived (gpt-4o-mini, temp 0.1, max_tokens 120) |
| Org-scoped | Via `competitor_id` |
| Active | Yes — triggers on: movement updated, ≥2 new signals/7d, pressure +1.5, or high_value signal |

**Key fields:** `competitor_id`, `narrative` (short text), `pressure_index`, `signal_count`, `evidence_signal_ids` (array of signal IDs that fed the narrative)

**Rate limit:** 12h minimum between regenerations (high_value signal overrides).

---

### 1.5 sector_intelligence

| Property | Value |
|---|---|
| Table | `sector_intelligence` |
| Produced by | `api/generate-sector-intelligence.ts` |
| Type | AI-derived (gpt-4o, weekly) |
| Org-scoped | Yes (`org_id`) |
| Active | Yes — Monday 07:00 UTC. Currently EMPTY (no rows generated yet). |

**Key fields:** `org_id`, `sector_trends` (JSONB), `divergences` (JSONB), `summary`

---

### 1.6 radar_feed output

| Property | Value |
|---|---|
| Endpoint | `api/radar-feed.ts` |
| Type | Computed aggregate — no table of its own |
| Org-scoped | Yes (via `tracked_competitors`) |
| Active | Yes |

This is the single object the UI consumes. It joins signals, movements, narratives, and pressure into a flat `RadarCompetitor` shape. **This is where most compression and information loss occurs.** See Section 2.

---

### 1.7 pressure_index

| Property | Value |
|---|---|
| Column | `competitors.pressure_index` |
| Produced by | `api/update-pressure-index.ts` |
| Type | Deterministic formula (signal severity × confidence × recency decay + ambient events) |
| Org-scoped | Via `competitor_id` |
| Active | Yes — scheduled every 30 min |

Formula: `Σ(SEVERITY_WEIGHT × confidence_score × exp(-age_days × 0.2)) + Σ(ambient_event_weight)`, capped at 10.0.

**Dual role:** (1) feeds into `momentum_score` computation in radar-feed; (2) gates promotion of `pending_review` signals to `pending` when `>= 5.0`.

---

### 1.8 activity_events

| Property | Value |
|---|---|
| Table | `activity_events` |
| Produced by | `api/detect-ambient-activity.ts` |
| Type | Deterministic (ambient pages only) |
| Org-scoped | Via `competitor_id` |
| Active | Yes — 30-day retention |

**Key fields:** `event_type`, `source_headline`, `url`, `detected_at`, `page_class` (always ambient)

---

### 1.9 section_diffs

| Property | Value |
|---|---|
| Table | `section_diffs` |
| Produced by | `api/detect-diffs.ts` |
| Type | Deterministic |
| Active | Yes |

**Key fields:** `diff_text`, `is_noise`, `noise_reason`, `confirmation_count`, `observation_count`, `first_seen_at`, `last_seen_at`, `status`, `page_class`

These are the raw evidence layer. They feed signals but are **never exposed in any frontend surface.**

---

### 1.10 monitored_pages health_state

| Property | Value |
|---|---|
| Column | `monitored_pages.health_state` |
| Values | `healthy` / `blocked` / `challenge` / `degraded` / `baseline_maturing` / `unresolved` |
| Active | Yes — updated per-fetch |

Live data (2026-03-17): 314 active pages — 59% `unresolved`, 30% `healthy`, 5% `challenge`, 5% `blocked`, 1% `degraded`. **Never surfaced in the UI.**

---

## 2. Transformation Layer Map

### 2.1 radar-feed.ts — the primary compression point

`api/radar-feed.ts` joins 6 data sources and compresses them into a single flat `RadarCompetitor` object per competitor.

**Momentum score formula** (radar-feed.ts):
```
signalComponent    = signals_7d × 0.4
velocityComponent  = weighted_velocity_7d × 0.6
movementBonus      = latest_movement_confidence × 2.5 × max(0, 1 - age_days/14)
pressureBonus      = min(1.0, pressure_index × 0.1)
momentum_score     = min(10, signalComponent + velocityComponent + movementBonus + pressureBonus)
```

**What gets compressed in radar-feed:**

| Backend truth | What arrives in RadarCompetitor | Information loss |
|---|---|---|
| All signals for competitor | `signals_7d` (count), `signals_pending` (count) | All individual signal data, confidence, type breakdown, evidence |
| All signal types | `latest_signal_type` (single most recent) | Distribution of signal types |
| All movements | `latest_movement_*` (one movement's worth of fields) | All prior movements; only the most recent survives |
| movement.signal_count | `latest_movement_signal_count` | Whether that count is 2 or 20 is treated equally |
| All radar narratives for competitor | `radar_narrative` (single string) | Historical narratives, which specific signals fed the narrative |
| `pressure_index` (backend, 0–10) | `pressure_index` (passed through) | Not used directly in node rendering |
| `weighted_velocity_7d` | Fed into momentum formula | Not exposed as a standalone value |
| `source_type` per signal | Not in RadarCompetitor | Whether signals came from page_diff vs feed is lost |
| `relevance_level` per signal | Not in RadarCompetitor | Filtered/unfiltered signal ratio invisible |
| `status=pending_review` signals | Not in RadarCompetitor | Held signals are invisible |
| `health_state` per page | Not in RadarCompetitor | Coverage quality invisible |

---

### 2.2 Frontend derivation layer (no further DB access)

After the radar feed arrives, the frontend derives additional representations without hitting the DB:

| Frontend lib | Input | Output | What it drops |
|---|---|---|---|
| `momentum.ts:getMomentumState()` | `momentum_score` (0–10) | 4-bucket label: cooling/stable/rising/accelerating | All intermediate scoring detail |
| `pressure.ts:computePressureIndex()` | `competitors[]` from radar feed | 3-level sector pressure: Low/Moderate/High | **Ignores backend `pressure_index` entirely.** Recomputes a different metric from avgMomentum + 24h density |
| `tension.ts:computeTensionLinks()` | `competitors[]` | Pairwise links between competitors sharing `latest_movement_type` | Links based only on shared movement type, not signal content similarity |
| `activityEcho.ts:deriveActivityEchoes()` | `competitors[]` | Map of competitors with activity in last 24h, with echo labels | Labels derived from movement type only, not from actual signal type |
| `activityEcho.ts:isWeakSignal()` | `momentum_score`, `signals_7d`, `latest_movement_confidence` | Boolean for dashed orbit ring | Binary encoding loses intermediate values |
| `criticalAlert.ts:detectCriticalAlert()` | `competitors[]` | Single CriticalAlert or null | All qualifying competitors except highest-momentum one |
| `microInsights.ts:generateMicroInsights()` | `competitors[]` | Up to 5 string observations | No API call — pure string templates from counts/states |

---

### 2.3 Backend field → computed field → UI element (master table)

| Backend field | Computed as | UI element | Component |
|---|---|---|---|
| `momentum_score` (radar-feed formula) | `getMomentumState()` → 4 buckets | Node ring state label, echo duration | `Radar.tsx`, `momentum.ts` |
| `momentum_score` | Zone band (dormant/watch/active/critical) | Radial position | `Radar.tsx` ZONE_RADII |
| `momentum_score` | `16 + sqrt(momentum) * 3.2` | Node diameter (px) | `Radar.tsx` BlipNode |
| `latest_movement_type` | Color map (pricing=#FF2AD4, product=#00F5FF, market=#FF7A00, enterprise/eco=#9B5CFF, null=#4A6FA5) | Node color + micro-symbol | `Radar.tsx` |
| `latest_movement_type` | Movement label string | IntelligenceStrip tag, DailyBriefOverlay | `IntelligenceStrip.tsx` |
| `latest_movement_confidence` | Opacity (>=0.65→1.0, 0.4–0.64→0.88, <0.4→0.75) | Node opacity when not selected | `Radar.tsx` |
| `latest_movement_confidence` + `signals_7d` + `momentum_score` + recency | `detectCriticalAlert()` ALL-must-pass | Critical alert bloom + banner | `criticalAlert.ts`, `Radar.tsx` |
| `last_signal_at` | Age buckets (<6h=amber, <24h=slate, >24h=blue-grey) | Node atmospheric glow color/intensity | `Radar.tsx` |
| `last_signal_at` | `< 24h` boolean | "New 24h" count, DailyBriefOverlay, activityEcho | Multiple |
| `signals_7d` | Raw count | MicroInsights total, momentum formula | `microInsights.ts` |
| `radar_narrative` | Direct pass-through | Shown in detail drawer on competitor select | `Radar.tsx` |
| `latest_movement_summary` | Direct pass-through | Shown in detail drawer, DailyBriefOverlay "highest activity" | `Radar.tsx`, `DailyBriefOverlay.tsx` |
| `trail[]` | SVG dots at historical positions | Motion history dots behind node | `Radar.tsx` BlipNode |
| `pressure_index` (backend) | Feeds movementBonus in momentum formula | Indirectly affects node position/size | `radar-feed.ts` |
| `competitors[]` avgMomentum + 24h density | `computePressureIndex()` (frontend) | "Sector Pressure: Low/Moderate/High" indicator | `pressure.ts`, `Radar.tsx` |
| `latest_movement_type` shared by 2+ nodes | `computeTensionLinks()` | SVG arc lines between nodes (tension web) | `tension.ts`, `Radar.tsx` |
| `interpretation.confidence` | `confidenceLanguage()` → tier + adverb + prefix | Prefix before interpretation text in detail panel | `confidence.ts` |
| `interpretation.summary` | Direct | Shown in detail panel | `Radar.tsx` |
| `interpretation.strategic_implication` | Direct | Shown in detail panel | `Radar.tsx` |
| `interpretation.urgency` | Urgency color/label | Shown in detail panel | `Radar.tsx` |
| `strategic_movements` (all) | Only latest surfaced via radar-feed | Single movement badge in UI | `radar-feed.ts` |
| `relevance_level` | **DROPPED** | Never shown | — |
| `source_type` | **DROPPED** | Never shown | — |
| `health_state` | **DROPPED** | Never shown | — |
| `status=pending_review` signals | **DROPPED** | Never shown | — |
| `confidence_score` on signals | **DROPPED** (not in RadarCompetitor) | Never shown on radar | — |
| `evidence_signal_ids` in radar_narratives | **DROPPED** | Never shown | — |
| `section_diffs` | **DROPPED** | Never shown | — |

---

## 3. Frontend Representation Map

### 3.1 Radar screen (`Radar.tsx`, 4,276 lines)

The primary surface. The radar is a 1000×1000 SVG instrument.

**Node encoding:**

| Visual property | Meaning implied | Actual backend driver | Explicit? |
|---|---|---|---|
| Radial distance from center | "How active / threatening is this competitor" | momentum_score zone band | Implicit — no legend |
| Node size | Importance / activity level | `16 + sqrt(momentum) * 3.2` | Implicit |
| Node color | What kind of strategic move | `latest_movement_type` color map | Implicit — micro-symbol helps |
| Micro-symbol (dash/cross/diamond/arrow) | Movement category hint | `latest_movement_type` | Semi-explicit (no legend) |
| Glow color (amber/slate/grey) | Recency of last signal | `last_signal_at` age bucket | Implicit |
| Node opacity | How confident the system is in the movement | `latest_movement_confidence` scaled | Hidden |
| Filled vs hollow core | Active vs dormant | `momentum_score > 0` | Implied by fill only |
| Dashed orbit ring | Weak signal — activity not yet a movement | `signals_7d >= 1 && momentum < 1.5` OR `movement_confidence < 0.45` | Implicit |
| Pulse ring (rising) | Movement building | `momentum >= 3 && < 5` | Implicit |
| Alert bloom ring | Critical acceleration event | All-criteria threshold | Implicit |
| Trail dots | Motion history | `trail[]` historical positions | Implicit |
| Tension arc lines | Competitors converging on same strategy | Shared `latest_movement_type` | Explicit label on hover only |

**Mode: Gravity Field** — nodes orbit based on `pressure_index` as gravitational mass. Wells form around high-pressure competitors. This is visually meaningful but entirely implicit; users have no way to know nodes are positioned by a computed score.

**Temporal filter (24h/7d/all):** Dims competitors with no signal in the selected window. Uses `last_signal_at`. Does not distinguish between interpreted signals and pending_review signals — a competitor with only pending_review signals (held by confidence gate) would appear active.

**Intelligence Drawer (on node select):**
- Competitor name, website
- Radar narrative (if present) — `radar_narrative` field
- Signals list: type, page_type, summary, strategic_implication, urgency, confidence, evidence excerpts
- Movements: type, confidence, signal_count, velocity, date range
- Monitored pages: page_type list only

---

### 3.2 Intelligence Strip (`IntelligenceStrip.tsx`)

Scrolling ticker at top of radar screen.

- Shows per-competitor movement tags derived from `latest_movement_type`
- Shows Google News RSS headlines (NOT Metrivant signal data)
- Movement tags: PRICING / PRODUCT / REPOSITION / ENTERPRISE / ECOSYSTEM / ACTIVE
- Sector news items are labeled `[SECTOR]` — externally fetched, not system output

**Key gap:** The strip interleaves Metrivant-detected signals with live RSS headlines from Google News with identical visual treatment. No visual distinction between internal intelligence and external news context.

---

### 3.3 Competitor Detail Panel (via `api/competitor-detail/route.ts` → `api/competitor-detail.ts`)

Loaded when a radar node is selected. Returns:

```
CompetitorDetail {
  competitor: { id, name, website_url }
  movements:  [ { movement_type, confidence, signal_count, velocity, first/last_seen_at } ]
  signals:    [ { signal_type, severity, detected_at, page_type, summary, strategic_implication,
                  recommended_action, urgency, confidence, previous_excerpt, current_excerpt } ]
  monitoredPages: [ { page_type } ]
}
```

**What is shown:** interpretation summary, strategic implication, urgency, confidence tier (via `confidenceLanguage()`), previous/current excerpts.

**What is NOT shown:** `confidence_score` on the signal itself (only interpretation.confidence is shown), `relevance_level`, `source_type`, `status` (pending_review vs interpreted), `signal_hash`, `section_diff_id`, `health_state` of monitored pages, `observation_count` on diffs.

---

### 3.4 Strategy surface (`app/app/strategy/page.tsx` + `lib/strategy.ts`)

**Data source:** `strategic_insights` table (populated by `api/strategic-analysis/route.ts`, daily 08:00).

**Important:** This surface uses a *separate AI pass* (gpt-4o, temp 0.2) that takes the already-aggregated `RadarCompetitor[]` feed as input — **it does not look at raw signals or interpretations directly.** It produces cross-competitor pattern analysis from movement summaries.

**What is shown:** Pattern type, strategic_signal headline, description, competitor pills, confidence bar (via `confidenceLabel()`), recommended_response, horizon tier (Immediate/Near-Term/Emerging based on age + confidence).

**Visual encoding:** Color by pattern type (6 types, each with distinct color). `is_major` flag controls visual prominence.

---

### 3.5 Briefs surface (`app/app/briefs/page.tsx` + `BriefViewer.tsx`)

**Data source:** `weekly_briefs` table (generated Monday 10:00 UTC via `api/generate-brief/route.ts`).

`BriefViewer.tsx` processes the `weekly_briefs.content` JSONB field (a `BriefContent` object) and renders:
- "Major Moves" — competitor movements with trajectory badge, severity badge, confidence bar
- "Strategic Implications" — broader themes
- "Recommended Actions" — per-action cards
- "Signal Timeline" — list of moves with `first_seen_at`

**Critical finding — confidence derivation in BriefViewer:**
`BriefViewer.tsx` derives confidence from `severity` string via a hardcoded mapping:
- `high` → 0.82
- `medium` → 0.60
- `low` → 0.38

This is a *reconstructed approximation*, not the actual `interpretation.confidence` value. The real interpretation confidence (0.0–1.0) from the interpretations table is not carried through to `weekly_briefs.content`.

---

### 3.6 Daily Brief Overlay (`DailyBriefOverlay.tsx`)

Modal shown once per day, 900ms after page load. Content:
- `newToday` = competitors with `last_signal_at` < 24h
- `activeCount` = competitors with `momentum_score > 0`
- `topCompetitor` = highest momentum competitor name + movement_type

**Entirely derived from radar feed, no additional fetch.** The "X rivals moved in the last 24 hours" headline uses `last_signal_at` — this includes competitors whose only signals are in `pending_review` status. The overlay does not distinguish between interpreted signals and held signals.

---

### 3.7 Historical Capsule (`HistoricalCapsule.tsx` + `lib/intel-stories.ts`)

A carousel of competitive intelligence case studies. **These are 20+ hardcoded historical industry stories** (e.g. how Microsoft missed the cloud, how Blockbuster missed streaming) — they are **not derived from the user's own signal data.**

Shown as "intelligence instrument" context pieces with illustrations, draggable cards, and a "Learn More" expansion via GPT-4o-mini API call. They are presented with the same visual language as the rest of the product.

**Finding:** These stories communicate product *intent* but carry no relationship to what the system has actually detected. A user could reasonably interpret them as examples of what Metrivant found about their specific competitors.

---

### 3.8 MicroInsights overlay (via `lib/microInsights.ts`)

Rotating one-liners overlaid on the radar (e.g. "3 rivals accelerating simultaneously", "2 rivals showing pricing movement"). Rotate every 9 seconds.

**These are deterministic string templates — no AI call, no DB call beyond the already-loaded radar feed.** They are presented in the same visual register as AI-derived intelligence, but are pure count-based templates.

---

## 4. Signal Visibility Audit

### Surfaced

| Artifact | Where | Notes |
|---|---|---|
| Signal existence (count) | `signals_7d` in radar feed | Count only — no individual signal data |
| Signal type (latest) | `latest_signal_type` in detail panel | One signal type; distribution not shown |
| Interpretation summary | Detail panel | Shown per-signal in the drawer |
| Interpretation strategic_implication | Detail panel | Shown per-signal |
| Interpretation urgency | Detail panel | Color + label |
| Interpretation confidence | Detail panel | Via `confidenceLanguage()` prefix |
| Evidence excerpts | Detail panel | `previous_excerpt` / `current_excerpt` |
| Latest movement type | Radar node color + strip tag | Encoded visually |
| Movement confidence | Node opacity + detail panel | Opacity encoding only on radar; explicit in drawer |
| Movement summary | Detail panel + DailyBriefOverlay | Only for top competitor in overlay |
| Radar narrative | Detail panel | Shown as prose |
| Activity events (ambient) | ActivityTimeline | Shown with "ambient" badge |
| Strategic movements | Strategy page + Briefs | Via analysis pipeline |

### Partially Surfaced

| Artifact | What's shown | What's hidden |
|---|---|---|
| Signals | Count + latest type + excerpts | Confidence score, relevance_level, source_type, status, suppressed count, pending_review count |
| Strategic movements | Only the latest movement per competitor | All prior movements; only `latest_*` fields reach UI |
| pressure_index (backend) | Indirectly via momentum formula | Direct backend value never displayed; frontend recomputes a different pressure metric |
| Radar narratives | Narrative text | `evidence_signal_ids` — which signals generated the narrative |
| Sector intelligence | Via weekly briefs | Stored fields (sector_trends, divergences) never surfaced directly |
| Competitor monitored pages | Page type list in drawer | No URL, no health_state, no blocked/challenge status |

### Not Surfaced

| Artifact | Notes |
|---|---|
| `signals.confidence_score` | The deterministic quality score per signal — never shown anywhere in UI |
| `signals.relevance_level` | Whether a signal was classified high/medium/low by AI pre-filter — invisible |
| `signals.relevance_rationale` | The AI rationale for relevance classification — invisible |
| `signals.status=pending_review` | Signals held by confidence gate — invisible to user. User cannot know signals are being held. |
| `signals.source_type` | Whether intelligence came from page crawl vs newsroom feed — invisible |
| `signals.suppressed_at/suppressed_reason` | Suppressed signals — invisible |
| `section_diffs` | Raw diffs, noise flags, observation counts — invisible |
| `monitored_pages.health_state` | Whether any page is blocked, challenged, degraded — invisible |
| `activity_events.url` | Source URL of ambient events — not shown in ActivityTimeline |
| `radar_narratives.evidence_signal_ids` | Which signals generated the narrative — invisible |
| `sector_intelligence` directly | Sector trends and divergences table — only reaches UI as brief input |
| `weekly_briefs.movements` / `.activity` JSONB | These structured fields exist but BriefViewer renders from `content` JSONB, not these fields |
| Suppression metrics (noise/confidence gates) | Suppressed signal rate, confidence threshold misses — invisible |
| Coverage gaps | 59% of active pages currently `unresolved` — user has no awareness |
| Pool 1 as only active data source | User sees no provenance indicator for signal source |

---

## 5. Uncertainty / Honesty Audit

| Uncertainty | Visible to user | Where shown | If hidden: user likely assumes |
|---|---|---|---|
| Signal confidence score (0.0–1.0) | No | Nowhere in radar or feed | All shown signals are equally reliable |
| Interpretation confidence (0.0–1.0) | Partially | Language prefix in detail panel only ("likely", "almost certainly") | Language prefix is subtle; user may not notice |
| Relevance classification | No | Nowhere | Every signal the system saw was relevant |
| Pending_review signals (held) | No | Nowhere | Competitors with only pending_review signals appear active but "quiet" — user cannot know intelligence is being held |
| Page health (blocked/challenge) | No | Nowhere | The system is monitoring what it says it monitors; blocked pages produce no gap |
| Coverage maturity (59% unresolved) | No | Nowhere | The radar is fully operational; low signal count = quiet competitor |
| Movement synthesis minimum (2 signals) | No | Nowhere | Movements are authoritative regardless of underlying signal count |
| Radar narrative triggers | No | Nowhere | User cannot know whether narrative is new or stale (12h rate limit) |
| Sector intelligence absence | No | Brief shows null sector_summary silently | Brief appears complete; user may not notice absence of sector analysis |
| Pool 1 only (newsroom) | No | Nowhere | Full pool coverage implied by product framing |
| Historical Capsule = fictional stories | No | Same visual treatment as product UI | These are real examples of what Metrivant detected |
| MicroInsights = string templates | No | Presented as intelligence observations | These are AI-derived observations about this competitor set |
| DailyBriefOverlay "X rivals moved" | Partial | last_signal_at used, but no qualification | Signal counts include pending_review; "moved" may be overstated |
| BriefViewer confidence bars | No — reconstructed from severity | Confidence bars shown as real values | Confidence bars reflect actual measured AI certainty |
| IntelligenceStrip sector news | Partially — [SECTOR] tag | Google News RSS, same visual weight as signals | Strip contains Metrivant intelligence; news items are context layer |
| Strategy analysis = second-order AI | No | Presented as intelligence | Cross-competitor patterns are AI-derived from already-derived movement summaries, not from raw evidence |
| Velocity RPC absent | No | Nowhere | velocity_score is meaningful |

---

## 6. User Understanding Model

### 6.1 What a user most likely thinks the radar means

> "Each dot is a competitor. Dots closer to the center are more active or threatening. Bigger dots have done more recently. Colored dots are doing something specific (pricing, product, etc.). The system is watching all of them continuously and this is live intelligence."

### 6.2 What the radar actually means in code

- Distance from center = `momentum_score` zone band (0–4 dormant, 4–6 watch, 6–8 active, 8–10 critical), where `momentum_score` is a formula combining 7-day signal count × 0.4 + weighted velocity × 0.6 + movement confidence decay bonus + pressure bonus.
- Size = `16 + sqrt(momentum) * 3.2` — purely momentum derived.
- Color = `latest_movement_type` only — a single field, the most recent movement, not the dominant pattern.
- "Live" = radar feed is fetched fresh on page load, but node data reflects the last pipeline run (cron-driven, not real-time).

### 6.3 Where meanings are aligned

- More active competitors do appear closer to center. ✓
- Movement type is faithfully encoded in color. ✓
- Alert bloom correctly fires only on strong multi-criteria evidence. ✓
- Confidence tier language in detail panel is honest and calibrated. ✓
- Dashed ring for weak signals is a useful (if implicit) uncertainty signal. ✓

### 6.4 Where meanings are misaligned

**1. Position implies comprehensive monitoring when coverage is partial.**
The radar has 95 healthy pages out of 314 active. The remaining pages are unresolved, blocked, or degraded. A competitor appearing "quiet" (center-area, cooling) may simply have blocked pages — not actually be quiet. The UI conveys no gap. The user assumes the system would show movement if there were movement.

**2. The radar pressure gauge (sector pressure: Low/Moderate/High) recomputes pressure from frontend data — not from the backend `pressure_index`.**
`pressure.ts:computePressureIndex()` ignores `competitors[].pressure_index` (the carefully computed backend value) and instead re-derives "sector pressure" from average momentum and 24h density ratio. The backend pressure_index (which gates signal promotion and feeds momentum calculations) is never directly surfaced. A user reading "Sector Pressure: Low" may have competitors with high backend pressure_index values that just haven't reached `>= 5.0` to promote their held signals.

**3. A competitor can look active while all its signals are in pending_review.**
`last_signal_at` on a competitor is updated when signals are detected — including `pending_review` signals. A competitor node will show amber glow, appear as "newToday" in the DailyBriefOverlay, and trigger activityEcho pulses even when all its signals are held below the interpretation threshold. The UI implies "this competitor did something" when the system has concluded "we detected something but aren't confident enough to surface it."

**4. The Intelligence Strip mixes internal and external data with equal visual weight.**
Metrivant-detected movements and Google News RSS headlines scroll in the same ticker with nearly identical styling. The `[SECTOR]` label is the only distinction, and it appears at the same visual prominence as `[PRICING]`, `[PRODUCT]`, etc.

**5. MicroInsights appear as AI analysis; they are string templates.**
Phrases like "3 rivals showing pricing movement" look like intelligent observations. They are deterministic string constructions from counts. No AI, no DB query.

**6. Historical Capsule stories are illustrative content presented in product context.**
The same visual container (dark card, green accent, "Metrivant" branding) is used for both the radar (showing real data) and the HistoricalCapsule (showing hardcoded industry history stories). A new user encountering this feature has no way to know these are illustrative templates rather than system-detected events.

**7. BriefViewer confidence bars are reconstructed, not real.**
The confidence bars in BriefViewer are derived from `severity` (high→0.82, medium→0.60, low→0.38) — a fixed mapping. The actual `interpretation.confidence` (which varies per interpretation) is not in the `weekly_briefs.content` JSONB field that BriefViewer reads.

**8. Strategy analysis is second-order AI, not direct evidence.**
The strategy surface runs gpt-4o on the already-aggregated `RadarCompetitor[]` feed — movement summaries that were themselves AI-generated from signals. The user sees this as "Metrivant has detected: Feature Convergence" but the actual evidence chain is: raw page diff → signal → gpt-4o-mini interpretation → movement synthesis → radar feed compression → second gpt-4o analysis → strategic_insight. Each step introduces approximation that is invisible to the user.

### 6.5 Backend truths likely invisible to the user

- The confidence gating model and why some signals never appear
- The existence of pending_review signals (intelligence being held)
- Page health state and coverage gaps
- That only Pool 1 (newsroom feeds) is active among 7 planned pools
- The difference between `page_diff` and `feed_event` sourced signals
- That radar narratives have a 12h rate limit and evidence_signal_ids
- That sector intelligence is empty (weekly brief quietly omits sector_summary)
- The observation_count model on diffs (a diff is confirmed at count=2)

### 6.6 Does the current UI help the user answer these questions?

| Question | Answered? | Notes |
|---|---|---|
| What changed? | Partially | Evidence excerpts in detail panel; but only for interpreted signals |
| Why does it matter? | Partially | `strategic_implication` in detail panel; but requires clicking into a node |
| How certain is this? | Weakly | Confidence language prefix in detail panel; no confidence on radar surface itself |
| What should I look at next? | Weakly | `recommended_action` in detail panel; strategy page has recommended_response; but both require navigation |

---

## 7. Product Hierarchy Assessment

### 7.1 Current UI emphasis order

1. **Radar** — the primary, dominant surface. Full screen. All visual weight.
2. **Strategy** — cross-competitor AI analysis (requires navigation)
3. **Briefs** — weekly GPT-4o digest (requires navigation)
4. **Discover** — competitor catalog (onboarding-focused)
5. **Alerts** — push notifications for critical signals
6. **Evidence** — only accessible by clicking a radar node; never the primary view

### 7.2 Intended hierarchy (based on product definition)

From CLAUDE.md: *"The product is signals, signal quality, signal interpretation, trustworthy competitive attention."*

The real product hierarchy should be:
1. Evidence / signals (with quality indicators)
2. Interpretation (what it means)
3. Movements (patterns across time)
4. Competitor summary (aggregated view)
5. Sector summary (cross-competitor patterns)

### 7.3 Gap assessment

| Layer | Where it sits in current UI | Where it should sit |
|---|---|---|
| Evidence (signals, diffs, confidence) | Hidden behind node click → detail panel | Should be the foundation every surface is built on |
| Interpretation | In detail panel | Should be primary; currently tertiary |
| Movements | In detail panel + strategy page | Partially correct; strategy surface is effective |
| Competitor summary | **Primary (Radar)** | Appropriate as a navigation layer, but currently the entire product |
| Sector summary | Weekly brief only | Appropriate as a digest layer |

**The radar is currently the product, not a navigation instrument for the product.**

The radar effectively answers "which competitors are moving" — but that is the *entry point* for intelligence, not the intelligence itself. The actual intelligence (why they're moving, what changed, how certain we are, what the evidence is) lives behind a click, in a drawer, in a compressed form.

**Over-emphasized:** The visual radar instrument, momentum state labels, and MicroInsights observations
**Under-exposed:** Signal quality indicators, confidence scores, evidence freshness, coverage state, interpretation depth

---

## 8. Key Misalignments

| # | Misalignment | Severity | Backend source | Frontend behavior |
|---|---|---|---|---|
| M1 | Pending_review signals make competitors appear active | High | `status=pending_review` never in RadarCompetitor | `last_signal_at` used for "active" detection regardless of status |
| M2 | Frontend pressure gauge ignores backend pressure_index | Medium | `competitors.pressure_index` (0–10, carefully computed) | `pressure.ts` recomputes from scratch using avgMomentum + density |
| M3 | BriefViewer confidence bars are reconstructed from severity | Medium | `interpretation.confidence` is real; not in brief content JSONB | Confidence derived from fixed severity→score map |
| M4 | Historical Capsule has same visual treatment as real intelligence | Medium | These are hardcoded stories in `intel-stories.ts` | No visual distinction from product UI |
| M5 | MicroInsights presented as observations, are string templates | Low-Medium | No AI/DB call | Presented in intelligence visual register |
| M6 | Intelligence Strip mixes RSS and signals with equal weight | Medium | `sector-news` is Google RSS; signals are Metrivant data | Same ticker, same visual styling, minimal tag differentiation |
| M7 | Coverage/health state never surfaced | High | 70% of active pages are non-healthy | User assumes full coverage; quiet = truly quiet |
| M8 | Only latest movement shown; prior movements invisible | Medium | `latest_movement_*` in RadarCompetitor | All prior movement history inaccessible to user |
| M9 | Relevance classification invisible | Low-Medium | `relevance_level` written by AI pre-filter | Never exposed; filtered signal volume unknown to user |
| M10 | Strategy analysis is second-order AI presented as direct evidence | Medium | Derived from already-aggregated movement summaries | Presented as pattern detection; evidence chain depth not shown |

---

## 9. Highest-Leverage Representation Gaps

These are the gaps where a targeted change would most improve truthfulness and user comprehension. Listed by leverage, not complexity. No implementation proposed here.

### Gap 1 — Confidence score is invisible on the radar
The most important quality signal for a signal — its confidence score — is nowhere on the main surface. Users cannot distinguish a 0.65-confidence signal (just above the gate) from a 0.98-confidence signal. Interpretation confidence exists and is used in the detail panel, but signal-level confidence (the deterministic quality score) never reaches the UI at all.

### Gap 2 — Coverage state is entirely hidden
The user cannot know that 70% of their active monitored pages are unresolved, blocked, or degraded. A competitor that is "quiet" on the radar might be quiet because pages are blocked. There is no "coverage gap" indicator anywhere. This is the most misleading silence in the product.

### Gap 3 — Pending_review signals contaminate "activity" indicators
`last_signal_at` is used for everything activity-related (activityEcho, DailyBriefOverlay "X rivals moved", temporal filter glow, amber node tinting). These include pending_review signals — intelligence the system itself judged as below the confidence threshold to surface. The product implies "this competitor moved" when the pipeline concluded "we saw something but aren't sure."

### Gap 4 — Only the latest movement survives compression
A competitor with 4 movements over 30 days appears in the UI as exactly the same as a competitor with 1 movement — only `latest_movement_*` fields are passed through radar-feed. Movement history is completely invisible. A competitor that had a pricing shift, then a product expansion, then a market reposition is indistinguishable from one that had one event.

### Gap 5 — Source provenance is invisible
Whether a signal came from a page diff (deterministic crawler) or a newsroom feed (Pool 1) is never shown. These have different trust properties and different evidence structures. Users have no way to evaluate the source of what the radar is showing them.

### Gap 6 — Sector pressure recomputes rather than uses backend truth
The "Sector Pressure" indicator (Low/Moderate/High) displayed prominently in the radar UI is computed from frontend data using a different formula than the backend `pressure_index`. The backend pressure_index is the actual quality-controlled metric that gates signal promotion. The frontend shows a different number with the same label, potentially giving users a misleading picture of sector-level urgency.

### Gap 7 — Radar narrative evidence is opaque
The radar narrative is shown as prose, but `evidence_signal_ids` — the specific signals that generated the narrative — are never shown. A user reading a narrative cannot verify it, trace it, or understand what evidence it was generated from. The narrative appears authoritative but its provenance is invisible.

### Gap 8 — The strategy and brief surfaces use compressed inputs
Both the strategy analysis (AI on `RadarCompetitor[]`) and the brief (AI on pre-generated artifacts) operate on derived, already-compressed representations — not on raw signals or interpretations. The intelligence depth of these surfaces is bounded by what survived the radar-feed compression step.

---

## What the UI Currently Represents Well

- **Movement type encoding** is faithful and consistent: color, micro-symbol, and label all agree.
- **Critical alert threshold** is conservative and multi-criteria: it will not fire unless the system has strong, multi-signal, recent, high-confidence evidence.
- **Temporal filtering** is useful: the 24h/7d/all filter is a genuine signal freshness tool.
- **Confidence language in the detail panel** is calibrated and honest: "almost certainly", "likely", "possible" map to real thresholds.
- **Weak signal ring** is an honest visual signal: dashed orbit correctly marks competitors where activity has not yet formed a confirmed movement.
- **Trail dots** give genuine motion history context.
- **Gravity Field mode** honestly expresses relative pressure between competitors via mass-based deformation.
- **Interpretation depth in the detail panel** is genuine: summary, strategic_implication, recommended_action, urgency, evidence excerpts, and confidence are all real backend fields shown accurately.

## What the UI Hides

- Signal confidence score (the deterministic quality signal)
- Signal relevance classification (AI pre-filter)
- Pending_review signals (held intelligence)
- Page coverage/health state
- Movement history (only latest survives)
- Signal source type (page vs. feed)
- Evidence signal IDs behind narratives
- Sector intelligence absence

## What the UI May Mislead Users About

- "Quiet" competitors on the radar may be quiet due to blocked pages, not actual inactivity
- "X rivals moved in the last 24 hours" includes competitors with only held, uninterpreted signals
- The sector pressure gauge is a frontend-computed approximation, not the backend pressure_index
- Historical Capsule stories are illustrative industry content, not system-detected events
- MicroInsights are deterministic string templates, not AI-derived observations
- BriefViewer confidence bars are reconstructed from severity, not from real interpretation confidence
- The strategy surface is second-order AI (AI on AI), not direct evidence analysis

---

*Audit complete. No files modified, deleted, or renamed during this pass.*
