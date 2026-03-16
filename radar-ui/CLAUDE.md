# METRIVANT SYSTEM MASTER REFERENCE

This file is the permanent system reference for the Metrivant radar-ui repository.
All architectural and product decisions must remain consistent with this document.
If the system evolves, this file must be updated before the next session.

---

# 1. SYSTEM IDENTITY

Metrivant is a sector-agnostic competitive intelligence radar.

The system continuously monitors competitor websites, detects changes, classifies those changes as signals, and aggregates signals into strategic movements. It renders that intelligence as a real-time radar instrument.

Metrivant is not a monitoring tool. It is an early movement detection system. Its purpose is to surface strategic intent before it becomes public knowledge.

The architecture is deterministic by design. Every output — signal, movement, momentum score, critical alert — is derived from evidence. Nothing is inferred without grounding in observed page changes.

The system is designed to be operated and maintained by one engineer.

---

# 2. CORE MENTAL MODEL

The market behaves like a radar field.

```
Competitors       = nodes on the radar
Changes           = raw signals
Signal clusters   = strategic movement
Movement patterns = market strategy
```

Distance from center represents momentum. A competitor close to the radar boundary is accelerating. A competitor near the origin is quiet.

The radar is not decorative. It is the primary information surface. Every visual element encodes real data: node size = momentum, echo pulse frequency = activity rate, alert bloom = critical acceleration.

The user's job is to:
1. See which competitors are accelerating
2. Understand what specific movements they are making
3. Inspect the evidence chain behind the classification
4. Form a strategic response

The system's job is to make step 1 instantaneous, step 2 clear, step 3 verifiable, and step 4 actionable.

---

# 3. CANONICAL PIPELINE

The pipeline is deterministic and sequential. Each stage has defined inputs, a transformation, and defined outputs.

```
competitors
  → monitored_pages
    → snapshots
      → page_sections
        → section_baselines
          → section_diffs
            → signals
              → interpretations
                → strategic_movements
                  → radar_feed
                    → UI (Radar dashboard)
```

### Stage definitions

**competitors**
Input: User-submitted or catalog-seeded company records.
Stores: `competitor_id`, `name`, `website_url`, `org_id`.
Output: Feed of active competitors to monitor.

**monitored_pages**
Input: Competitor record.
What happens: One or more pages per competitor are registered for monitoring (pricing, features, changelog, blog, etc.).
Stores: `page_type`, `url`, `competitor_id`.
Output: List of URLs to crawl.

**snapshots**
Input: Monitored page URL.
What happens: The page is fetched and its full HTML/text is stored.
Stores: Raw page content with timestamp.
Output: Snapshot record linked to monitored_page.

**page_sections**
Input: Snapshot.
What happens: Page content is segmented into logical sections (headers, pricing blocks, feature lists, etc.).
Stores: Section content with position and type.
Output: Structured sections for comparison.

**section_baselines**
Input: Page sections over time.
What happens: A stable baseline is established for each section from its historical state.
Stores: Canonical reference content per section.
Output: Baseline for diff comparison.

**section_diffs**
Input: New section content vs. section baseline.
What happens: Textual and structural differences are computed.
Stores: Diff record with change extent and content delta.
Output: Diff record indicating what changed.

**signals**
Input: Section diff.
What happens: The diff is classified by signal type (pricing change, feature launch, positioning shift, etc.) and assigned urgency (1–5) and confidence (0–1).
Stores: `signal_type`, `severity`, `urgency`, `confidence`, `detected_at`, `summary`, `strategic_implication`, `recommended_action`, `previous_excerpt`, `current_excerpt`.
Output: Signal record.

**interpretations**
Input: Signal(s) for a competitor.
What happens: Signals are grouped and interpreted to determine if they form a coherent strategic movement.
Stores: Movement classification, supporting signal IDs.
Output: Interpretation record.

**strategic_movements**
Input: Interpretations over time.
What happens: Confirmed movement events are stored with type, confidence, velocity, signal count, and time window.
Stores: `movement_type`, `confidence`, `signal_count`, `velocity`, `first_seen_at`, `last_seen_at`.
Output: Movement records per competitor.

**radar_feed**
Input: `strategic_movements` + `signals` aggregated per competitor.
What happens: A Postgres view or query produces the RadarCompetitor shape — one row per competitor with momentum score, 7-day signal count, latest movement fields.
Stores: Computed view (not a base table).
Output: `RadarCompetitor[]` ordered by `momentum_score DESC`.

