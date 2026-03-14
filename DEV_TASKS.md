# Metrivant Development Tasks

Tasks should be implemented one at a time using focused execution prompts.

---

## High Priority

1. Implement radar zoom, pan, and isolation mode
2. Improve radar node readability and contrast
3. Improve intelligence report clarity and typography
4. Improve signal icon system

## Medium Priority

5. Implement radar sound design system
6. Improve sector selection UI
7. Improve competitor discovery catalogue
8. Improve cluster visualization on radar

## Low Priority

9. Refine landing page minimal messaging
10. Enforce plan limits in the UI (show upgrade prompt when competitor limit reached in Discover)

---

## Recently completed

- Mobile optimization (MobileNav, radar bottom-sheet, full-width overlays)
- Conversion optimization (hero copy, Discover teaser text, signup tagline)
- Scaling safeguards (cron heartbeats, /api/health, OPENAI_MAX_ORGS_PER_RUN cap, history pruning)
- Future-proofing pass (plan enforcement server-side, PostHog plan/sector segmentation, MRR tracking, signup guard)
- Morning Brief intelligence overlay
- Competitor tracking flow and catalog stability
- Stripe checkout integration (.trim() on STRIPE_SECRET_KEY, correct API version)
- PlanBadge merged into single pill (Pro=gold, Trial=amber·Upgrade→, Analyst=slate·Upgrade→)
- Signal Constellation label centered above panel
- initialize-sector fire-and-forget bug fixed (await Promise.allSettled before response)
- Sentry SENTRY_DNS/SENTRY_DSN env var fallback added to runtime lib/sentry.ts
- onboard-competitor Sentry captureCheckIn moved inside try block
- DB CHECK constraints aligned with current pipeline section/signal types:
  - monitored_pages.page_type (homepage, pricing, changelog, blog, features, newsroom, careers)
  - extraction_rules.section_type (hero, headline, product_mentions, pricing_plans, pricing_references, release_feed, features_overview, announcements, careers_feed)
  - page_sections.chk_section_type_page_sections (same types)
  - section_diffs.chk_section_type_section_diffs (same types — was using stale schema types)
  - signals.chk_signal_type added hiring_surge
- Radar auto-refresh extended to 60s polling when active (not just empty state)
- User/org isolation hardened: .single() → .limit(1) in alerts, alerts/read, momentum/history; alert sessionStorage dedup key now includes orgId
