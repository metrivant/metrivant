# Metrivant — System Overview

## What Is Metrivant?

Metrivant is a **deterministic competitive intelligence radar**. It monitors competitor websites automatically, detects meaningful structural changes at the DOM level, interprets those changes into strategic signals, and presents them on a real-time radar UI.

It is not a generic dashboard. It is not a feed reader. It is a precision instrument for detecting competitor movement.

## Core Identity

- **Deterministic detection**: every signal is sourced from a real HTML diff on a real monitored page
- **AI for interpretation only**: OpenAI is never used for detection; it annotates already-detected changes with strategic context
- **Supabase as state machine**: the database owns all pipeline state transitions, not the runtime
- **Vercel runtime is stateless**: each cron job reads state from Supabase, advances it, writes back
- **Solo-operator maintainable**: infrastructure sized for one engineer

## System Components

| Component | Purpose | Provider |
|-----------|---------|----------|
| Frontend (radar-ui) | Radar visualization, auth, alerts, briefs, settings | Vercel (separate project) |
| Backend runtime | Pipeline execution via cron jobs | Vercel (separate project) |
| Database | State machine, all durable data | Supabase (PostgreSQL) |
| AI interpretation | Signal annotation with strategic context | OpenAI GPT-4 |
| Error monitoring | Crash and exception tracking | Sentry |
| Analytics | User event tracking | PostHog |
| Email | Transactional emails | Resend |
| Domain | Production hostname | metrivant.com |

## Pipeline Summary

```
Competitor websites
    ↓
fetch-snapshots     — capture raw HTML every 6h
    ↓
extract-sections    — apply CSS selectors, extract structured sections
    ↓
build-baselines     — establish stable reference state per section
    ↓
detect-diffs        — compare current sections to baselines, flag changes
    ↓
detect-signals      — elevate confirmed diffs to strategic signals
    ↓
interpret-signals   — annotate signals with AI (summary, implication, urgency)
    ↓
update-signal-velocity — compute weighted velocity scores
    ↓
detect-movements    — cluster signals into strategic movement patterns
    ↓
radar_feed (view)   — expose enriched competitor data to UI
    ↓
UI                  — radar visualization, alerts, briefs, strategy
```

## Two Deployed Projects

1. **radar-ui** (`https://metrivant.com`) — Next.js frontend + SaaS API routes + Vercel cron for UI-layer jobs
2. **metrivant-runtime** (`https://metrivant-runtime.vercel.app` or custom subdomain) — Backend pipeline cron runner

These are **separate Vercel projects**. The frontend calls the backend via `RADAR_API_BASE_URL`.

## Version at Export

- Next.js: 16.1.6
- React: 19.2.3
- TypeScript: strict mode, 5.x
- Supabase JS: 2.99.x
- PostHog JS: 1.360.x
- Export date: 2026-03-12
