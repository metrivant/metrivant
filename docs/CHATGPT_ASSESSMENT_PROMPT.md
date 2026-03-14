# Metrivant — ChatGPT Master Assessment Prompt

Copy the entire block below and paste it into ChatGPT (GPT-4o recommended).

---

```
You are a senior full-stack engineer and product strategist doing a complete assessment of Metrivant — a competitive intelligence radar SaaS product. Your job is to produce a master improvement prompt covering every meaningful dimension: product, engineering, security, data pipeline, UX, growth, and operations.

---

## SYSTEM OVERVIEW

Metrivant is a B2B SaaS competitive intelligence radar. It continuously monitors competitor websites, detects strategic changes, classifies them as signals, and renders the intelligence as a real-time radar instrument. It is built and operated by a single founder/engineer.

### Stack
- Frontend: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, Framer Motion
- Backend runtime: Vercel serverless functions (metrivant-runtime.vercel.app)
- State machine: Supabase (Postgres + Auth)
- AI interpretation: OpenAI GPT-4o (temperatures 0.15–0.25 for determinism)
- Monitoring: Sentry (@sentry/nextjs, @sentry/node)
- Analytics: PostHog (manual events, no autocapture)
- Email: Resend
- Payments: Stripe (checkout + billing portal, webhook-synced)
- Deployment: Vercel (git-connected, auto-deploy on push to main)

### Core Pipeline (sequential, deterministic)
```
competitors
→ monitored_pages        (page_class: high_value | standard | ambient)
→ snapshots              (full page HTML crawled)
→ page_sections          (CSS selector extraction per extraction_rule)
→ section_baselines      (first-observed anchor, insert-only)
→ section_diffs          (current vs baseline, noise-gated)
→ signals                (classified: type, severity, confidence 0–1, signal_hash dedup)
→ interpretations        (GPT-4o clustering of related signals)
→ strategic_movements    (confirmed movement events, 14d window, min 2 signals)
→ radar_feed             (aggregated view: momentum_score, signals_7d, movement fields)
→ UI Radar               (SVG radar, golden-angle spiral positioning, node size = momentum)
```

### Confidence model
- Base score from section type weight (0.25–0.85)
- Recency bonus (+0.05/0.10/0.15)
- Observation bonus (min 0.15)
- page_class bonus (+0.08 for high_value)
- Gate: < 0.35 suppressed, 0.35–0.64 pending_review, ≥ 0.65 → GPT-4o

### Signal dedup
sha256(competitor_id:signal_type:section_type:diff_id)[:32] — anchored to specific diff

### Monitored pages per competitor (7 per competitor)
homepage (standard), pricing (high_value), changelog (high_value), blog (ambient), features (standard), newsroom (high_value), careers (ambient)

### Sector model
Full config: SaaS, Defense & Aerospace, Energy & Resources
Catalog only: Cybersecurity, Fintech, AI Infrastructure, DevTools, Healthcare, Consumer Tech, Custom

---

## CURRENT SYSTEM STATE (as of March 2026)

### What is working
- Full pipeline operational end-to-end
- 10 energy sector competitors onboarded with 7 pages + extraction rules each
- Stripe checkout and billing portal fully integrated
- Sentry monitoring active (SENTRY_DNS legacy env var fallback added)
- PlanBadge merged into single header pill (Pro=gold, Trial=amber, Analyst=slate·Upgrade→)
- Radar auto-refreshes every 60s when active, 30s when empty
- User/org isolation hardened at API and frontend state layers
- Mobile-gated app (desktop-first, mobile shows holding page with "copy desktop link")
- Critical alert system (fires at most once per radar load when ALL 5 criteria met)
- Daily brief overlay, weekly GPT-4o briefs, strategic analysis, market positioning map
- Signal Constellation widget in sidebar
- PostHog event tracking (manual, key events: radar_viewed, competitor_selected, upgrade_clicked, etc.)

### Known limitations and gaps
- radar_feed Supabase view is a stub (hardcoded zeros/NULLs) — real data served by runtime /api/radar-feed
- No migration files exist for the 11 core pipeline tables (schema undocumented in migrations)
- Section_diffs and page_sections CHECK constraints recently fixed to match current section types — DB was using stale types from an earlier schema version
- No per-user rate limiting on API routes (DoS risk to quota only, no data leakage risk)
- 7 sectors have catalog support but fall back to SaaS terminology (no full SectorConfig)
- Static competitor catalog (283 entries) does not self-update
- No server-sent events or websockets — radar freshness depends on 60s polling
- Organic SEO is minimal — only JSON-LD structured data on landing page
- No onboarding email sequence beyond welcome + tracking confirmation
- No A/B testing infrastructure
- No admin dashboard for monitoring user activity, pipeline health across orgs, or revenue metrics
- Lemonade Mode (/app/lemonade) exists as experimental feature, hidden from nav

### Recently fixed (this session)
- Stripe auth failure from STRIPE_SECRET_KEY whitespace → added .trim()
- Supabase schema cache crash in layout.tsx and billing/page.tsx → wrapped in try/catch
- initialize-sector fire-and-forget bug → await Promise.allSettled before response
- onboard-competitor internal_error from Sentry uninitialized → moved captureCheckIn inside try
- DB CHECK constraints blocking onboarding → fixed 5 tables
- Sentry SENTRY_DNS/SENTRY_DSN env var mismatch → added fallback
- .single() crash risk in alerts, alerts/read, momentum/history → replaced with .limit(1)
- Alert sessionStorage dedup key now org-scoped

---

## ASSESSMENT REQUEST

Given this complete system state, produce a single master prompt I can give back to Claude Code to:

1. Fix all remaining issues in priority order
2. Improve product quality (UX, information hierarchy, radar clarity, signal evidence chain)
3. Improve engineering quality (type safety, error handling, observability, performance)
4. Improve security (any remaining isolation gaps, RLS completeness, input validation)
5. Improve data pipeline reliability (better error recovery, constraint alignment, idempotency)
6. Improve growth/conversion (landing page, onboarding flow, upgrade prompts, email sequences)
7. Improve operational visibility (admin tools, health monitoring, pipeline dashboards)

### Constraints for the prompt you produce:
- Solo founder/engineer — no team, no complex infrastructure
- Do not suggest microservices, queues, Redis, or distributed systems
- Keep architecture identical (Supabase state machine, stateless Vercel runtime, Next.js UI)
- Prioritize by impact/effort ratio — highest leverage changes first
- The prompt must be immediately executable by Claude Code without further clarification
- Group changes by: Critical fixes → High-leverage improvements → Medium improvements → Low priority polish
- For each change: specify exact file(s), what to change, and why

Output: A single large Claude Code prompt I can paste directly to execute all improvements in the correct order.
```

---

## Usage notes

- Paste the block above into GPT-4o
- The output will be a master execution prompt for Claude Code
- Review the produced prompt before running — it will propose real code changes
- Run the produced prompt in this repo at: `/home/arcmatrix93/metrivant`
