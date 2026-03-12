# Metrivant — Security Model

## Overview

Security is layered across four boundaries:

1. **Transport** — HTTPS + security headers on all responses
2. **Authentication** — Supabase Auth for user sessions
3. **Authorization** — Row Level Security (RLS) for data isolation + CRON_SECRET for pipeline
4. **Service role isolation** — RLS bypass restricted to specific server-side routes

---

## 1. Transport Security

### HTTPS
All traffic goes via Vercel's TLS termination. HSTS is enforced with a 2-year max-age, includeSubDomains, and preload.

### Security Headers (next.config.ts)

Applied globally to all routes via `async headers()`:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
X-DNS-Prefetch-Control: on
```

**What each does:**
- **HSTS**: forces HTTPS for 2 years, no downgrade attacks possible
- **X-Frame-Options: DENY**: prevents clickjacking (app cannot be embedded in iframes)
- **X-Content-Type-Options: nosniff**: prevents MIME type confusion attacks
- **Referrer-Policy**: only sends origin on cross-origin requests, no full URL leakage
- **Permissions-Policy**: disables camera, microphone, geolocation, tracking APIs

---

## 2. Authentication (Supabase Auth)

### Mechanism
Email/password via Supabase Auth. Sessions stored in HttpOnly cookies via `@supabase/ssr`.

### Session Verification
All protected routes under `/app/*` are guarded by `app/app/layout.tsx`:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

`getUser()` makes a server-side call to verify the JWT — it does **not** just decode the cookie. This prevents session token forgery.

### Cookie Management
`lib/supabase/server.ts` uses `@supabase/ssr`'s `createServerClient` with the Next.js `cookies()` store:
- Reads all cookies for session reconstruction
- Writes refreshed tokens back (transparent refresh)
- `setAll` errors in Server Components are silently ignored (expected behavior)

### PostHog Identity
After verified login, `PostHogIdentify` calls `posthog.identify(userId, { email })` to link the anonymous analytics session to the real user. On signout, `posthog.reset()` discards the identity.

---

## 3. Authorization

### Row Level Security (Supabase RLS)

RLS is enabled on all SaaS tables. Users only see data for their own organization:

**Pattern (typical RLS policy):**
```sql
-- Users can only read their own org's alerts
CREATE POLICY "org_isolation" ON alerts
  FOR ALL USING (
    org_id = (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );
```

Tables with RLS:
- `organizations`
- `tracked_competitors`
- `alerts`
- `momentum`
- `weekly_briefs`
- `strategic_insights`
- `competitor_positioning`

### Pipeline Tables and RLS

Pipeline tables (`competitors`, `monitored_pages`, `snapshots`, etc.) are **not** user-owned — they are system-managed. RLS is not applicable to them in the same way; access is controlled by which client is used:
- Anon key → cannot access pipeline tables (no RLS policy grants access)
- Service role → bypasses all RLS

### CRON_SECRET

All pipeline handlers and cron-triggered frontend routes require:
```
Authorization: Bearer {CRON_SECRET}
```

**Frontend routes protected by CRON_SECRET:**
- `/api/check-signals`
- `/api/generate-brief`
- `/api/update-momentum`
- `/api/strategic-analysis`
- `/api/update-positioning`

**Backend routes protected by CRON_SECRET:**
- All `/api/fetch-snapshots`, `/api/extract-sections`, etc.
- `/api/radar-feed`
- `/api/competitor-detail`

Vercel injects the secret automatically when crons fire. External calls require the header manually.

---

## 4. Service Role Isolation

`lib/supabase/service.ts` creates a service-role client that bypasses RLS entirely. This is intentionally restricted to a small set of use cases:

| Route | Reason for Service Role |
|-------|------------------------|
| `check-signals` | Needs to read all orgs and write alerts across org boundaries |
| `generate-brief` | Needs to write brief to all users |
| `update-momentum` | Needs to write momentum for all orgs |
| `strategic-analysis` | Cross-org pattern detection |
| `update-positioning` | Cross-org market map update |

**Never used on client-facing routes** (`alerts/route.ts`, `onboard-competitor`, etc.) — those use the user's own session via `createClient()`.

---

## 5. API Route Protections Summary

| Route | Auth Method | Notes |
|-------|-------------|-------|
| `/api/auth/callback` | Supabase callback URL | Exchange code for session |
| `/api/auth/signout` | Supabase session | Clears cookies |
| `/api/competitor-detail` | CRON_SECRET | Proxy to backend |
| `/api/check-signals` | CRON_SECRET | Cron + service role |
| `/api/generate-brief` | CRON_SECRET | Cron + service role |
| `/api/update-momentum` | CRON_SECRET | Cron + service role |
| `/api/strategic-analysis` | CRON_SECRET | Cron + service role |
| `/api/update-positioning` | CRON_SECRET | Cron + service role |
| `/api/events/signup` | None (public) | Rate limited by Vercel |
| `/api/onboard-competitor` | Supabase session | Creates org if needed |
| `/api/discover/track` | Supabase session | Adds tracked competitor |
| `/api/alerts` | Supabase session (RLS) | User's org alerts only |
| `/api/alerts/read` | Supabase session (RLS) | Marks user's alerts read |
| `/api/momentum/history` | Supabase session (RLS) | User's momentum data |

---

## 6. Secrets Inventory

| Secret | Location | Notes |
|--------|----------|-------|
| `CRON_SECRET` | Both projects | Must be identical in frontend and backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Both projects | Never exposed to browser |
| `OPENAI_API_KEY` | Both projects | Server-side only |
| `RESEND_API_KEY` | Frontend only | Server-side only |
| `POSTHOG_API_KEY` | Frontend only | Server-side only (different from public key) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Frontend only | Exposed to browser (PostHog JS SDK) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend only | Safe to expose (no auth capability) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend only | Safe to expose (RLS enforced) |
| `SENTRY_DSN` | Backend only | Non-secret, but kept in env |

**Never commit secrets.** `.env.local` is gitignored. `.env.example` contains only keys with empty values.

---

## 7. Input Validation

- All user inputs validated at API boundaries (email format, required fields)
- Request bodies parsed with `.catch(() => ({}))` to avoid crashes on malformed JSON
- Supabase parameterized queries prevent SQL injection
- No `eval()`, no dynamic code execution
- TypeScript strict mode prevents type coercion surprises
