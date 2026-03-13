# Metrivant System Map

---

## 1. System Overview

Metrivant is a sector-agnostic competitive intelligence radar that detects strategic movement across companies.

It continuously monitors competitor websites, classifies changes as signals, aggregates signals into strategic movements, and renders that intelligence as a real-time radar instrument.

---

## 2. Core Pipeline

```
competitors
→ monitored_pages       URLs registered for crawling per competitor
→ snapshots             Full page content captured on each crawl cycle
→ page_sections         Content segmented into logical blocks
→ section_baselines     Stable reference state per section
→ section_diffs         Delta between current content and baseline
→ signals               Classified diffs: type, urgency, confidence, evidence
→ interpretations       Signal clusters forming a coherent strategic intent
→ strategic_movements   Confirmed movement events with type, velocity, confidence
→ radar_feed            Aggregated view: one row per competitor, momentum score
→ UI                    Radar dashboard rendering the feed
```

Downstream layers (derived, not pipeline stages):
- **briefs** — weekly GPT-4o digests
- **strategic_analysis** — cross-competitor pattern detection
- **market_positioning** — 2×2 scoring map
- **alerts** — high-urgency signal notifications

---

## 3. System Components

| Component | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion |
| Backend runtime | Vercel serverless functions (`metrivant-runtime.vercel.app`) |
| State engine | Supabase (Postgres + Auth) |
| AI interpretation | OpenAI GPT-4o |
| Monitoring | Sentry (`@sentry/nextjs`) |
| Analytics | PostHog (manual events only) |
| Email | Resend |
| Payments | Stripe (checkout, webhooks, portal — integrated) |
| Version control | GitHub |

---

## 4. Main UI Surfaces

| Surface | Path |
|---|---|
| Landing page | `/` |
| Radar app | `/app` |
| Discover catalogue | `/app/discover` |
| Briefs | `/app/briefs` |
| Market map | `/app/market-map` |
| Strategy page | `/app/strategy` |
| Alerts | `/app/alerts` |
| Settings | `/app/settings` |
| Billing | `/app/billing` |

---

## 5. Radar System

The radar is the central product interface.

- **Nodes** = competitors (position = momentum, size = signal density)
- **Signals** = detected strategic movement (priced, product, market, enterprise)
- **Clusters** = groups of competitors showing similar strategic pressure
- **Gravity Field mode** = force-directed layout clustering nodes by similarity
- **Observatory mode** = full-viewport isolation with temporal filter

SVG viewport: 1000×1000. Node positions use golden-angle spiral. Momentum score drives radius distance from center.

---

## 6. Sector Model

The pipeline is sector-agnostic. Sector controls display language, catalog curation, and terminology only. Detection logic does not change.

| Sector | Full config |
|---|---|
| SaaS | Yes |
| Defense & Aerospace | Yes |
| Energy & Resources | Yes |
| Cybersecurity, Fintech, AI Infrastructure, DevTools, Healthcare, Consumer Tech, Custom | Catalog + display only |

---

## 7. Key Engineering Principles

- **Deterministic pipeline** — every output traceable to observed input
- **Supabase as state machine** — all persistent state lives in Supabase
- **Stateless runtime** — Vercel functions are ephemeral, no in-process state
- **Minimal architecture** — maintained by one engineer
- **Small safe changes** — targeted edits over rewrites

---

## 8. System Constraints

Do not introduce:

- Microservices or service decomposition
- Kafka, SQS, or distributed message queues
- Redis, MongoDB, or additional databases
- Background worker clusters
- Enterprise abstraction layers (DI containers, repository pattern)
- Breaking changes to `radar_feed` or `competitor_detail` API shapes

---

## 9. Experimental Features

**Lemonade Mode** (`/app/lemonade`) — Alternative radar reading using a lemonade stand metaphor. Translates movement types into plain-language analogies. Hidden from primary navigation. Not production-critical.
