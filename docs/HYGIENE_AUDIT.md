# Metrivant Hygiene Audit
Audit date: 2026-03-17
Auditor: Claude (classification-only pass — no cleanup performed)

---

> **LOCKED: This is a classification-only document. No files were modified, deleted, or renamed during this audit.**

---

## Section 1 — Documentation

### Root-level docs

- **CLAUDE.md** (root)
  - Classification: **active**
  - Rationale: Session-loaded instruction set for Claude Code. Mirror of startsession.md per document authority model.
  - Risk if removed: Claude loses project identity and behavioral constraints.
  - Last verified: 2026-03-17

- **radar-ui/CLAUDE.md**
  - Classification: **active**
  - Rationale: Frontend surface mirror of root CLAUDE.md per document authority model.
  - Risk if removed: Claude loses frontend-specific constraints.
  - Last verified: 2026-03-17

- **README.md**
  - Classification: **active**
  - Rationale: Minimal repo intro ("Competitive intelligence engine. Pipeline:…"). Not superseded.
  - Risk if removed: Low. No systemic dependency.
  - Last verified: 2026-03-17

- **SYSTEM_MAP.md**
  - Classification: **superseded**
  - Rationale: Describes system topology, surfaces, and pipeline. Covered in full by docs/METRIVANT_MASTER_REFERENCE.md. Does NOT carry a "SUPERSEDED" header — drift risk.
  - Risk if removed: Low. No code imports it.
  - Last verified: 2026-03-17

- **FAST_MODE.md**
  - Classification: **superseded** ⚠️ with active mental model conflict
  - Rationale: Partially valid (build preference rules), but contains two confirmed conflicts:
    1. Rule 11: "On completion of every prompt: manually git commit, push, and deploy to Vercel production" — contradicts startsession.md which requires confirmation before push.
    2. Migration path: references `radar-ui/migrations/` but migrations live at root `migrations/`.
  - Risk if removed: Low. Behavioral rules should live in startsession.md only.
  - Risk if kept: Moderate. Conflicting instructions for automated deploy behavior.
  - Last verified: 2026-03-17

- **DEV_TASKS.md**
  - Classification: **unknown**
  - Rationale: Contains a task backlog (radar zoom, node readability, sound design, etc.) and "recently completed" log. Not referenced by any code or workflow doc. May be an informal scratchpad.
  - Risk if removed: Low. No code dependency.
  - Last verified: 2026-03-17

- **add5.md** (untracked)
  - Classification: **dead**
  - Rationale: Untracked file (git status). Contains a one-off task description for adding 5 sector-catalog entries. Task appears to be pending or abandoned. No code imports it.
  - Risk if removed: None. Untracked.
  - Last verified: 2026-03-17

### docs/ top-level

- **docs/METRIVANT_MASTER_REFERENCE.md**
  - Classification: **active** (authoritative)
  - Rationale: Single authoritative system reference (v4.2). Self-declares as replacing 8 older documents. Updated 2026-03-15.
  - Risk if removed: High. This is the canonical system reference.
  - Last verified: 2026-03-17

- **docs/ARCHITECTURE_INDEX.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md". Safe to ignore.
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/MASTER_ARCHITECTURE_PLAN.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/SYSTEM_ARCHITECTURE.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/SUPABASE_ARCHITECTURE.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/PIPELINE_STATE_MACHINE.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/SYSTEM_RUNTIME_FLOW.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md (sections 19–22)".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/OPERATIONS.md**
  - Classification: **superseded**
  - Rationale: Header states "SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md (sections 19–22)".
  - Risk if removed: Low.
  - Last verified: 2026-03-17

- **docs/PATTERN_LAYER.md**
  - Classification: **superseded** (also dormant-incomplete content)
  - Rationale: Header states "SUPERSEDED". Content describes a planned pattern layer (velocity_increase, pricing_instability etc.) that has not been built. The planning content is not reflected in current migrations or code.
  - Risk if removed: Low. No code dependency.
  - Last verified: 2026-03-17

- **docs/SIGNAL_REVIEW_WORKFLOW.md**
  - Classification: **unknown**
  - Rationale: Does NOT carry a "SUPERSEDED" header. Describes an operator signal review workflow with 30-day observation period. May still have operational value. Unclear if current or stale vs signal_feedback/selector_repair_suggestions flows.
  - Risk if removed: Unclear. Should be reviewed against current signal_feedback flow before removal.
  - Last verified: 2026-03-17

- **docs/CHATGPT_ASSESSMENT_PROMPT.md**
  - Classification: **orphaned**
  - Rationale: A prompt template for pasting into ChatGPT to assess the system. No code dependency. Not referenced in workflow docs. Low operational value.
  - Risk if removed: None.
  - Last verified: 2026-03-17

### docs/workflow/

- **docs/workflow/startsession.md**
  - Classification: **active** (canonical authority)
  - Rationale: The document authority source per CLAUDE.md. Contains session gate, mode rules, stop conditions, end-of-task check, and document authority model.
  - Risk if removed: High. Loss of session bootstrap governance.
  - Last verified: 2026-03-17

