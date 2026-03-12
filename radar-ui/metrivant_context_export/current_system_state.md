# Metrivant — Current System State

**As of: 2026-03-12**

---

## Code State

### TypeScript: CLEAN
```
npx tsc --noEmit → exit code 0, no errors
```

### Git Branch: main

Recent commits:
```
91127eb Finalize public release readiness
60fbf96 Refine radar UI and clean project structure
fe63572 Clean backend and dedupe strategic movements
fc3eae9 Add clickable radar blips and intelligence drawer
cb41b06 Add radar UI
```

Working tree: clean (no uncommitted changes)

---

## Feature Completeness

### Core Pipeline
| Feature | Status |
|---------|--------|
| fetch-snapshots | ✅ Complete |
| extract-sections (Cheerio) | ✅ Complete |
| build-baselines | ✅ Complete |
| detect-diffs | ✅ Complete |
| detect-signals | ✅ Complete |
| interpret-signals (GPT-4) | ✅ Complete |
| update-signal-velocity | ✅ Complete |
| detect-movements | ✅ Complete |
| radar_feed VIEW | ✅ Complete |

### Frontend
| Feature | Status |
|---------|--------|
| Landing page | ✅ Complete |
| Auth (login/signup) | ✅ Complete |
| Radar visualization | ✅ Complete |
| Radar blips (clickable) | ✅ Complete |
| Intelligence drawer | ✅ Complete |
| Alert feed | ✅ Complete |
| Weekly briefs viewer | ✅ Complete |
| Strategic analysis | ✅ Complete |
| Market map | ✅ Complete |
| Competitor onboarding | ✅ Complete |
| Settings page | ✅ Complete |
| Billing page | ⚠️ Shell only — no payment integration |
| Discovery (lemonade) | ⚠️ Experimental — not in main nav |

### Analytics (PostHog)
| Event | Status |
|-------|--------|
| radar_viewed | ✅ Wired |
| competitor_selected | ✅ Wired |
| competitor_detail_opened | ✅ Wired |
| strategy_viewed | ✅ Wired |
| strategy_action_clicked | ✅ Wired |
| brief_viewed | ✅ Wired |
| market_map_viewed | ✅ Wired |
| competitor_position_inspected | ✅ Wired |
| signup | ✅ Wired |
| login_completed | ✅ Wired |
| competitor_added | ✅ Wired |
| competitor_discovered | ✅ Wired |
| alert_viewed | ✅ Wired |

### Email (Resend)
| Email | Status |
|-------|--------|
| Welcome email (HTML) | ✅ Wired |
| Tracking confirmation | ✅ Wired (idempotent) |
| First signal email | ✅ Wired |
| Regular alert email | ✅ Wired |
| Weekly brief email | ✅ Wired |

### Security
| Item | Status |
|------|--------|
| HTTPS / HSTS | ✅ Enforced |
| Security headers | ✅ All 6 headers set |
| Supabase RLS | ✅ Enabled on SaaS tables |
| CRON_SECRET enforcement | ✅ All pipeline routes protected |
| Service role isolation | ✅ Only used where necessary |
| Input validation | ✅ At all API boundaries |

---

## Database State

### Pipeline tables: EMPTY (waiting for seed or first pipeline run)

The test seed migration `005_seed_defence_energy_test.sql` has been written but **not yet executed**.

Current pipeline table counts (expected):
```
competitors         → 0 rows
monitored_pages     → 0 rows
extraction_rules    → 0 rows
snapshots           → 0 rows
page_sections       → 0 rows
section_baselines   → 0 rows
section_diffs       → 0 rows
signals             → 0 rows
interpretations     → 0 rows
strategic_movements → 0 rows
```

### SaaS tables: UNKNOWN (production data not visible from development context)

Expected post-launch state depends on user signups and competitor additions.

---

## Pending Operational Steps

### 1. Run test seed migration (HIGH PRIORITY for testing)
```sql
-- Execute in Supabase SQL Editor (service role)
-- File: migrations/005_seed_defence_energy_test.sql
```
Expected result: 10 competitors, 40 pages, 110 extraction rules

### 2. Trigger first pipeline run (after seed)
```bash
# Stage 1: fetch HTML snapshots
curl -X POST https://metrivant-runtime.vercel.app/api/fetch-snapshots \
  -H "Authorization: Bearer $CRON_SECRET"

# Wait ~30s, then run each subsequent stage in order
```

### 3. Verify Resend domain setup (for production emails)
- Confirm `metrivant.com` is verified in Resend dashboard
- Confirm SPF/DKIM/DMARC DNS records are set
- Test with a real signup to verify welcome email delivery

### 4. Verify PostHog events are arriving
- Check PostHog dashboard for `radar_viewed` events after logging in
- Verify `competitor_selected` fires on blip click

---

## Known Working Behavior

- TypeScript builds cleanly
- Auth flow (login → app → signout) functional
- Radar renders with server-fetched data
- Competitor detail drawer loads on blip click
- Alert mark-as-read functional
- Weekly briefs display if data exists

---

## Not Yet Tested End-to-End

- Full pipeline run (requires seed + cron trigger)
- Email delivery (requires Resend domain configuration)
- Weekly brief generation (requires OpenAI key + signals to analyze)
- Billing/subscription enforcement (billing page is shell only)
