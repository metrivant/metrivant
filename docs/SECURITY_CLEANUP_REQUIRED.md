# CRITICAL SECURITY CLEANUP REQUIRED

**Status:** Action required before production deployment
**Date identified:** 2026-03-28
**Severity:** CRITICAL

---

## 1. ROTATE CRON_SECRET IMMEDIATELY

The current `CRON_SECRET` value `metrivant-secret-87236487234` is committed to git history and was previously exposed in client-side JavaScript.

### Required actions (in order):

**Step 1:** Generate new secret
```bash
# Generate cryptographically secure random secret
openssl rand -base64 32
```

**Step 2:** Update Vercel environment variables

For **both** projects (`metrivant-runtime` and `metrivant-ui`):
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Update `CRON_SECRET` with new value (all environments: Production, Preview, Development)
3. Save changes
4. Redeploy both projects

**Step 3:** Verify rotation worked
```bash
# Test runtime cron endpoint with new secret
curl -H "Authorization: Bearer YOUR_NEW_SECRET" \
  https://metrivant-runtime.vercel.app/api/health

# Test UI cron endpoint with new secret
curl -H "Authorization: Bearer YOUR_NEW_SECRET" \
  https://metrivant.com/api/check-signals
```

---

## 2. REMOVE COMMITTED .env FILES FROM GIT HISTORY

The files `.env.local` and `.env.vercel.local` contain the old CRON_SECRET and are committed to git history.

### Required actions:

**Option A: Using git-filter-repo (recommended)**

```bash
# Install git-filter-repo (if not already installed)
pip3 install git-filter-repo

# Remove files from all branches and history
git filter-repo --path .env.local --invert-paths --force
git filter-repo --path .env.vercel.local --invert-paths --force
git filter-repo --path radar-ui/.env.local --invert-paths --force

# Force push to remote (WARNING: rewrites history)
git push origin --force --all
git push origin --force --tags
```

**Option B: Using BFG Repo-Cleaner**

```bash
# Install BFG (if not already installed)
brew install bfg  # macOS
# OR download from https://rtyley.github.io/bfg-repo-cleaner/

# Remove files
bfg --delete-files .env.local
bfg --delete-files .env.vercel.local

# Clean up and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

**Step 3:** Update .gitignore

Add to `.gitignore` if not already present:
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local
*.env.local
```

**Step 4:** Notify team members

All team members must re-clone the repository after history rewrite:
```bash
git clone https://github.com/yourusername/metrivant.git metrivant-clean
cd metrivant-clean
```

---

## 3. VERIFY NO OTHER SECRETS IN GIT HISTORY

Run a secrets scan to ensure no other credentials are committed:

```bash
# Using trufflehog
docker run --rm -it -v "$PWD:/pwd" trufflesecurity/trufflehog:latest \
  github --repo https://github.com/yourusername/metrivant

# Using gitleaks
gitleaks detect --source . --verbose
```

---

## 4. VERIFICATION CHECKLIST

After completing steps 1-3, verify:

- [ ] New CRON_SECRET deployed to both Vercel projects
- [ ] Old CRON_SECRET no longer works (test with curl)
- [ ] `.env.local` and `.env.vercel.local` removed from git history
- [ ] `.gitignore` updated to prevent future commits
- [ ] Team members notified of history rewrite
- [ ] Secrets scan shows no credentials in history
- [ ] Ops page system tests work with new auth proxy (`/api/system-tests-proxy`)
- [ ] No `window.__CRON_SECRET` references in browser DevTools

---

## 5. ADDITIONAL SECURITY IMPROVEMENTS IMPLEMENTED

The following security enhancements have been deployed:

### Client-side secret elimination
- ✅ Removed `window.__CRON_SECRET` injection from `radar-ui/app/app/ops/page.tsx`
- ✅ Created server-side auth proxy at `/api/system-tests-proxy`
- ✅ Updated `SystemTests.tsx` to use authenticated proxy instead of exposed secret

### Sentry data sanitization
- ✅ Created `lib/sentry-sanitizer.ts` (runtime)
- ✅ Created `radar-ui/lib/sentry-sanitizer.ts` (UI)
- ✅ Applied `beforeSend` hook to all Sentry configs (client, server, edge, runtime)
- ✅ Strips API keys, tokens, credentials from all error reports before transmission

Patterns sanitized:
- `api_key=...`, `apikey=...`, `token=...`
- `Bearer` tokens in Authorization headers
- OpenAI API keys (`sk-...`)
- ScrapingBee API keys
- CRON_SECRET references
- All fields named `password`, `secret`, `api_key`, `apikey`, `token`

### Content Security Policy
- ✅ CSP headers already implemented in `next.config.ts`
- ✅ Restricts script sources to self + PostHog + Sentry
- ✅ Blocks inline scripts except where explicitly needed
- ✅ `frame-ancestors 'none'` prevents clickjacking

---

## 6. REMAINING SECURITY RECOMMENDATIONS

### High Priority (consider for next sprint)

**Distributed rate limiting**
- Current rate limiting is per-function-instance (in-memory)
- No protection against distributed attacks
- Recommendation: Add Vercel Edge Config or Upstash Redis for global rate limits

**RLS defense-in-depth**
- Only 3 tables have RLS enabled (interpretations, signal_feedback, sector_baselines)
- Most tables rely on service-role-only access
- Recommendation: Enable RLS on all tables as defense-in-depth

### Medium Priority

**Plan limit race conditions**
- Concurrent requests can exceed plan limits (10 for Analyst, 25 for Pro)
- Recommendation: Use database constraints + triggers for atomic enforcement

**API key rotation strategy**
- OpenAI, ScrapingBee, Stripe keys are long-lived
- Recommendation: Implement 90-day rotation policy

### Low Priority (acceptable risk)

**In-app billing preview**
- Signup timing check prevents abuse (10-minute window)
- No additional rate limiting needed

**Sentry DSN public**
- Intentionally public (designed for client-side use)
- No action needed

---

## 7. COMPLIANCE NOTES

### SOC 2 / ISO 27001 Alignment

The following security controls are now implemented:

- **Access Control (AC-3):** Server-side authentication proxy, no client-side secrets
- **Audit and Accountability (AU-2):** Sentry observability with sanitized logs
- **System and Communications Protection (SC-8):** HSTS, CSP headers enforced
- **Incident Response (IR-4):** Sentry alerting for security events

---

## OWNER

Engineering lead must complete steps 1-3 before production launch.

**Estimated time:** 30 minutes
**Risk if skipped:** CRITICAL — exposed secrets enable unauthorized pipeline access

---

**END OF DOCUMENT**