**UI (Radar dashboard)**
Input: `radar_feed` response (top 50 by momentum).
What happens: Competitors are rendered as radar blips positioned by golden spiral, sized by momentum. Selected competitor reveals intelligence drawer with signals and movements.
Output: Visual radar instrument.

### Downstream analysis layers (derived from radar_feed, not in the main pipeline)

**briefs** — Weekly intelligence reports. GPT-4o summarizes movement patterns into digest emails. Triggered by Vercel cron or manually. Before generation, raw signals are clustered into strategic themes (pricing/product/positioning/enterprise/ecosystem/hiring/comms) via `lib/brief/cluster-signals.ts`; cluster labels are enriched by gpt-4o-mini via `lib/brief/enrich-cluster-themes.ts`. Noise signals (signal_feedback.verdict='noise') are excluded. Clusters are injected into the GPT-4o prompt for analyst-quality output.

**strategic_analysis** — Cross-competitor pattern detection. GPT-4o identifies convergence, pricing competition, enterprise shift, etc. across competitors showing similar movement types. Max 5 insights, min 2 competitors per pattern.

**market_positioning** — 2×2 map scoring. GPT-4o scores each competitor on Market Focus (0–100: Niche→Platform) and Customer Segment (0–100: SMB→Enterprise). Significant shift threshold: >15 points on either axis.

**alerts** — High-urgency signals (urgency ≥ 3, detected within 120 minutes) trigger email notifications via Resend and create alert records in Supabase, scoped per org.

---

# 4. SYSTEM ARCHITECTURE

### Live stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16.1.6 (App Router) |
| UI runtime | React 19.2.3 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12.35.2 |
| Deployment | Vercel (serverless functions) |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| Interpretation layer | OpenAI GPT-4o |
| Error monitoring | Sentry (@sentry/nextjs, lazy-init) |
| Email | Resend |
| Analytics | PostHog (manual events, no autocapture) |
| Payments | Stripe (not yet integrated in radar-ui — billing is currently via mailto:) |
| Source control | GitHub |
| Backend runtime | `metrivant-runtime.vercel.app` (separate deployment) |

### Execution model

The UI is stateless. Every request reads from Supabase or proxies to the backend runtime. No in-process state persists between requests.

Supabase is the state machine. It owns: competitors, organizations, monitored_pages, snapshots, signals, interpretations, strategic_movements, radar_feed view, alerts, briefs, positioning data.

The backend runtime (`metrivant-runtime.vercel.app`) owns the crawl-and-pipeline execution. The UI calls it via `/api/radar-feed` and `/api/competitor-detail`. The UI does not run pipeline logic.

Vercel cron jobs trigger: signal checking (`/api/check-signals`), brief generation (`/api/generate-brief`), strategic analysis (`/api/strategic-analysis`), positioning updates (`/api/update-positioning`).

### Data flow (UI perspective)

```
metrivant-runtime.vercel.app
  /api/radar-feed?limit=50     → RadarCompetitor[] (sorted by momentum)
  /api/competitor-detail?id=X  → CompetitorDetail { competitor, movements, signals, monitoredPages }

Supabase (direct from UI)
  organizations                → sector, owner_id
  alerts                       → org-scoped alert records
  (auth)                       → user + user_metadata.plan

OpenAI GPT-4o (via API routes)
  /api/generate-brief          → BriefContent (temp: 0.25)
  /api/strategic-analysis      → StrategicAnalysisResult (temp: 0.20)
  /api/update-positioning      → PositioningResult (temp: 0.15)

Resend (via /api/check-signals and cron routes)
  → Alert emails
  → Brief emails
  → Onboarding emails (welcome, tracking confirmation, first signal)
  → Momentum alert emails
  → Repositioning alert emails
  → Strategy alert emails

PostHog (client + server)
  → Manual event capture only
  → Key events: radar_viewed, competitor_selected, critical_alert_triggered,
    upgrade_clicked, billing_opened, pricing_viewed, alert_viewed, etc.
```

### Security headers (next.config.ts)

HSTS (2 years), X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo: none).

### Authentication

Supabase Auth (email/password + OAuth). Session managed via SSR cookies.
Route `/app/*` requires authenticated user (enforced in `app/app/layout.tsx`).
Cron routes require `Authorization: Bearer {CRON_SECRET}`.
Service-role Supabase client (RLS bypass) is used only in server-side cron routes.