- **docs/workflow/endsession.md**
  - Classification: **active**
  - Rationale: End-of-session checklist for deployment verification. Companion to startsession.md.
  - Risk if removed: Moderate. Loss of end-of-session verification discipline.
  - Last verified: 2026-03-17

- **docs/workflow/SURFACE_OWNERSHIP_RULES.md**
  - Classification: **active**
  - Rationale: Referenced by CLAUDE.md ("Read before every task"). Defines import isolation rules per surface.
  - Risk if removed: Moderate.
  - Last verified: 2026-03-17

- **docs/workflow/DEPLOYMENT_BOOTSTRAP.md**
  - Classification: **active**
  - Rationale: Referenced by CLAUDE.md and startsession.md as deployment reference.
  - Risk if removed: Moderate.
  - Last verified: 2026-03-17

### docs/architecture/

- **docs/architecture/VERCEL_DEPLOYMENT_FAILSAFE.md**
  - Classification: **active**
  - Rationale: Referenced by startsession.md as fail-safe deployment doc.
  - Risk if removed: Low-moderate. Operational reference for deployment recovery.
  - Last verified: 2026-03-17

---

## Section 2 — Runtime Surface

### api/ — Core pipeline handlers (all scheduled in vercel.json)

- **api/fetch-snapshots.ts**
  - Classification: **active**
  - Rationale: Scheduled 3× (ambient 0,30/hr; high_value 2/hr; standard 4/3hr). Stage 1 of pipeline.
  - Last verified: 2026-03-17

- **api/extract-sections.ts**
  - Classification: **active**
  - Rationale: Scheduled at :15,:45. Stage 2 of pipeline.
  - Last verified: 2026-03-17

- **api/build-baselines.ts**
  - Classification: **active**
  - Rationale: Scheduled at :17,:47. Stage 3.
  - Last verified: 2026-03-17

- **api/detect-diffs.ts**
  - Classification: **active**
  - Rationale: Scheduled at :19,:49. Stage 4.
  - Last verified: 2026-03-17

- **api/detect-signals.ts**
  - Classification: **active**
  - Rationale: Scheduled at :21,:51. Stage 5. Contains noise gates, confidence gates, suppression observability.
  - Last verified: 2026-03-17

- **api/detect-ambient-activity.ts**
  - Classification: **active**
  - Rationale: Scheduled at :23,:53. Produces activity_events for ambient pages.
  - Last verified: 2026-03-17

- **api/update-pressure-index.ts**
  - Classification: **active**
  - Rationale: Scheduled at :25,:55. Computes pressure_index per competitor.
  - Last verified: 2026-03-17

- **api/interpret-signals.ts**
  - Classification: **active**
  - Rationale: Scheduled at :28. AI Layer 2. Reads signal_feedback for context.
  - Last verified: 2026-03-17

- **api/detect-movements.ts**
  - Classification: **active**
  - Rationale: Scheduled at :55. Builds strategic_movements from signals.
  - Last verified: 2026-03-17

- **api/synthesize-movement-narratives.ts**
  - Classification: **active**
  - Rationale: Scheduled at :30. AI Layer 3. Generates movement_summary + strategic_implication.
  - Last verified: 2026-03-17

- **api/generate-radar-narratives.ts**
  - Classification: **active**
  - Rationale: Scheduled at :45. AI Layer 4. Generates per-competitor radar_narratives.
  - Last verified: 2026-03-17

- **api/generate-sector-intelligence.ts**
  - Classification: **active**
  - Rationale: Scheduled Mon 07:00. AI Layer 5. Weekly sector_intelligence.
  - Last verified: 2026-03-17

- **api/promote-baselines.ts**
  - Classification: **active**
  - Rationale: Scheduled daily 02:00. Promotes pending baselines.
  - Last verified: 2026-03-17

- **api/retention.ts**
  - Classification: **active**
  - Rationale: Scheduled daily 03:00. Calls 4 retention RPCs (raw HTML, sections, diffs, pipeline_events).
  - Last verified: 2026-03-17

- **api/suggest-selector-repairs.ts**
  - Classification: **active**
  - Rationale: Scheduled daily 04:00. Writes to selector_repair_suggestions for operator review.
  - Last verified: 2026-03-17

- **api/update-signal-velocity.ts**
  - Classification: **active** ⚠️ with graceful degradation
  - Rationale: Scheduled at :50. Calls cluster_recent_signals and calculate_signal_velocity RPCs. Code handles PGRST202 (function not found) non-fatally with a Sentry warning. RPCs may not be defined in current schema — handler degrades gracefully. If RPCs are absent, this cron runs but does nothing useful.
  - Risk if changed: Moderate. Removing would eliminate an active cron slot without confirming RPCs exist.
  - Last verified: 2026-03-17

- **api/ingest-feeds.ts**
  - Classification: **active**
  - Rationale: Scheduled :10/hr. Pool 1 (newsroom) ingestion — active per CLAUDE.md.
  - Last verified: 2026-03-17

- **api/promote-feed-signals.ts**
  - Classification: **active**
  - Rationale: Scheduled :12/hr. Pool 1 promotion to signals.
  - Last verified: 2026-03-17

