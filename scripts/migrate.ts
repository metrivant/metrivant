#!/usr/bin/env npx tsx
// ── Metrivant migration runner ─────────────────────────────────────────────
//
// Runs SQL migration files against Supabase via a direct Postgres connection.
// Tracks applied migrations in a `schema_migrations` table so each file
// is applied exactly once.
//
// Using direct Postgres (pg driver) instead of the Supabase Management API
// because DDL (CREATE FUNCTION, ALTER TABLE, BEGIN/COMMIT, dollar-quoting)
// requires raw protocol support that the HTTP-based Management API cannot
// reliably provide.
//
// Usage:
//   npx tsx scripts/migrate.ts            # apply all pending
//   npx tsx scripts/migrate.ts --status   # list applied / pending
//   npx tsx scripts/migrate.ts --dry-run  # show SQL without running
//
// Required env var:
//   SUPABASE_DB_URL — Postgres connection string from Supabase project settings
//                     Settings → Database → Connection string → URI
//                     Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
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
import { Client } from "pg";

// ── Config ───────────────────────────────────────────────────────────────────

// Connection config — prefer individual fields (bypasses URI parsing / password-escaping issues).
// Falls back to SUPABASE_DB_URL connection string for local dev convenience.
const DB_HOST     = process.env.SUPABASE_DB_HOST;
const DB_USER     = process.env.SUPABASE_DB_USER;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_URL      = process.env.SUPABASE_DB_URL;

const useFields = !!(DB_HOST && DB_USER && DB_PASSWORD);

if (!useFields && !DB_URL) {
  console.error("✗ No database credentials found.");
  console.error("  Set SUPABASE_DB_HOST + SUPABASE_DB_USER + SUPABASE_DB_PASSWORD");
  console.error("  or SUPABASE_DB_URL (connection string).");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const DIRS: Array<{ namespace: string; dir: string }> = [
  { namespace: "runtime", dir: path.join(ROOT, "migrations") },
  { namespace: "ui",      dir: path.join(ROOT, "radar-ui", "migrations") },
];

// ── Flags ────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const STATUS  = args.includes("--status");
const DRY_RUN = args.includes("--dry-run");

// ── DDL detection — auto-append PostgREST schema cache reload ────────────────
//
// Any migration that contains schema-changing DDL (CREATE/ALTER/DROP TABLE,
// VIEW, FUNCTION, TYPE, INDEX, POLICY) requires PostgREST to reload its schema
// cache to make the changes visible via the HTTP API.
//
// Instead of relying on humans to remember this, the runner detects likely DDL
// and appends NOTIFY pgrst, 'reload schema' automatically.
// Over-triggering is free. Under-triggering causes NODE-C class outages.

const DDL_TOKENS = [
  "create table", "alter table",  "drop table",
  "create view",  "drop view",    "create materialized view",
  "create function", "drop function",
  "create type",  "alter type",   "drop type",
  "create index", "drop index",
  "create policy","alter policy", "drop policy",
  "add column",   "drop column",  "rename column",
];

// Strip SQL line comments (--), block comments (/* */), and single-quoted
// string literals before scanning for DDL tokens. This prevents false matches
// inside comments such as "-- drop table not executed" and quoted identifiers.
function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")              // line comments
    .replace(/\/\*[\s\S]*?\*\//g, " ")      // block comments
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");   // string literals → empty quotes
}

function looksLikeSchemaDDL(sql: string): boolean {
  const normalized = stripCommentsAndStrings(sql).toLowerCase();
  return DDL_TOKENS.some((token) => normalized.includes(token));
}

// ── Migration discovery ───────────────────────────────────────────────────────

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
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const clientConfig = useFields
    ? {
        host:     DB_HOST!,
        port:     5432,
        database: "postgres",
        user:     DB_USER!,
        password: DB_PASSWORD!,
        ssl:      { rejectUnauthorized: false },
        statement_timeout: 120_000,
      }
    : {
        connectionString: DB_URL!,
        ssl:              { rejectUnauthorized: false },
        statement_timeout: 120_000,
      };

  const client = new Client(clientConfig);

  await client.connect();

  try {
    // Extract project ref for display
    const refMatch = (DB_USER ?? DB_URL ?? "").match(/postgres\.([^:@\s]+)/);
    const projectRef = refMatch?.[1] ?? DB_HOST?.split(".")[0] ?? "unknown";
    console.log(`\n  Metrivant migration runner`);
    console.log(`  Project: ${projectRef}\n`);

    // Bootstrap tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         text        PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Load applied migrations
    const { rows: appliedRows } = await client.query<{ id: string }>(
      "SELECT id FROM schema_migrations ORDER BY id;"
    );
    const applied = new Set(appliedRows.map((r) => r.id));

    const all     = discoverMigrations();
    const pending = all.filter((m) => !applied.has(m.id));
    const done    = all.filter((m) =>  applied.has(m.id));

    if (all.length === 0) {
      console.log("  No migration files found.\n");
      return;
    }

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

    let ok     = 0;
    let failed = 0;

    for (const m of pending) {
      const sql = fs.readFileSync(m.filepath, "utf-8");

      if (DRY_RUN) {
        console.log(`  ── ${m.id} (dry-run) ──`);
        console.log(sql.trim().slice(0, 300) + (sql.length > 300 ? "\n  …" : ""));
        console.log();
        continue;
      }

      process.stdout.write(`  Applying ${m.id} … `);

      try {
        // Execute the entire migration file as one query.
        // pg supports multi-statement SQL, DDL, transactions, dollar-quoting.
        //
        // Auto-append PostgREST schema cache reload for any migration that
        // contains schema DDL. Prevents NODE-C class outages where column
        // additions or view changes are invisible to the HTTP API until reload.
        const finalSql = looksLikeSchemaDDL(sql)
          ? `${sql.trimEnd()}\n\nNOTIFY pgrst, 'reload schema';\n`
          : sql;

        await client.query(finalSql);

        // Record in tracking table (safe to re-run — ON CONFLICT DO NOTHING)
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING;",
          [m.id]
        );

        console.log("✓");
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log("✗ FAILED");
        console.error(`    ${msg}`);
        failed++;
        // Continue — partial progress is still useful. Other migrations may succeed.
      }
    }

    console.log();
    if (failed === 0) {
      console.log(`  ✓ ${ok} migration${ok !== 1 ? "s" : ""} applied successfully.\n`);
    } else {
      console.log(`  ${ok} applied, ${failed} failed. Review errors above.\n`);
      process.exit(1);
    }

  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error("✗ Unexpected error:", err);
  process.exit(1);
});