Plan is stored in `user.user_metadata.plan` (set at signup). Valid values: `"analyst"`, `"pro"`. Legacy value `"starter"` is normalized to `"analyst"` at read time. Defaults to `"analyst"` when absent.

### Mobile gating (desktop-first strategy)

The core app (`/app/*`) is desktop-first. Mobile users are shown a branded holding page.

**`components/MobileAppGate.tsx`** — Client component wrapping all `/app/*` children. Detects mobile via `window.matchMedia("(max-width: 767px)")`. If the user is on mobile and the current route is not in `MOBILE_ALLOWED`, renders the holding page instead of children. Uses `ready` state to avoid hydration flash (returns `null` until client detection completes).

Mobile-allowed routes (bypass the gate):
- `/app/billing`
- `/app/settings`

Holding page features:
- Radar SVG illustration
- "Desktop experience" headline
- "Copy desktop link" button → copies `https://metrivant.com/app` to clipboard
- "Billing & account" link → `/app/billing`
- "Sign out" button → `supabase.auth.signOut()` + redirect to `/login`

Login, signup, and all public pages are NOT gated (mobile-accessible by design).

---

# 5. ENGINEERING PHILOSOPHY

These rules govern all development decisions.

**Determinism over magic.** Every output must be traceable to an input. Signal → evidence → movement → UI. No inferences without grounding.

**Supabase as state machine.** All persistent state lives in Supabase. The runtime and UI are stateless executors. Never route around Supabase to store state elsewhere.

**Minimal architecture.** The system is maintained by one engineer. Complexity is a liability. Every abstraction must justify itself.

**Stateless execution.** Vercel functions are ephemeral. No in-memory caches, no singleton state, no assumptions about process persistence.

**High signal, low noise.** False positives are worse than missed alerts. The critical alert system fires at most one alert per radar load. Thresholds are conservative.

**Small safe changes.** Prefer targeted edits over rewrites. Prefer extending existing patterns over inventing new ones. Measure blast radius before committing.

**Deletion over bloat.** Dead code is a maintenance cost. Remove unused components, routes, types, and exports rather than leaving them.

**Clarity over cleverness.** Code that is easy to read in six months is better than code that is elegant today.

---

# 6. NON-NEGOTIABLE ARCHITECTURAL CONSTRAINTS

Do NOT introduce any of the following without explicit written approval:

- Microservices or service decomposition
- Message queues (Kafka, SQS, RabbitMQ, etc.)
- Distributed background worker clusters
- Complex orchestration frameworks (Temporal, Conductor, etc.)
- Additional databases or caches (Redis, MongoDB, etc.)
- Enterprise abstraction layers (repositories, service objects, DI containers)
- Large new dependencies without clear justification
- Breaking changes to backend API contracts (radar-feed shape, competitor-detail shape)
- Schema changes that affect the deterministic pipeline stages

These constraints exist because the system must remain understandable, debuggable, and deployable by one person.

---

# 7. SECTOR MODEL

Metrivant is sector-agnostic at the pipeline level.

The detection pipeline (snapshots → signals → movements → momentum) is identical across all sectors. Only signal interpretation (GPT-4o prompts), display terminology, catalog composition, and page emphasis change per sector.

### Sectors with full configuration (lib/sectors.ts)

| Sector ID | Label | Catalog categories |
|---|---|---|
| `saas` | SaaS & Software | project-management, developer-tools, analytics, crm, ai-tools, design-tools |
| `defense` | Defense & Aerospace | defense-primes, aerospace, cyber-intel, defense-services |
| `energy` | Energy & Resources | oil-gas, renewables, energy-services, energy-tech |

Each full-config sector defines:
- `movementLabels` — canonical movement_type → sector display label
- `signalLabels` — canonical signal_type → sector display label
- `patternLabels` — canonical pattern_type → sector display label
- `pageEmphasis` — which page types to prioritize for monitoring

### Sector terminology translation (examples)

| Canonical type | SaaS label | Defense label | Energy label |
|---|---|---|---|
| `pricing_strategy_shift` | Pricing Shift | Contract Repositioning | Pricing Signal |
| `product_expansion` | Product Expansion | Capability Expansion | Field Expansion |
| `market_reposition` | Market Reposition | Program Pivot | Market Shift |
| `enterprise_push` | Enterprise Push | Federal Push | Upstream Push |
| `ecosystem_expansion` | Ecosystem Expansion | Partnership Expansion | Regional Expansion |