- **api/generate-brief.ts** (runtime)
  - Classification: **dormant-incomplete**
  - Rationale: Explicit stub — returns `{ok:true, disabled:true}`. Brief generation implemented in radar-ui only. Not scheduled in vercel.json.
  - Risk if removed: Low. Stub only.
  - Last verified: 2026-03-17

### api/ — Dormant Pool handlers (Pools 2–6)

- **api/ingest-careers.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 2. Code complete. Not scheduled in vercel.json. Activation: add cron entry.
  - Last verified: 2026-03-17

- **api/promote-careers-signals.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 2 promotion handler. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/ingest-investor-feeds.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 3. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/promote-investor-signals.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 3. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/ingest-product-feeds.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 4. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/promote-product-signals.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 4. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/ingest-procurement-feeds.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 5. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/promote-procurement-signals.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 5. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/ingest-regulatory-feeds.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 6. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/promote-regulatory-signals.ts**
  - Classification: **dormant-complete**
  - Rationale: Pool 6. Code complete. Not scheduled.
  - Last verified: 2026-03-17

- **api/ingest-media-feeds.ts**
  - Classification: **dormant-incomplete**
  - Rationale: Pool 7 (media). Schema complete (migration 044). Ingestion handler present but Pool 7 per CLAUDE.md is "ingestion not implemented." Handler exists but produces empty results until media ingestion is wired.
  - Last verified: 2026-03-17

### api/ — Support/diagnostic handlers

- **api/health.ts**
  - Classification: **active**
  - Rationale: Operator diagnostic. Not scheduled (called manually). Returns ok/healthy, backlog warnings, suppression ratio, stuck signal count.
  - Last verified: 2026-03-17

- **api/pipeline-health.ts**
  - Classification: **active**
  - Rationale: Detailed per-page pipeline state diagnostic. Not scheduled. Called by operators.
  - Last verified: 2026-03-17

- **api/pipeline-status.ts**
  - Classification: **active**
  - Rationale: Per-competitor pipeline state. Not scheduled. Diagnostic endpoint.
  - Last verified: 2026-03-17

- **api/competitor-detail.ts**
  - Classification: **active**
  - Rationale: Called by radar-ui (api.ts, MarketMap, Radar, competitor-detail proxy route).
  - Last verified: 2026-03-17

- **api/onboard-competitor.ts**
  - Classification: **active**
  - Rationale: Called by radar-ui initialize-sector route and onboard-competitor proxy route. Registers monitored_pages, competitor_feeds, pool feed configs.
  - Last verified: 2026-03-17

- **api/radar-feed.ts**
  - Classification: **active**
  - Rationale: Called by radar-ui (api.ts getRadarFeed). Core UI data supply. Reads radar_positions.
  - Last verified: 2026-03-17

### lib/ — Core runtime libraries

- **lib/supabase.ts** — **active**
- **lib/database.types.ts** — **active** (generated types, used across all api/ and lib/)
- **lib/sentry.ts** — **active** (with SENTRY_DNS/SENTRY_DSN dual-key fallback — intentional)
- **lib/withSentry.ts** — **active** (wraps all api handlers)
- **lib/withCronAuth.ts** — **active** (enforces CRON_SECRET across all handlers)
- **lib/openai.ts** — **active** (shared OpenAI client)
- **lib/pipeline-metrics.ts** — **active** (writes pipeline_events for observability)
- **lib/retention-config.ts** — **active** (retention policy constants)
- **lib/rate-limit.ts** — **active** (used in detect-signals, fetch-snapshots, radar-feed, onboard-competitor)
- **lib/signal-relevance.ts** — **active** (AI Layer 1: relevance classification)
- **lib/movement-synthesis.ts** — **active** (AI Layer 3 logic)
- **lib/radar-narrative.ts** — **active** (AI Layer 4 logic)
- **lib/sector-intelligence.ts** — **active** (AI Layer 5 logic)
- **lib/selector-repair.ts** — **active** (used by suggest-selector-repairs)
- **lib/normalizeDomain.ts** — **parallel by design**
  - Rationale: Also exists as radar-ui/lib/normalizeDomain.ts. Both are active. Comments in each file explicitly declare surface ownership ("single source of truth for domain normalization across the pipeline runtime" vs "across the UI"). Not accidental duplication.
  - Last verified: 2026-03-17

