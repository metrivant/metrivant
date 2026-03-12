#!/usr/bin/env npx tsx
// ── Metrivant migration runner ─────────────────────────────────────────────
//
// Runs SQL migration files against Supabase via the Management API.
// Tracks applied migrations in a `schema_migrations` table so each file
// is applied exactly once.
//
// Usage:
//   npx tsx scripts/migrate.ts            # apply all pending
//   npx tsx scripts/migrate.ts --status   # list applied / pending
//   npx tsx scripts/migrate.ts --dry-run  # show SQL without running
//
// Required env var:
//   SUPABASE_URL          — e.g. https://abcxyz.supabase.co
//   SUPABASE_ACCESS_TOKEN — personal access token from supabase.com/dashboard/account/tokens
//   (SUPABASE_SERVICE_ROLE_KEY is not sufficient for DDL via management API)
//
// Migration files:
//   migrations/*.sql          → tracked as "runtime:001_..."
//   radar-ui/migrations/*.sql → tracked as "ui:001_..."
//
// Files are applied in namespace-then-filename order:
//   runtime:001_... runtime:002_... ... ui:001_... ui:002_... ...
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL) {
  console.error("✗ SUPABASE_URL is not set");
  process.exit(1);
}
if (!SUPABASE_ACCESS_TOKEN) {
  console.error("✗ SUPABASE_ACCESS_TOKEN is not set");
  console.error("  Generate one at: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const MGMT_BASE  = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const ROOT    = path.resolve(__dirname, "..");
const DIRS: Array<{ namespace: string; dir: string }> = [
  { namespace: "runtime", dir: path.join(ROOT, "migrations") },
  { namespace: "ui",      dir: path.join(ROOT, "radar-ui", "migrations") },
];

// ── Flags ────────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const STATUS  = args.includes("--status");
const DRY_RUN = args.includes("--dry-run");

// ── Management API helper ─────────────────────────────────────────────────────

async function runSQL(sql: string): Promise<{ error?: string }> {
  const res = await fetch(MGMT_BASE, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) return {};

  let detail = "";
  try {
    const body = await res.json() as { message?: string; error?: string };
    detail = body.message ?? body.error ?? res.statusText;
  } catch {
    detail = res.statusText;
  }
  return { error: detail };
}

// ── Bootstrap tracking table ──────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const { error } = await runSQL(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  if (error) {
    console.error("✗ Failed to bootstrap schema_migrations:", error);
    process.exit(1);
  }
}

// ── Load applied migrations ───────────────────────────────────────────────────

async function loadApplied(): Promise<Set<string>> {
  // Use REST API to read the tracking table (service role key not needed —
  // schema_migrations has no RLS; management API can read it directly).
  const res = await fetch(MGMT_BASE, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT id FROM schema_migrations ORDER BY id;" }),
  });

  if (!res.ok) return new Set();

  const rows = await res.json() as Array<{ id: string }>;
  return new Set(Array.isArray(rows) ? rows.map((r) => r.id) : []);
}

// ── Discover migration files ──────────────────────────────────────────────────

type Migration = { id: string; namespace: string; filename: string; filepath: string };

function discoverMigrations(): Migration[] {
  const result: Migration[] = [];
  for (const { namespace, dir } of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const filename of files) {
      result.push({
        id:        `${namespace}:${filename}`,
        namespace,
        filename,
        filepath:  path.join(dir, filename),
      });
    }
  }
  // Sort: runtime first, then ui, each alphabetically (already done above)
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n  Metrivant migration runner`);
  console.log(`  Project: ${projectRef}\n`);

  const all = discoverMigrations();
  if (all.length === 0) {
    console.log("  No migration files found.");
    return;
  }

  await bootstrap();
  const applied = await loadApplied();

  const pending  = all.filter((m) => !applied.has(m.id));
  const done     = all.filter((m) =>  applied.has(m.id));

  if (STATUS) {
    console.log("  Applied:");
    for (const m of done)    console.log(`    ✓  ${m.id}`);
    console.log("\n  Pending:");
    for (const m of pending) console.log(`    ·  ${m.id}`);
    console.log();
    return;
  }

  if (pending.length === 0) {
    console.log("  All migrations applied. Nothing to do.\n");
    return;
  }

  console.log(`  ${done.length} applied, ${pending.length} pending\n`);

  let ok = 0;
  let failed = 0;

  for (const m of pending) {
    const sql = fs.readFileSync(m.filepath, "utf-8");

    if (DRY_RUN) {
      console.log(`  ── ${m.id} (dry-run) ──`);
      console.log(sql.trim().slice(0, 200) + (sql.length > 200 ? "\n  …" : ""));
      console.log();
      continue;
    }

    process.stdout.write(`  Applying ${m.id} … `);

    const { error } = await runSQL(sql);
    if (error) {
      console.log("✗ FAILED");
      console.error(`    ${error}`);
      failed++;
      // Continue with next migration — partial progress is still useful.
      continue;
    }

    // Record in tracking table.
    await runSQL(
      `INSERT INTO schema_migrations (id) VALUES ('${m.id.replace(/'/g, "''")}') ON CONFLICT DO NOTHING;`
    );

    console.log("✓");
    ok++;
  }

  console.log();
  if (failed === 0) {
    console.log(`  ✓ ${ok} migration${ok !== 1 ? "s" : ""} applied successfully.\n`);
  } else {
    console.log(`  ${ok} applied, ${failed} failed. Check errors above.\n`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("✗ Unexpected error:", err);
  process.exit(1);
});