### Additional recognized sectors (display + catalog only, lib/sector-catalog.ts)

`cybersecurity`, `fintech`, `ai-infrastructure`, `devtools`, `healthcare`, `consumer-tech`, `custom`

These 7 sectors have default competitor catalogs (10 per sector) and display labels but do not yet have full SectorConfig with terminology translation. They fall back to the SaaS config for terminology.

### Sector stored per org

Each organization stores its active sector in `organizations.sector`. The UI reads this to apply sector-specific terminology and filter the catalog. The sector can be changed via `SectorSwitcher` (calls `/api/initialize-sector`).

---

# 8. COMPETITOR CATALOG

The static catalog in `lib/catalog.ts` contains 283 competitors across 14 categories.

| Category | Count | Sector |
|---|---|---|
| project-management | 22 | SaaS |
| developer-tools | 24 | SaaS |
| analytics | 19 | SaaS |
| crm | 16 | SaaS |
| ai-tools | 20 | SaaS |
| design-tools | 16 | SaaS |
| defense-primes | 10 | Defense |
| aerospace | 8 | Defense |
| cyber-intel | 8 | Defense |
| defense-services | 6 | Defense |
| oil-gas | 10 | Energy |
| renewables | 10 | Energy |
| energy-services | 6 | Energy |
| energy-tech | 6 | Energy |

`lib/sector-catalog.ts` defines 10 default competitors per sector for the onboarding auto-populate flow.

---

# 9. MOMENTUM MODEL

Momentum score is a numeric field on `radar_feed`, computed by the backend pipeline.

### Momentum states (lib/momentum.ts)

| State | Score range | Color | Arrow |
|---|---|---|---|
| `cooling` | score < 1.5 | #64748b (slate) | ↓ |
| `stable` | 1.5 ≤ score < 3 | #2EE6A6 (green) | → |
| `rising` | 3 ≤ score < 5 | #f59e0b (amber) | ↑ |
| `accelerating` | score ≥ 5 | #ef4444 (red) | ⚡ |

Echo ring animation duration varies by state: accelerating = 1.5s, rising = 2.2s, other = 3.0s.

### Critical alert thresholds (lib/criticalAlert.ts)

A critical alert fires only when ALL five criteria are satisfied simultaneously:

1. `momentum_score >= 7` (significantly above accelerating floor of 5)
2. `signals_7d >= 3` (confirmed recent signal density)
3. `latest_movement_confidence >= 0.70` (system confidence in the movement)
4. `latest_movement_type` is present (a specific movement is identified)
5. `latest_movement_last_seen_at` within 48 hours (data is fresh)

At most ONE critical alert fires per radar load. The highest-momentum qualifier wins. Session dedup key: `${competitor_id}__${latest_movement_last_seen_at}` — stored in sessionStorage.

False positives are worse than missed alerts. These thresholds are conservative by design.

---

# 10. STRATEGIC ANALYSIS MODEL

### Pattern types (lib/strategy.ts)

| Pattern | Color | Description |
|---|---|---|
| `feature_convergence` | #57a6ff | Multiple rivals shipping similar capabilities |
| `pricing_competition` | #ff6b6b | Rivals adjusting pricing tiers or positioning |
| `category_expansion` | #34d399 | Rivals moving into adjacent market territory |
| `enterprise_shift` | #c084fc | Rivals pivoting upmarket toward enterprise buyers |
| `product_bundling` | #facc15 | Rivals combining features to increase stickiness |
| `market_repositioning` | #f97316 | Rivals changing their core narrative or ICP |

### Rules

- Minimum 2 competitors required per pattern
- Maximum 5 insights per analysis
- `is_major = true` when competitor_count ≥ 3 OR confidence ≥ 0.82
- GPT-4o called with temperature 0.20 (low — deterministic pattern detection)
- JSON-only response format enforced

### Positioning map (lib/positioning.ts)

2×2 market map scored by GPT-4o at temperature 0.15 (very low):
- X axis: `market_focus_score` 0–100 (Niche/Specialist → Broad Platform)
- Y axis: `customer_segment_score` 0–100 (SMB/Teams → Enterprise)
- Significant shift threshold: >15 points on either axis
- Confidence range: 0.5 (minimal signal) → 0.9 (strong clear signal)

---

# 11. RADAR INTERFACE PHILOSOPHY

The radar is the product. Everything else is secondary.

### Geometry