- **lib/feed-discovery.ts** — **active** (used by ingest-feeds, Pool 1)
- **lib/feed-parser.ts** — **active** (used by ingest-feeds)
- **lib/investor-feed-discovery.ts** — **dormant-complete** (used by ingest-investor-feeds, Pool 3)
- **lib/investor-classifier.ts** — **dormant-complete** (used by ingest-investor-feeds)
- **lib/edgar-discovery.ts** — **dormant-complete** (used by onboard-competitor for EDGAR setup, Pool 3)
- **lib/ats-discovery.ts** — **dormant-complete** (used by ingest-careers, Pool 2)
- **lib/ats-parser.ts** — **dormant-complete** (used by ingest-careers)
- **lib/department-normalizer.ts** — **dormant-complete** (used by ingest-careers)
- **lib/product-feed-discovery.ts** — **dormant-complete** (used by ingest-product-feeds, Pool 4)
- **lib/product-classifier.ts** — **dormant-complete** (used by ingest-product-feeds)
- **lib/procurement-matcher.ts** — **dormant-complete** (used by ingest-procurement-feeds, Pool 5)
- **lib/procurement-classifier.ts** — **dormant-complete** (used by ingest-procurement-feeds)
- **lib/regulatory-classifier.ts** — **dormant-complete** (used by ingest-regulatory-feeds, Pool 6; also reads pool_events)
- **lib/media-keyword-extractor.ts** — **dormant-incomplete** (used by ingest-media-feeds, Pool 7)
- **lib/sector-media-sources.ts** — **dormant-incomplete** (used by ingest-media-feeds, Pool 7)
- **lib/sector-keyword-allowlists.ts** — **active** (used by generate-sector-intelligence, ingest-media-feeds; sector-intelligence is active)
- **lib/url-classifier.ts** — **active** (imported by onboard-competitor via url-scorer)
- **lib/url-scorer.ts** — **active** (used by onboard-competitor)
- **lib/url-discovery.ts** — **active** (used by onboard-competitor)
- **lib/url-validator.ts** — **active** (used by onboard-competitor)

### migrations/

- **000–018**: **active** — foundation schema applied to production.
- **019, 020**: **unknown** — numbers missing from local filesystem. May have been applied directly to Supabase without a local file, or intentionally skipped. Finding: gap in migration sequence.
- **021–044**: **active** — applied migrations per CLAUDE.md schema documentation.
- **005_seed_defence_energy_test.sql**: **dead** (as a recurring migration) — one-time test data seed for pre-launch. Should not be re-applied. Risk if re-applied: truncates pipeline tables.

---

## Section 3 — Frontend Surface

### radar-ui/app/ — Routes

