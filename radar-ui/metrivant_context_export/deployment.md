# Metrivant — Deployment

## Overview

Metrivant consists of two Vercel deployments backed by one Supabase project.

```
GitHub (source)
    ↓ auto-deploy on push to main
    ├── Vercel: radar-ui → metrivant.com
    └── Vercel: metrivant-runtime → metrivant-runtime.vercel.app
                    ↕ both read/write
              Supabase (PostgreSQL)
```

---

## Deploying Frontend (radar-ui)

### One-time setup
1. Connect `radar-ui/` directory to a Vercel project
2. Set framework preset: **Next.js**
3. Set root directory: `radar-ui` (if deploying from monorepo root)
4. Set all environment variables (see `environment_variables.md`)
5. Connect custom domain `metrivant.com` in Vercel dashboard

### Ongoing deploys
Push to `main` branch → Vercel auto-deploys.

### Build command
```
next build
```

### Output
`.next` directory. Vercel handles serving automatically.

### Cron jobs
Configured in `radar-ui/vercel.json`. Vercel Pro required for cron.

```json
[
  { "path": "/api/generate-brief",      "schedule": "0 8 * * 1"   },
  { "path": "/api/check-signals",       "schedule": "0 * * * *"   },
  { "path": "/api/update-momentum",     "schedule": "0 */6 * * *"  },
  { "path": "/api/strategic-analysis",  "schedule": "0 8 * * *"   },
  { "path": "/api/update-positioning",  "schedule": "0 9 * * *"   }
]
```

---

## Deploying Backend (metrivant-runtime)

### One-time setup
1. Connect `metrivant/` directory (the parent directory) to a separate Vercel project
2. Set framework: **Other** or **Node.js**
3. Set all environment variables (see `environment_variables.md`)
4. Note the deployment URL — set this as `RADAR_API_BASE_URL` in the frontend project

### Ongoing deploys
Push to `main` → auto-deploys.

### Cron jobs
Configured in `metrivant/vercel.json`:

```json
[
  { "path": "/api/fetch-snapshots",        "schedule": "0 */6 * * *"  },
  { "path": "/api/extract-sections",       "schedule": "10 */6 * * *" },
  { "path": "/api/build-baselines",        "schedule": "15 */6 * * *" },
  { "path": "/api/detect-diffs",           "schedule": "20 */6 * * *" },
  { "path": "/api/detect-signals",         "schedule": "25 */6 * * *" },
  { "path": "/api/interpret-signals",      "schedule": "30 */6 * * *" },
  { "path": "/api/update-signal-velocity", "schedule": "35 */6 * * *" },
  { "path": "/api/detect-movements",       "schedule": "40 */6 * * *" },
  { "path": "/api/generate-brief",         "schedule": "0 9 * * 1"   }
]
```

---

## Database Setup (Supabase)

### One-time setup
1. Create a Supabase project
2. Note the project URL and keys (from Project Settings → API)
3. Run all migrations in order (Supabase SQL Editor, service role):
   - Backend migrations (in `metrivant/migrations/`):
     - `001_patterns.sql`
     - `002_strategic_movements_dedup.sql`
     - `003_interpretations_prompt_version.sql`
     - `004_section_diffs_dedup.sql`
   - UI/SaaS migrations (in `radar-ui/migrations/`):
     - Run in numerical order (001 through 007)
4. Create the `radar_feed` Supabase VIEW (see architecture docs)
5. Enable RLS on all SaaS tables
6. Configure Supabase Auth:
   - Enable email/password
   - Set site URL to `https://metrivant.com`
   - Set redirect URL to `https://metrivant.com/api/auth/callback`

### Running test seed
After setting up Supabase, run the test dataset:
```sql
-- In Supabase SQL Editor (service role)
-- Copy contents of migrations/005_seed_defence_energy_test.sql and run
```

---

## DNS Configuration

### metrivant.com → radar-ui Vercel project
In DNS provider:
```
Type: A      Name: @    Value: 76.76.21.21    (Vercel IP)
Type: CNAME  Name: www  Value: cname.vercel-dns.com
```

### Email subdomain SPF/DKIM/DMARC (for Resend)
Add records provided by Resend dashboard after adding `metrivant.com` as verified domain:
```
Type: TXT   Name: @              Value: v=spf1 include:amazonses.com ~all
Type: TXT   Name: resend._domainkey  Value: <Resend DKIM key>
Type: TXT   Name: _dmarc         Value: v=DMARC1; p=none; rua=mailto:dmarc@metrivant.com
```

---

## First Pipeline Run Sequence

After deploying both projects and running migrations:

1. **Add competitors** — Log in at metrivant.com, go to `/app/onboarding`, add at least one competitor URL
   - OR run the test seed migration for 10 pre-configured competitors

2. **Trigger pipeline manually** (optional, don't wait 6h for first run):
   ```bash
   # Call each pipeline stage in order (requires CRON_SECRET)
   curl -X POST https://metrivant-runtime.vercel.app/api/fetch-snapshots \
     -H "Authorization: Bearer $CRON_SECRET"

   # Wait 30 seconds, then:
   curl -X POST https://metrivant-runtime.vercel.app/api/extract-sections \
     -H "Authorization: Bearer $CRON_SECRET"

   # Continue through remaining stages...
   ```

3. **Check Supabase** — Verify rows in `snapshots`, `page_sections`, etc.

4. **Check radar UI** — Competitors should appear on radar (with `signals_7d=0` until signals are generated)

5. **Wait for signals** — After 2+ pipeline runs, baselines are established and diffs can be detected

---

## Health Monitoring

### Vercel Function Logs
- Dashboard → radar-ui project → Functions tab → view cron execution logs

### Sentry
- All pipeline handler errors captured automatically
- Frontend errors captured if Sentry SDK is initialized in radar-ui

### Supabase Monitoring
Use the queries from `docs/OPERATIONS.md`:

```sql
-- Check if snapshots are being fetched
SELECT MAX(fetched_at) FROM snapshots;

-- Check signal pipeline activity
SELECT COUNT(*) FROM signals WHERE detected_at > NOW() - INTERVAL '7 days';

-- Check interpretation backlog
SELECT COUNT(*) FROM signals WHERE status = 'pending';

-- Stuck jobs
SELECT id FROM signals
WHERE status = 'interpreting'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

---

## Rollback Procedure

### Frontend code rollback
In Vercel dashboard: Deployments → find previous deployment → "Promote to Production"

### Database rollback
- Supabase Pro includes daily backups
- For migration rollback: write a compensating migration (down migration)
- For test seed rollback: re-run `005_seed_defence_energy_test.sql` (it always truncates first)

### Pipeline stuck recovery
```sql
-- Reset stuck signals
UPDATE signals SET status = 'pending' WHERE status = 'interpreting'
AND updated_at < NOW() - INTERVAL '30 minutes';

-- Re-run extraction on a specific snapshot
UPDATE snapshots SET sections_extracted = false WHERE id = 'SNAPSHOT_ID';
```