- 1000×1000 SVG viewport, CENTER = 500
- OUTER_RADIUS = 420
- 4 ring radii: 0.28, 0.50, 0.72, 1.0 of OUTER_RADIUS
- Cardinal labels (N/E/S/W) outside the clip boundary
- 72 tick marks (every 5°)
- `radarClip` clipPath enforces instrument boundary

### Node distribution

Competitors are positioned using golden angle spiral distribution. This prevents clustering and ensures even distribution regardless of competitor count. Maximum 50 nodes rendered (top 50 by momentum from radar_feed).

Node radius scales with momentum score. Selected nodes receive a permanent halo. Alerted nodes (critical alert) receive a bloom ring + pulsing stroke halo.

### Animation principles

- Sonar pulse: 12-second sweep cycle (staggered 4s between 3 rings)
- Echo rings: 24-second cycle (staggered 12s), 2 rings per node
- Core ring: tight alive pulse
- All motion is smooth, slow, and premium — no jarring transitions
- Framer Motion handles all animation via layout animations and AnimatePresence
- No rotating beam element — pulse timing is driven by ring animations

### Node entry physics

BlipNodes mount with `initial={{ opacity: 0, scale: 0.85 }}` and animate to their target state. Stagger delay = `index * 0.012s` (max ~0.6s for 50 nodes). Opacity is in `animate` only — NOT in `style` — so Framer Motion's `initial` works correctly on mount.

### Confidence-proportional node opacity

Node opacity is scaled by `latest_movement_confidence` when the node is not dimmed/selected:
- conf ≥ 0.65 → 1.0× (full)
- conf 0.40–0.64 → 0.88×
- conf < 0.40 → 0.75×
- dimmed, timeDimmed, or selected states ignore the conf multiplier (always 1.0×)

### Signal type micro-shapes

Small SVG symbols rendered inside BlipNodes (only when momentum > 0 and node is not dimmed):
- `pricing_strategy_shift` → horizontal dash
- `product_expansion` → plus/cross
- `market_reposition` → diamond
- `enterprise_push` / `ecosystem_expansion` → upward arrow

### Visual depth features

**Glass highlight** — Radial gradient (`glassHighlight` def, cx=38%, cy=26%) overlaid on the radar circle. Very faint white highlight (max opacity 0.030) simulating instrument glass.

**Radar breathing state** — `motion.circle` at OUTER_RADIUS * 0.38 using `radarCore` or `radarCoreGravity` fill. Animates `opacity: [0.0, 0.09, 0.0]` on a 10-second loop (1s delay). Simulates a living instrument.

### Label truncation

Competitor name in SVG text label is truncated:
- Mobile: 10 chars max
- Desktop: 14 chars max
Truncated names end in `…`.

### Alert visual model

When a critical alert is active:
- Two boundary rings pulse in the movement type's color outside the radar clip
- The alerted competitor node renders a bloom ring and pulsing stroke halo
- An alert banner overlays the radar (bottom of container) via AnimatePresence
- The radar SVG rings pulse in the alert movement color instead of the default green

### Auto-refresh

Radar polls `router.refresh()` on a timer:
- Empty radar (no competitors): every 30s — waits for first pipeline output
- Active radar (competitors present): every 60s — surfaces new signals without manual reload

### Pipeline heartbeat

`latestSignalAt` is a useMemo computed from `sorted` (the `RadarCompetitor[]` array). It finds the most recent `last_signal_at` across all competitors. Displayed in the intelligence panel header as "Updated X ago" with color-coded freshness:
- < 6 hours → green (`rgba(46,230,166,0.50)`)
- 6–24 hours → amber (`rgba(245,158,11,0.40)`)
- > 24 hours → slate (`rgba(100,116,139,0.45)`)

### Calibrated confidence language

In the intelligence drawer's Assessment section, a prefix is prepended based on `interpretationConf`:
- conf < 0.5 → "Possible indicator — " (slate text)
- conf 0.5–0.64 → "Likely: " (slate-400 text)
- conf ≥ 0.65 → no prefix

### Evidence chain anchoring

Above each Was/Now diff block in the signals list, a line shows:
`{page_type label} · {formatRelative(signal.detected_at)}`
This anchors each piece of evidence to its source page and timing.

### Quiet state messaging

When no signals are present: "Monitoring Active" headline + "No new signals — N rivals under active surveillance" (not "All Surfaces Clear").

### Information hierarchy