- **app/page.tsx** (landing `/`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/pricing/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/about/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/login/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/signup/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/forgot-password/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/reset-password/page.tsx**
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/page.tsx** (main radar `/app`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/discover/** (`/app/discover`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/briefs/** (`/app/briefs`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/alerts/** (`/app/alerts`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/strategy/** (`/app/strategy`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/market-map/** (`/app/market-map`)
  - Classification: **dormant-incomplete** ⚠️
  - Rationale: Directory contains only `MarketMap.tsx` component file — no `page.tsx`. There is no Next.js route handler. MobileNav.tsx includes a link to `/app/market-map`. Following that link would produce a 404. Component code is substantive (full SVG positioning map with history trails).
  - Risk if removed: Low for the route (doesn't exist). The MarketMap.tsx component itself may be intended for future use.
  - Last verified: 2026-03-17

- **app/app/settings/page.tsx** (`/app/settings`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/billing/** (`/app/billing`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/onboarding/page.tsx** (`/app/onboarding`)
  - Classification: **active**
  - Last verified: 2026-03-17

- **app/app/lemonade/** (`/app/lemonade`)
  - Classification: **dormant-incomplete**
  - Rationale: Has a valid page.tsx + LemonadeView.tsx. Route is accessible at `/app/lemonade`. NOT linked from SidebarNav or MobileNav — only reachable by direct URL. Appears to be a feature in development (gamified competitive intelligence stand metaphor). Not dead — page.tsx is complete and functional.
  - Risk if removed: Low surface impact (no nav link). Risk of removing active dev work.
  - Last verified: 2026-03-17

### radar-ui/app/api/ — UI-side API routes

- **api/generate-brief/route.ts**
  - Classification: **active**
  - Rationale: Scheduled Mon 10:00 in radar-ui/vercel.json. AI Layer 6. Full implementation (not a stub). Generates weekly_briefs from artifact assembly.
  - Last verified: 2026-03-17

- **api/check-signals/route.ts**
  - Classification: **active**
  - Rationale: Scheduled hourly. Triggers alert emails for high-confidence signals. Uses GPT-4o synthesis.
  - Last verified: 2026-03-17

- **api/update-momentum/route.ts**
  - Classification: **active**
  - Rationale: Scheduled every 6h. Updates momentum_score, fires PostHog events.
  - Last verified: 2026-03-17

- **api/strategic-analysis/route.ts**
  - Classification: **active**
  - Rationale: Scheduled daily 08:00. Cross-competitor pattern detection.
  - Last verified: 2026-03-17

- **api/update-positioning/route.ts**
  - Classification: **active**
  - Rationale: Scheduled daily 09:00. Updates market_focus_score / customer_segment_score.
  - Last verified: 2026-03-17

- **api/record-positions/route.ts**
  - Classification: **active**
  - Rationale: Writes radar_positions table (SVG node trail). Called by RadarViewedTracker component.
  - Last verified: 2026-03-17

- **api/health/route.ts**
  - Classification: **active**
  - Rationale: Frontend-side health endpoint. Checks cron_heartbeats table and DB connectivity.
  - Last verified: 2026-03-17

- **api/sector-news/route.ts**
  - Classification: **active**
  - Rationale: Fetches Google News RSS for sector context. Returns empty array on failure. NOT dependent on Pool 7 media ingestion — fetches live RSS directly. Do not classify as dead.
  - Last verified: 2026-03-17

- **api/competitor-detail/route.ts**
  - Classification: **active**
  - Rationale: Proxy to runtime api/competitor-detail.ts. Used by Radar.tsx, MarketMap.tsx, api.ts.
  - Last verified: 2026-03-17

- **api/initialize-sector/route.ts**
  - Classification: **active**
  - Rationale: Called during onboarding. Calls runtime onboard-competitor API.
  - Last verified: 2026-03-17

- **api/onboard-competitor/route.ts**
  - Classification: **active**
  - Rationale: User-initiated competitor onboarding. Calls runtime.
  - Last verified: 2026-03-17

- **api/discover/track + untrack**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/clean-slate/route.ts**
  - Classification: **active**
  - Rationale: Deletes tracked_competitors + resets sector to custom.
  - Last verified: 2026-03-17

- **api/alerts/read/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/auth/callback + signout**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/billing-portal/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/stripe/** (checkout, portal, sync-subscription, upgrade, webhook)
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/stripe-webhook/route.ts**
  - Classification: **parallel by design**
  - Rationale: Intentional alias — re-exports POST from stripe/webhook. Stripe dashboard configured to POST here. Comment in file explicitly explains this. Both URLs are required.
  - Last verified: 2026-03-17

- **api/events/signup/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/momentum/history/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/settings/sector/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/expand-feature-panel/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

- **api/expand-intel-story/route.ts**
  - Classification: **active**
  - Last verified: 2026-03-17

### radar-ui/components/ — All components verified active

The following components are all imported and rendered in live routes (verified via grep):

- **active**: Radar.tsx, SidebarNav.tsx, AppOverlays.tsx, DailyBriefOverlay.tsx, AboutOverlay.tsx, MilestoneOverlay.tsx, FirstSignalCelebration.tsx, AchievementsButton.tsx, FeatureDiscoveryPanel.tsx, FeaturesButton.tsx, TelescopePanel.tsx, IntelligenceStrip.tsx, HistoricalCapsule.tsx, KeybindingHint.tsx, NotificationBell.tsx, MomentumSparkline.tsx, PlanBadge.tsx, SectorSwitcher.tsx, InitBanner.tsx, ActivityTimeline.tsx, SoundSettings.tsx, SoundToggleButton.tsx, TimezoneSettings.tsx, TutorialHint.tsx, CheckoutButton.tsx, ManageSubscriptionPanel.tsx, TrialLockScreen.tsx, MobileAppGate.tsx, UpgradePrompt.tsx, MobileNav.tsx, MobileHeader.tsx, MobileBottomNav.tsx, CleanSlateButton.tsx, RadarViewedTracker.tsx, RadarLogo.tsx, LandingLogo.tsx, LandingCTAButtons.tsx, LandingFeaturePrompt.tsx, PublicNav.tsx, PricingTracker.tsx, PostHogIdentify.tsx, PostHogProvider.tsx, SyncSubscription.tsx, SubscribedStatusSurface.tsx
  - Last verified: 2026-03-17

### radar-ui/lib/ — Frontend libraries

- **lib/api.ts** — **active** (getRadarFeed, getCompetitorDetail — core UI data functions)
- **lib/supabase/** (client.ts, server.ts, service.ts) — **active**
- **lib/normalizeDomain.ts** — **parallel by design** (see runtime lib note)
- **lib/posthog.ts** — **active**
- **lib/sentry.ts** — **active**
- **lib/stripe.ts** — **active** (includes STRIP_ANALYST_PRICE_ID legacy typo fallback — handled)
- **lib/format.ts** — **active**
- **lib/confidence.ts** — **active**
- **lib/pressure.ts** — **active**
- **lib/momentum.ts** — **active**
- **lib/positioning.ts** — **active** (quadrantLabel used by MarketMap.tsx)
- **lib/strategy.ts** — **active**
- **lib/sectors.ts** — **active**
- **lib/sector-catalog.ts** — **active**
- **lib/catalog.ts** — **active** (used by initialize-sector, DiscoverClient)
- **lib/subscription.ts** — **active**
- **lib/brief.ts** — **active** (imports cluster-signals and enrich-cluster-themes)
- **lib/brief/cluster-signals.ts** — **active** (used by brief.ts)
- **lib/brief/enrich-cluster-themes.ts** — **active** (used by brief.ts)
- **lib/audio.ts** — **active** (used by Radar.tsx)
- **lib/activityEcho.ts** — **active** (used by Radar.tsx)
- **lib/microInsights.ts** — **active** (used by Radar.tsx)
- **lib/criticalAlert.ts** — **active** (used by Radar.tsx)
- **lib/tension.ts** — **active** (used by Radar.tsx)
- **lib/alert.ts** — **active** (used by check-signals)
- **lib/email.ts** — **active** (used by check-signals, generate-brief)
- **lib/intel-stories.ts** — **active** (used by IntelligenceStrip, HistoricalCapsule)
- **lib/feature-panels.ts** — **active** (used by FeatureDiscoveryPanel, AppOverlays)
- **lib/panel-coordinator.ts** — **active** (used by FeatureDiscoveryPanel, TelescopePanel)
- **lib/cronHeartbeat.ts** — **active** (used by check-signals, update-momentum, strategic-analysis, etc.)
- **lib/lemonade.ts** — **dormant-incomplete** (used only by LemonadeView.tsx; route has no nav link)

---

## Section 4 — Scripts / Tooling

- **scripts/migrate.ts**
  - Classification: **active**
  - Rationale: Migration runner with --status and --dry-run modes. Uses pg client against Supabase Session pooler. Tracks applied migrations in schema_migrations table.
  - Last verified: 2026-03-17

- **scripts/check-surface-deps.sh**
  - Classification: **active**
  - Rationale: Referenced in CLAUDE.md and startsession.md as required pre-task workflow step. Warns on cross-surface import violations.
  - Last verified: 2026-03-17

- **scripts/setup-git-hooks.js**
  - Classification: **active**
  - Rationale: Installs pre-push TypeScript check hook. Runs automatically via prepare lifecycle. Guards against CI/Vercel environments correctly.
  - Last verified: 2026-03-17

---

## Section 5 — Dependencies

### Root package.json (runtime surface)

| Package | Classification | Notes |
|---|---|---|
| @sentry/node | active | Used by lib/sentry.ts, all api handlers |
| @supabase/supabase-js | active | Used by lib/supabase.ts |
| cheerio | active | Used by api/extract-sections.ts for HTML parsing |
| openai | active | Used by lib/openai.ts, AI layers 1–5 |
| pg | active | Used by scripts/migrate.ts |
| @types/node | active (dev) | TypeScript node types |
| @types/pg | active (dev) | TypeScript pg types |
| tsx | active (dev) | Runs migrate.ts via npx |
| typescript | active (dev) | Compile-time checks |

All root dependencies verified active. No dead or surface-misowned packages detected.

### radar-ui/package.json (frontend surface)

| Package | Classification | Notes |
|---|---|---|
| @sentry/nextjs | active | Used by lib/sentry.ts, sentry.client/server config |
| @supabase/ssr | active | Used by lib/supabase/client.ts and server.ts |
| @supabase/supabase-js | active | Used by lib/supabase/service.ts |
| d3-scale | active | Used by Radar.tsx for scale calculations |
| framer-motion | active | Used by Radar.tsx, LemonadeView.tsx, multiple components |
| next | active | Core framework |
| postcss | active | Tailwind processing |
| posthog-js | active | Used by PostHogProvider.tsx |
| react / react-dom | active | Core framework |
| openai | active | Used by check-signals, strategic-analysis, update-positioning, update-momentum, generate-brief |
| stripe | active | Used by stripe/checkout, stripe/webhook, stripe/portal, billing-portal |
| @tailwindcss/postcss | active (dev) | |
| @types/* | active (dev) | |
| eslint / eslint-config-next | active (dev) | |
| tailwindcss | active (dev) | |
| typescript | active (dev) | |

All radar-ui dependencies verified active. No dead or surface-misowned packages detected.

**Notable findings:**
- `openai` and `stripe` in radar-ui are VALID — radar-ui runs its own AI routes (check-signals, generate-brief, etc.) and Stripe webhook handling.
- `STRIP_ANALYST_PRICE_ID`: legacy env var typo. lib/stripe.ts handles it as a fallback (`?? process.env.STRIP_ANALYST_PRICE_ID`). Not a dependency — an env var concern (see Section 6).

---

## Section 6 — Environment Variables

Both surfaces have `.env.example` files — env documentation exists.

### Runtime surface (root .env.example)

| Variable | Classification | Surface | Documented |
|---|---|---|---|
| SUPABASE_URL | active | runtime | yes |
| SUPABASE_SERVICE_ROLE_KEY | active | runtime | yes |
| OPENAI_API_KEY | active | runtime | yes |
| SENTRY_DSN | active | runtime | yes |
| SENTRY_DNS | active (fallback) | runtime | no — typo fallback, handled in lib/sentry.ts, NOT in .env.example |
| CRON_SECRET | active | runtime | yes |
| NODE_ENV | active | runtime | implicit (platform-injected) |
| VERCEL_ENV | active | runtime | implicit (Vercel-injected) |
| VERCEL_GIT_COMMIT_SHA | active | runtime | implicit (Vercel-injected) |

**Findings:**
- `SENTRY_DNS` (typo) is a fallback handled in code but not documented in .env.example. Low risk but worth noting.

### Frontend surface (radar-ui/.env.example)

| Variable | Classification | Surface | Documented |
|---|---|---|---|
| RADAR_API_BASE_URL | active | frontend | yes |
| RUNTIME_URL | active | frontend | yes |
| CRON_SECRET | active | frontend | yes |
| NEXT_PUBLIC_SUPABASE_URL | active | frontend | yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | active | frontend | yes |
| NEXT_PUBLIC_POSTHOG_KEY | active | frontend | yes |
| POSTHOG_API_KEY | active | frontend | yes |
| RESEND_API_KEY | active | frontend | yes |
| FROM_EMAIL | active | frontend | yes |
| OPENAI_API_KEY | active | frontend | yes |
| OPENAI_MAX_ORGS_PER_RUN | active | frontend | yes |
| SENTRY_DSN | active | frontend | yes |
| SENTRY_DNS | active (fallback) | frontend | no — typo fallback in code, not in .env.example |
| SUPABASE_SERVICE_ROLE_KEY | active | frontend | yes |
| NEXT_PUBLIC_SITE_URL | active | frontend | yes |
| STRIPE_SECRET_KEY | active | frontend | yes |
| STRIPE_WEBHOOK_SECRET | active | frontend | yes |
| STRIPE_ANALYST_PRICE_ID | active | frontend | yes |
| STRIPE_PRO_PRICE_ID | active | frontend | yes |
| STRIP_ANALYST_PRICE_ID | orphaned (legacy typo) | frontend | no — legacy typo, fallback in lib/stripe.ts; not in .env.example |

**Findings:**
- `SENTRY_DNS` (typo): handled in both surfaces via fallback code. Undocumented in both .env.example files. If any deployment sets this accidentally instead of `SENTRY_DSN`, it will still work.
- `STRIP_ANALYST_PRICE_ID` (legacy typo): handled in lib/stripe.ts. Not documented. If production has this set, the fallback ensures it works. Cleanup candidate once confirmed no prod env sets the old name.

---

## Section 7 — Database

### Core pipeline tables

| Table | Classification | Read | Write | Notes |
|---|---|---|---|---|
| competitors | active | yes | yes | Central identity table. Updated by onboard-competitor, update-pressure-index. |
| monitored_pages | active | yes | yes | health_state column (037). |
| snapshots | active | yes | yes | Raw page content. |
| page_sections | active | yes | yes | Extracted content blocks. |
| section_baselines | active | yes | yes | Insert-only anchor. |
| section_diffs | active | yes | yes | page_class column from 022. |
| signals | active | yes | yes | relevance_level, source_type, signal_hash. |
| interpretations | active | yes | yes | AI Layer 2 output. |
| strategic_movements | active | yes | yes | movement_summary, confidence_level (032). |
| activity_events | active | yes | yes | Ambient only. 30d retention. |
| radar_narratives | active | yes | yes | AI Layer 4 output. |
| sector_intelligence | active | yes | yes | AI Layer 5 output. |
| weekly_briefs | active | yes | yes | AI Layer 6 output (radar-ui). |
| radar_positions | active | yes | yes | Written by record-positions, read by radar-feed. 28d retention. |
| pipeline_events | active | yes | yes | 90d retention. Written by pipeline-metrics.ts. |

### Supporting tables

| Table | Classification | Read | Write | Notes |
|---|---|---|---|---|
| signal_feedback | active | yes | limited | Read by interpret-signals.ts. Write path exists (retention deletes). No UI write surface confirmed. |
| selector_repair_suggestions | active | yes | yes | Written by suggest-selector-repairs. Operator review only, never auto-applied. |
| extraction_rules | active | yes | yes | Read by extract-sections, onboard-competitor, pipeline-status; written by onboard-competitor/selector-repair. |

### Pool tables (dormant pools 2–6)

| Table | Classification | Notes |
|---|---|---|
| pool_events | active (Pool 1) / dormant-complete (Pools 2–6) | Written by all ingest handlers. Pool 1 active. Pools 2–6 not scheduled. |
| competitor_feeds | active (Pool 1) / dormant-complete (Pools 2–6) | Feed config per competitor. Pool 1 active. |
| procurement_sources | dormant-complete | Read/written by Pool 5 ingest-procurement-feeds. |
| regulatory_sources | dormant-complete | Read/written by Pool 6 ingest-regulatory-feeds. |

### Pool 7 / media tables

| Table | Classification | Notes |
|---|---|---|
| media_observations | dormant-incomplete | Schema present (044). ingest-media-feeds handler present but Pool 7 ingestion not implemented. 30d retention planned. |
| sector_narratives | dormant-incomplete | Schema present (044). Referenced in generate-brief as optional input. Currently empty. Queried but returns no rows. |

### Schema objects

| Object | Classification | Notes |
|---|---|---|
| radar_feed view | active | Core UI supply. Built in migration 015. Rebuilt in later migrations. |
| Retention RPCs (x4) | active | retention_null_raw_html, retention_delete_sections, retention_delete_diffs, retention_delete_pipeline_events. Called by api/retention.ts. |
| cluster_recent_signals RPC | unknown | Called by update-signal-velocity.ts with graceful PGRST202 fallback. May not exist in current schema — no migration defines it locally. |
| calculate_signal_velocity RPC | unknown | Same as above. |
| auto-deactivation trigger | active | Migration 023. Deactivates monitored_pages on error threshold. |
| last_signal_at trigger | active | Denormalized competitor field, kept by trigger. |

### Migration sequence gap

| Finding | Classification |
|---|---|
| Migrations 019 and 020 are absent from the local migrations/ directory | unknown — may have been applied directly to Supabase, may never have existed. Schema appears consistent without them. |

---

## Section 8 — Monitoring / Operations

- **Sentry (runtime)**
  - Classification: **active**
  - Rationale: lib/sentry.ts wraps all api/ handlers via withSentry. Sentry check-ins emitted for all scheduled jobs. Breadcrumbs throughout pipeline stages. Operational warnings: suppression_anomaly, extraction_drift_detected, baseline_instability_warning, diff_stability_warning, pipeline_backlog_warning, suppression_ratio_warning.
  - Last verified: 2026-03-17

- **Sentry (frontend)**
  - Classification: **active**
  - Rationale: @sentry/nextjs in radar-ui. captureException/captureMessage used in UI API routes.
  - Last verified: 2026-03-17

- **api/health.ts (runtime)**
  - Classification: **active**
  - Rationale: Diagnostic endpoint for operator use. Returns ok/healthy, backlog warnings, noise ratio, stuck signals, fetch class backlogs.
  - Last verified: 2026-03-17

- **radar-ui api/health/route.ts (frontend)**
  - Classification: **active**
  - Rationale: Checks cron_heartbeats and DB. Returns 503 if stale. Watches: check-signals (90m), update-momentum (390m), generate-brief (10080m), strategic-analysis (1500m), update-positioning (1500m).
  - Last verified: 2026-03-17

- **lib/cronHeartbeat.ts (frontend)**
  - Classification: **active**
  - Rationale: writeCronHeartbeat() called by all radar-ui cron routes. Writes to cron_heartbeats table for health monitoring.
  - Last verified: 2026-03-17

- **lib/pipeline-metrics.ts (runtime)**
  - Classification: **active**
  - Rationale: Writes pipeline_events for observability. 90d retention.
  - Last verified: 2026-03-17

- **PostHog analytics**
  - Classification: **active**
  - Rationale: NEXT_PUBLIC_POSTHOG_KEY (client) and POSTHOG_API_KEY (server) both in use. Events fired from: stripe flows, check-signals, update-momentum, strategic-analysis, update-positioning, discover track/untrack.
  - Last verified: 2026-03-17

---

## Section 9 — Cleanup Candidates (Future Reference Only — No Action Taken)

### A. High-confidence future cleanup (superseded / dead / low-risk orphaned)

1. **docs/ARCHITECTURE_INDEX.md** — superseded, safe to delete
2. **docs/MASTER_ARCHITECTURE_PLAN.md** — superseded, safe to delete
3. **docs/SYSTEM_ARCHITECTURE.md** — superseded, safe to delete
4. **docs/SUPABASE_ARCHITECTURE.md** — superseded, safe to delete
5. **docs/PIPELINE_STATE_MACHINE.md** — superseded, safe to delete
6. **docs/SYSTEM_RUNTIME_FLOW.md** — superseded, safe to delete
7. **docs/OPERATIONS.md** — superseded, safe to delete
8. **docs/PATTERN_LAYER.md** — superseded + empty planned content, safe to delete
9. **docs/CHATGPT_ASSESSMENT_PROMPT.md** — orphaned, no dependency
10. **SYSTEM_MAP.md** — superseded (no header warning), low risk
11. **add5.md** — dead untracked file, safe to delete
12. `STRIP_ANALYST_PRICE_ID` fallback in lib/stripe.ts — safe to remove once confirmed no production deployment still uses the old env var name
13. `SENTRY_DNS` fallback — safe to remove once confirmed no deployment uses the typo name

### B. Must preserve (active / dormant-complete / parallel by design)

1. **All Pool 2–6 api/ and lib/ handlers** — dormant-complete; activation is one cron entry
2. **api/stripe-webhook/route.ts** — parallel by design; Stripe webhook URL configured there
3. **lib/normalizeDomain.ts (both surfaces)** — parallel by design; different ownership scopes
4. **api/generate-brief.ts (runtime stub)** — dormant-incomplete; intentional disabled stub
5. **api/ingest-media-feeds.ts** — dormant-incomplete; Pool 7 schema in place
6. **migrations/005_seed_defence_energy_test.sql** — preserve as documentation; must not be re-run
7. **FAST_MODE.md** — do NOT silently delete; contains a mental model conflict that needs explicit resolution with the founder

### C. Ambiguous / needs investigation

1. **app/app/market-map/** — component exists, no page.tsx, MobileNav link is a 404. Needs decision: add page.tsx or remove nav link.
2. **app/app/lemonade/** — complete but unlinked route. Needs decision: add to nav or archive.
3. **update-signal-velocity.ts** — calls RPCs that may not exist (no local migration). Needs verification: do cluster_recent_signals and calculate_signal_velocity exist in the live Supabase schema?
4. **Migrations 019, 020** — absent locally. Needs verification: were they applied directly to Supabase? Is there a gap or are they intentionally absent?
5. **docs/SIGNAL_REVIEW_WORKFLOW.md** — no superseded header. Needs review: still current vs signal_feedback flow?
6. **DEV_TASKS.md** — informal task list. Needs decision: retain as living backlog or delete.
7. **lib/lemonade.ts** — coupled to unlinked lemonade route. Fate depends on lemonade route decision.
8. **FAST_MODE.md** — active mental model conflict with startsession.md rules. Needs explicit resolution.

---

*Audit complete. No files modified, deleted, renamed, or refactored during this pass.*
