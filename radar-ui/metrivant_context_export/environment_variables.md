# Metrivant — Environment Variables

## Frontend (radar-ui)

All set in Vercel project settings for the `radar-ui` project. Also documented in `radar-ui/.env.example`.

### Required

| Variable | Description | Notes |
|----------|-------------|-------|
| `RADAR_API_BASE_URL` | Base URL of the backend runtime | e.g. `https://metrivant-runtime.vercel.app` or custom subdomain. **Separate Vercel project from radar-ui.** |
| `CRON_SECRET` | Shared API secret for pipeline auth | Must match backend's `CRON_SECRET`. All cron routes and radar-feed/competitor-detail proxy require this. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public — safe to expose to browser. Format: `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key | Public — safe to expose. RLS enforced. Used for auth and user-scoped queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | **Secret — never expose to browser.** Used by cron routes that need RLS bypass (check-signals, generate-brief, etc.) |
| `OPENAI_API_KEY` | OpenAI API key | Used by `/api/generate-brief` for weekly intelligence brief generation. |
| `RESEND_API_KEY` | Resend API key | Used by all outbound email (welcome, alerts, briefs, tracking confirmation). |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | Public — exposed to browser. Used by PostHog JS SDK (client-side events). |
| `POSTHOG_API_KEY` | PostHog project API key | Server-side only. Used by server API routes for analytics events. Typically the **same value** as `NEXT_PUBLIC_POSTHOG_KEY`. |
| `NEXT_PUBLIC_SITE_URL` | Public site URL | Set to `https://metrivant.com` in production. Used by auth redirects, email links, sitemap. |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `FROM_EMAIL` | Override sender email address | If not set, uses `hello@metrivant.com`, `alerts@metrivant.com`, or `briefs@metrivant.com` per flow. Useful when single Resend domain not configured for subdomains. |

---

## Backend (metrivant-runtime)

All set in Vercel project settings for the `metrivant-runtime` project. Documented in `metrivant/.env.example`.

**Note**: Backend uses different variable names from frontend for Supabase.

| Variable | Description | Notes |
|----------|-------------|-------|
| `SUPABASE_URL` | Supabase project URL | Same value as frontend's `NEXT_PUBLIC_SUPABASE_URL`. Note: **no `NEXT_PUBLIC_` prefix**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Same value as frontend's `SUPABASE_SERVICE_ROLE_KEY`. Backend always uses service role. |
| `OPENAI_API_KEY` | OpenAI API key | Used by `/api/interpret-signals` for signal annotation. |
| `CRON_SECRET` | Shared pipeline secret | **Must be identical to frontend `CRON_SECRET`.** |
| `SENTRY_DSN` | Sentry DSN for error tracking | Optional. If unset, error tracking is disabled. |

---

## Local Development Setup

Copy `.env.example` to `.env.local` in `radar-ui/`:

```bash
cp radar-ui/.env.example radar-ui/.env.local
```

Then fill in:
```env
RADAR_API_BASE_URL=http://localhost:3001
CRON_SECRET=dev-secret-change-in-production
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_API_KEY=phc_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For the backend, in `metrivant/`:
```env
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
CRON_SECRET=dev-secret-change-in-production
SENTRY_DSN=https://...@sentry.io/...
```

---

## Security Notes

- **Never commit** `.env.local` — it is in `.gitignore`
- **`SUPABASE_SERVICE_ROLE_KEY`** bypasses all RLS. Treat as a root credential.
- **`CRON_SECRET`** must be a long random string (32+ chars). Use `openssl rand -hex 32`.
- **`NEXT_PUBLIC_*` vars** are bundled into client JavaScript and visible in browser. Only use for truly non-sensitive values (Supabase URL, anon key, PostHog key are designed to be public).
- **`OPENAI_API_KEY`** and **`RESEND_API_KEY`** are server-side only — they are never exposed to the browser.

---

## Vercel Environment Notes

- Set all variables in the Vercel dashboard under Project → Settings → Environment Variables
- Set for **Production**, **Preview**, and **Development** as appropriate
- `NEXT_PUBLIC_SITE_URL` should be `https://metrivant.com` for Production only; set to your preview URL for Preview environments
- `CRON_SECRET` must be the same value in both Vercel projects