1. Radar (who is moving, how fast)
2. Selected competitor drawer (what movement, which signals)
3. Evidence chain (raw diff excerpts, signal confidence, page coverage)
4. Strategic patterns (Strategy page — cross-competitor)

One focal point at a time. The selected state must be unmistakable. Non-selected nodes must be visually quieter.

### Empty state

When radar has no competitors (new user): display "INITIALIZING RADAR" state with subtitle "Pipeline running — first signals arriving shortly". Auto-refresh every 30 seconds via `router.refresh()`.

---

# 12. USER EXPERIENCE MODEL

### Expected user flow

1. Sign up → select sector (onboarding)
2. System seeds default competitors from sector catalog
3. Pipeline runs → first signals appear (typically within hours)
4. Radar shows competitors as nodes, active ones pulse
5. User clicks a node → intelligence drawer opens
6. User reviews movement type, confidence, signal evidence
7. User navigates to Strategy page for cross-competitor pattern analysis
8. User receives email alerts for high-urgency signals and weekly briefs
9. User upgrades when value is proven (Starter → Pro)

### Plan structure

| Plan | Price | Competitors | Signal history | Alerts |
|---|---|---|---|---|
| Analyst | $9/mo | 5 | 30 days | Weekly digest |
| Pro | $19/mo | 25 | 90 days | Real-time |

Legacy note: Early signups have `user_metadata.plan = "starter"`. This is treated identically to `"analyst"` in all UI components. No migration is needed — both keys are recognized.

Stripe is integrated. Checkout sessions and billing portal are live via `lib/stripe.ts`. STRIPE_SECRET_KEY must be trimmed of whitespace (`.trim()` applied). Webhook at `/api/stripe/webhook` syncs subscription state. Plan is written to `user_metadata.plan` on successful payment.

---

# 13. PRIMARY PRODUCT SURFACES

### Public surfaces

**Landing page** (`app/page.tsx`) — Hero with brand identity, value proposition, and pricing snapshot. CTAs: "Start free trial" → `/signup`, pricing links. Semantic H1 (brand name) and H2 (tagline) for SEO. JSON-LD `SoftwareApplication` structured data block injected inline. Base price: $9.

**Pricing page** (`app/pricing/page.tsx`) — Full 3-plan comparison grid. Tracks `pricing_viewed` PostHog event.

**Login / Signup** (`app/login`, `app/signup`) — Supabase auth flow. Signup accepts `?plan=` query param to pre-select plan.

**PublicNav** (`components/PublicNav.tsx`) — Top navigation bar used on all public pages. Desktop (`hidden md:flex`): About, Pricing, Log in, Get started. Mobile (`flex md:hidden`): Log in + Get started buttons + hamburger (`☰`/`✕`) that toggles a dropdown with About and Pricing. Nav height: `h-14` mobile / `h-16` desktop. All links close the menu on click.

### SEO configuration

Root metadata (`app/layout.tsx`):
- `metadataBase`: `https://metrivant.com`
- Title template: `"%s — Metrivant"`, default: `"Metrivant — Competitive Intelligence Radar"`
- Description: `"Detect competitor moves before they matter. Metrivant monitors pricing, product changes, and strategy signals in real time."`
- OG: `type: "website"`, image `/og-image.png` (1200×630)
- Twitter: `summary_large_image` card
- Icons: `/favicon.ico`, `/apple-touch-icon.png`
- Robots: `index: true, follow: true`

Structured data (landing page, `app/page.tsx`): `SoftwareApplication` JSON-LD with `offers` price `9 USD`.

### Authenticated app surfaces

**Radar dashboard** (`app/app/page.tsx`) — Main product surface. Real-time SVG radar showing up to 50 competitors. Header displays live stats (rivals, active, signals 7d, new 24h). Left sidebar provides navigation. Critical alerts overlay the radar.

**Discover** (`app/app/discover`) — Competitor discovery and onboarding. Browse and add competitors from the sector catalog.

**Briefs** (`app/app/briefs`) — Weekly intelligence digests generated by GPT-4o. Summarizes competitor movements, implications, and recommended actions.

**Market Map** (`app/app/market-map`) — Interactive 2×2 positioning scatter plot (Market Focus vs. Customer Segment). Computed by GPT-4o from movement signals. Significant shifts (>15pts) trigger repositioning alerts.

**Strategy** (`app/app/strategy`) — Cross-competitor strategic pattern analysis. GPT-4o identifies convergence, pricing competition, and category expansion patterns across monitored competitors. Accepts `?alert=1&cid=&cname=&move=&conf=` params from critical alert navigation.

**Alerts** (`app/app/alerts`) — List of signal-triggered notifications. Displays alert type, competitor, timestamp. Mark-as-read on open.

**Settings** (`app/app/settings`) — User and org settings. Sector configuration.

**Billing** (`app/app/billing`) — Current plan display with features list. Analyst users see Pro upgrade card with Stripe checkout. Pro users see billing portal link. Stripe checkout and portal are fully integrated.

**Onboarding** (`app/app/onboarding`) — First-time sector selection flow. Auto-populates default competitors from sector catalog.

### Experimental

**Lemonade Mode** (`app/app/lemonade`) — Alternative reading of the radar using a lemonade stand metaphor. Translates movement types into child-readable analogies ("new flavour", "changed price", "VIP tent"). Hidden from primary navigation, accessible directly by URL. Not production-critical.

---

# 14. ANALYTICS MODEL

PostHog is used for manual event capture only. Autocapture is disabled.

### Key events

| Event | When |
|---|---|
| `radar_viewed` | Radar dashboard mount |
| `competitor_selected` | Node click on radar |
| `critical_alert_triggered` | Critical alert fires on radar load |
| `critical_alert_opened` | User engages with alert banner |
| `critical_alert_to_strategy_clicked` | User navigates from alert to Strategy |
| `pricing_viewed` | Pricing page mount |
| `billing_opened` | Billing page mount (source: direct or header) |
| `upgrade_clicked` | Any upgrade CTA click (source: header, timed_prompt, billing_current_plan, billing_upgrade_card) |
| `upgrade_prompt_seen` | Timed upgrade prompt shown (60s trigger) |
| `alert_viewed` | Alerts dropdown opened |
| `page_viewed` | Every route change |

PostHog `identify()` is called after auth with `userId` and `email`. Session-level deduplication is handled via sessionStorage for upgrade prompts and critical alerts.

---

# 15. EMAIL SYSTEM

All emails are sent via Resend. HTML templates are dark-themed, consistent with the product aesthetic.

### Sender addresses

- `hello@metrivant.com` — welcome, onboarding
- `alerts@metrivant.com` — signal alerts, momentum alerts, strategy alerts
- `briefs@metrivant.com` — weekly intelligence digests

### Email types

| Email | Trigger |
|---|---|
| Welcome | Signup |
| Tracking confirmation | First competitor added |
| First signal | First signal detected for org |
| Momentum alert | Competitor crosses accelerating threshold (score ≥ 5) |
| Repositioning alert | Competitor shifts >15pts on market map |
| Signal alert | Urgency ≥ 3 signal within 120-min window (via cron) |
| Weekly brief | Cron (weekly) |
| Strategy alert | Cross-competitor patterns detected (cron) |

---

# 16. SYSTEM RISKS AND LIMITATIONS

**Signal noise risk.** Page changes that are cosmetic (A/B tests, layout changes, cookie banners) may generate low-quality signals. Urgency and confidence scores are the primary filter. The interpretation layer (GPT-4o) provides a second filter before signals become movements.

**Data freshness dependency.** The radar reflects the last successful pipeline run. If the backend runtime fails to crawl, the radar shows stale momentum. The UI flags potential staleness: if `lastSignalAt` is older than 12 hours, an amber "data may be out of date" indicator appears.

**AI interpretation variance.** GPT-4o is used with low temperatures (0.15–0.25) to reduce variance, but it is not fully deterministic. Interpretation quality depends on the richness of signal content. Confident, well-evidenced signals produce reliable movements. Sparse or ambiguous diffs may produce low-confidence movements that don't meet alert thresholds.

**Sector coverage depth.** Three sectors (SaaS, Defense, Energy) have full SectorConfig with terminology translation. Seven additional sectors (Cybersecurity, Fintech, AI Infrastructure, DevTools, Healthcare, Consumer Tech, Custom) have catalog and display support but fall back to SaaS terminology for movements and signals.

**Catalog maintenance.** The static catalog (283 competitors) does not self-update. New entrants in a sector require manual catalog additions.

**Plan enforcement.** Plan limits (10 competitors for Analyst, 25 for Pro) are enforced server-side in `/api/discover/track`. Returns HTTP 403 when limit reached.

**Stripe integrated.** Checkout session creation and billing portal are live. `STRIPE_SECRET_KEY` env var must not have trailing whitespace. Webhook syncs subscription state to `subscriptions` table per org.

---

# 17. DEFINITIONS

**competitor** — A tracked company. Has a `competitor_id`, `name`, `website_url`, and belongs to an `org_id`. The unit of observation in the system.

**monitored_page** — A specific URL belonging to a competitor that is registered for crawling. Each competitor may have multiple monitored pages by type (pricing, features, changelog, blog, etc.).

**snapshot** — A point-in-time capture of a monitored page's full content. Created on each crawl cycle.

**section** — A logical content block within a snapshot (e.g., a pricing table row, a feature description, a headline). Pages are segmented into sections for granular diffing.

**baseline** — The established stable reference state for a section. Diffs are computed against the baseline, not the previous snapshot, to reduce noise from transient changes.

**diff** — The computed difference between a section's current content and its baseline. The raw evidence that something changed.

**signal** — A classified diff. Assigned a `signal_type` (e.g., `pricing_strategy_shift`, `feature_launch`), `urgency` (1–5), `confidence` (0–1), `summary`, `strategic_implication`, and `recommended_action`. The atomic unit of intelligence.

**interpretation** — A grouping of related signals for a competitor that suggests a coherent strategic intent. The bridge between individual signals and a confirmed movement.

**movement** — A confirmed strategic action by a competitor, derived from one or more interpretations. Has a `movement_type`, `confidence`, `signal_count`, `velocity`, `first_seen_at`, and `last_seen_at`. Movements are the primary data shown in the intelligence drawer.

**brief** — A weekly AI-generated digest summarizing competitor movements, patterns, and recommended responses for a given org. Generated by GPT-4o from the current radar_feed.

**sector** — The market vertical configured for an organization. Determines: catalog (which competitors are available), terminology (how movements and signals are labeled), and page emphasis (which page types are prioritized). Current full-config sectors: `saas`, `defense`, `energy`.

**momentum** — A numeric score (from `radar_feed`) representing the current rate and recency of a competitor's signal activity. Displayed as node distance and size on the radar. States: cooling (<1.5), stable (1.5–3), rising (3–5), accelerating (≥5). Critical alert threshold: ≥7.

**pattern** — A cross-competitor strategic trend identified by GPT-4o analysis of the current radar_feed. Requires at least 2 competitors showing similar movement behavior. Types: feature_convergence, pricing_competition, category_expansion, enterprise_shift, product_bundling, market_repositioning.

---

# 18. DEVELOPMENT WORKFLOW

Every task must follow this sequence. Do not skip phases.

### Phase 1 — Understand
- Identify which pipeline stage or UI surface is involved
- Identify which files own the relevant logic and state
- Understand what contracts (API shapes, DB schemas) are at risk
- Assess blast radius of the change

### Phase 2 — Plan
- Propose the smallest safe change
- List every file that will be modified
- Justify each modification
- Prefer extending existing patterns over creating new ones

### Phase 3 — Implement
- Modify only the approved files
- Preserve naming conventions and existing contracts
- Keep TypeScript strict (`noEmit` typecheck must pass)
- Keep styling consistent with existing design language
- Keep animations subtle, smooth, and purposeful

### Phase 4 — Verify
- Run `npx tsc --noEmit`
- Run build if touching API routes or layout files
- Confirm no unrelated files were modified
- Confirm no pipeline behavior was changed

### Phase 5 — Report
- Files changed (and why)
- Files deleted (and why)
- What was simplified
- What functionality improved
- What risks were avoided
- Any remaining technical debt
- Optional next step

---

# 19. AUTO-APPROVAL SCOPE

The following may proceed without explicit per-task approval:
- Removing dead code or unused exports
- Fixing type errors introduced by prior changes
- Improving naming clarity within a file
- Reducing duplication within a component
- Fixing obvious UI inconsistencies (color, spacing, text)

The following always require explicit approval:
- Any change to radar_feed shape or competitor-detail shape
- Any new API route
- Any schema migration
- Any new dependency
- Any change to authentication or authorization logic
- Any architectural addition (new service, new abstraction layer)
- Any change to the deterministic pipeline stages

---

# 20. SOURCE OF TRUTH RULE

This file is the permanent system reference for the Metrivant radar-ui repository.

All architectural and product decisions must remain consistent with this document.

If the system evolves — new sectors added, new pipeline stages introduced, new product surfaces shipped, Stripe integrated, plan enforcement implemented — this file must be updated before proceeding to the next task.

Do not treat this file as a starting point for inference. Treat it as ground truth.
