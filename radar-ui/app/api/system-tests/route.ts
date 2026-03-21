// ── /api/system-tests ─────────────────────────────────────────────────────────
// Comprehensive system test suite for Metrivant.
// Runs all tests against live DB + runtime API. Requires CRON_SECRET auth.
// Returns structured test results grouped by section.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";

export const maxDuration = 30;

// ── Types ────────────────────────────────────────────────────────────────────

type TestResult = {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  ms: number;
};

type TestSection = {
  section: string;
  tests: TestResult[];
};

// ── Auth ─────────────────────────────────────────────────────────────────────

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function runTest(
  name: string,
  fn: () => Promise<{ status: "pass" | "fail" | "warn" | "skip"; detail: string }>
): Promise<TestResult> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { name, ...result, ms: Date.now() - t0 };
  } catch (err) {
    return {
      name,
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = ReturnType<typeof createServiceClient> extends infer T ? T : any;

async function tableCount(service: SB, table: string, filters?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (service as any).from(table).select("*", { count: "exact", head: true });
  if (filters) q = filters(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

// ── Test Sections ────────────────────────────────────────────────────────────

async function databaseTests(service: SB): Promise<TestSection> {
  const CORE_TABLES = [
    "competitors", "monitored_pages", "snapshots", "page_sections",
    "section_baselines", "section_diffs", "signals", "interpretations",
    "strategic_movements", "activity_events", "pipeline_events",
  ];
  const POOL_TABLES = [
    "pool_events", "competitor_feeds", "competitor_suggestions",
  ];
  const AI_TABLES = [
    "radar_narratives", "sector_intelligence", "weekly_briefs",
    "selector_repair_suggestions", "noise_suppression_rules",
    "confidence_calibration",
  ];
  const INFRA_TABLES = [
    "organizations", "tracked_competitors", "cron_heartbeats",
    "signal_feedback", "radar_positions",
  ];

  const allTables = [...CORE_TABLES, ...POOL_TABLES, ...AI_TABLES, ...INFRA_TABLES];
  const tests: TestResult[] = [];

  // Test: DB connectivity
  tests.push(await runTest("DB connectivity", async () => {
    const count = await tableCount(service, "organizations");
    return { status: "pass", detail: `${count} organization(s)` };
  }));

  // Test: core tables exist and have data
  for (const table of allTables) {
    tests.push(await runTest(`Table: ${table}`, async () => {
      try {
        const count = await tableCount(service, table);
        if (CORE_TABLES.includes(table) && count === 0) {
          return { status: "warn", detail: "exists but empty" };
        }
        return { status: "pass", detail: `${count} rows` };
      } catch {
        return { status: "fail", detail: "table missing or inaccessible" };
      }
    }));
  }

  return { section: "Database", tests };
}

async function pipelineTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ago2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const CORE_STAGES = [
    "fetch-snapshots", "extract-sections", "build-baselines",
    "detect-diffs", "detect-signals", "interpret-signals",
  ];

  // Test: pipeline_events exist in last 24h
  tests.push(await runTest("Pipeline events (24h)", async () => {
    const count = await tableCount(service, "pipeline_events", (q: any) => q.gte("created_at", ago24h)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "fail", detail: "no pipeline events in 24h" };
    return { status: "pass", detail: `${count} events` };
  }));

  // Test: each core stage ran recently
  for (const stage of CORE_STAGES) {
    tests.push(await runTest(`Stage: ${stage}`, async () => {
      const count = await tableCount(service, "pipeline_events", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        q.eq("stage", stage).gte("created_at", ago24h)
      );
      if (count === 0) return { status: "warn", detail: "no events in 24h" };
      return { status: "pass", detail: `${count} events (24h)` };
    }));
  }

  // Test: no pipeline errors in last 2h
  tests.push(await runTest("Pipeline errors (2h)", async () => {
    const count = await tableCount(service, "pipeline_events", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("status", "error").gte("created_at", ago2h)
    );
    if (count > 5) return { status: "fail", detail: `${count} errors in 2h` };
    if (count > 0) return { status: "warn", detail: `${count} errors in 2h` };
    return { status: "pass", detail: "no errors" };
  }));

  // Test: no stuck signals
  tests.push(await runTest("Stuck signals (>4h pending)", async () => {
    const stuckBefore = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const count = await tableCount(service, "signals", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("status", "pending").lt("detected_at", stuckBefore)
    );
    if (count > 0) return { status: "fail", detail: `${count} stuck` };
    return { status: "pass", detail: "none stuck" };
  }));

  // Test: snapshots flowing
  tests.push(await runTest("Recent snapshots (24h)", async () => {
    const count = await tableCount(service, "snapshots", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.gte("fetched_at", ago24h)
    );
    if (count === 0) return { status: "fail", detail: "no snapshots in 24h" };
    if (count < 10) return { status: "warn", detail: `only ${count}` };
    return { status: "pass", detail: `${count} snapshots` };
  }));

  return { section: "Pipeline Health", tests };
}

async function signalTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Test: signals exist in 7d
  tests.push(await runTest("Signals (7d)", async () => {
    const count = await tableCount(service, "signals", (q: any) => q.gte("detected_at", ago7d)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "warn", detail: "no signals in 7d" };
    return { status: "pass", detail: `${count} signals` };
  }));

  // Test: interpreted signals
  tests.push(await runTest("Interpreted signals (7d)", async () => {
    const count = await tableCount(service, "signals", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("status", "interpreted").gte("detected_at", ago7d)
    );
    return { status: count > 0 ? "pass" : "warn", detail: `${count} interpreted` };
  }));

  // Test: failed signals
  tests.push(await runTest("Failed signals", async () => {
    const count = await tableCount(service, "signals", (q: any) => q.eq("status", "failed")); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count > 10) return { status: "fail", detail: `${count} failed` };
    if (count > 0) return { status: "warn", detail: `${count} failed` };
    return { status: "pass", detail: "none failed" };
  }));

  // Test: pending_review backlog
  tests.push(await runTest("Pending review backlog", async () => {
    const count = await tableCount(service, "signals", (q: any) => q.eq("status", "pending_review")); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count > 100) return { status: "warn", detail: `${count} held — check pressure gates` };
    return { status: "pass", detail: `${count} in review` };
  }));

  // Test: confidence distribution (sample)
  tests.push(await runTest("Confidence distribution", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (service as any)
      .from("signals")
      .select("confidence_score")
      .gte("detected_at", ago7d)
      .not("confidence_score", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { confidence_score: number }[];
    if (rows.length === 0) return { status: "warn", detail: "no scored signals" };
    const avg = rows.reduce((s, r) => s + r.confidence_score, 0) / rows.length;
    const high = rows.filter(r => r.confidence_score >= 0.65).length;
    return { status: "pass", detail: `avg ${avg.toFixed(2)} · ${high} high-conf (≥0.65)` };
  }));

  return { section: "Signal Quality", tests };
}

async function cronTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];

  const HOURLY_CRONS = [
    // core pipeline
    "fetch-snapshots", "extract-sections", "build-baselines", "detect-diffs",
    "detect-signals", "interpret-signals", "detect-ambient-activity",
    "update-pressure-index", "update-signal-velocity", "detect-movements",
    "synthesize-movement-narratives", "generate-radar-narratives",
    "attribute-pool-contexts",
    // pool ingest
    "ingest-feeds", "ingest-careers", "ingest-investor-feeds",
    "ingest-product-feeds", "ingest-procurement-feeds", "ingest-regulatory-feeds",
    "ingest-media-feeds",
    // pool promote
    "promote-feed-signals", "promote-careers-signals", "promote-investor-signals",
    "promote-product-signals", "promote-procurement-signals", "promote-regulatory-signals",
    "promote-media-signals",
    // validation + recovery
    "validate-interpretations", "validate-movements", "retry-failed-stages",
    "watchdog",
  ];

  const DAILY_CRONS = [
    "promote-baselines", "retention", "suggest-selector-repairs",
    "heal-coverage", "resolve-coverage", "detect-stale-competitors",
    "reconcile-pool-events", "detect-pool-sequences",
  ];

  const WEEKLY_CRONS = [
    "generate-sector-intelligence", "expand-coverage", "calibrate-weights",
    "backfill-feeds", "check-feed-health", "repair-feeds",
    "learn-noise-patterns", "suggest-competitors",
  ];

  const UI_CRONS = [
    "/api/check-signals", "/api/update-momentum",
    "/api/strategic-analysis", "/api/update-positioning",
    "/api/generate-actions",
  ];

  // Test: cron_heartbeats table has data
  tests.push(await runTest("Cron heartbeats populated", async () => {
    const count = await tableCount(service, "cron_heartbeats");
    if (count === 0) return { status: "fail", detail: "no heartbeats — crons may not have run" };
    return { status: "pass", detail: `${count} routes tracked` };
  }));

  // Test: each hourly cron has a heartbeat and isn't stale (>90min)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: heartbeats } = await (service as any)
    .from("cron_heartbeats")
    .select("route, last_run_at, status");
  const hbMap = new Map<string, { last_run_at: string; status: string }>();
  for (const h of (heartbeats ?? []) as { route: string; last_run_at: string; status: string }[]) {
    hbMap.set(h.route, h);
  }

  const cronGroups: { crons: string[]; threshold: number }[] = [
    { crons: HOURLY_CRONS, threshold: 90 },
    { crons: UI_CRONS, threshold: 90 },
    { crons: DAILY_CRONS, threshold: 1500 },
    { crons: WEEKLY_CRONS, threshold: 10_080 },
  ];

  for (const group of cronGroups) {
    for (const cron of group.crons) {
      tests.push(await runTest(`Cron: ${cron}`, async () => {
        const hb = hbMap.get(cron);
        if (!hb) return { status: "warn", detail: "no heartbeat found" };
        const ageMin = Math.floor((Date.now() - new Date(hb.last_run_at).getTime()) / 60_000);
        if (hb.status === "error") return { status: "warn", detail: `last run errored · ${ageMin}m ago` };
        if (ageMin > group.threshold * 2) return { status: "fail", detail: `stale · ${ageMin}m ago` };
        if (ageMin > group.threshold) return { status: "warn", detail: `overdue · ${ageMin}m ago` };
        return { status: "pass", detail: `${ageMin}m ago` };
      }));
    }
  }

  return { section: "Cron Execution", tests };
}

async function poolTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Test: competitor_feeds configured
  tests.push(await runTest("Competitor feeds configured", async () => {
    const total = await tableCount(service, "competitor_feeds");
    const active = await tableCount(service, "competitor_feeds", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.not("feed_url", "is", null)
    );
    if (total === 0) return { status: "warn", detail: "no feeds configured" };
    return { status: "pass", detail: `${active} active / ${total} total` };
  }));

  // Test: pool_events flowing (24h)
  tests.push(await runTest("Pool events (24h)", async () => {
    const count = await tableCount(service, "pool_events", (q: any) => q.gte("created_at", ago24h)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "warn", detail: "no pool events in 24h" };
    return { status: "pass", detail: `${count} events` };
  }));

  // Test: pool events by source type
  tests.push(await runTest("Pool source diversity", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pool_events")
      .select("source_type")
      .gte("created_at", ago24h)
      .limit(500);
    const types = new Set((data ?? []).map((r: { source_type: string }) => r.source_type));
    if (types.size === 0) return { status: "warn", detail: "no sources active" };
    return { status: "pass", detail: `${types.size} source types: ${[...types].join(", ")}` };
  }));

  // Test: cross-pool dedup working
  tests.push(await runTest("Cross-pool dedup (24h)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pipeline_events")
      .select("metadata")
      .gte("created_at", ago24h)
      .eq("status", "skipped")
      .limit(200);
    let dedups = 0;
    for (const r of (data ?? []) as { metadata: Record<string, unknown> | null }[]) {
      if ((r.metadata?.reason as string)?.startsWith("cross_pool_dedup")) dedups++;
    }
    return { status: "pass", detail: `${dedups} deduplicated` };
  }));

  return { section: "Pool System", tests };
}

async function coverageTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];

  // Test: monitored pages health
  tests.push(await runTest("Monitored pages active", async () => {
    const active = await tableCount(service, "monitored_pages", (q: any) => q.eq("active", true)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (active === 0) return { status: "fail", detail: "no active pages" };
    return { status: "pass", detail: `${active} active` };
  }));

  // Test: broken pages
  tests.push(await runTest("Broken pages (blocked/unresolved)", async () => {
    const count = await tableCount(service, "monitored_pages", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.in("health_state", ["blocked", "unresolved"])
    );
    if (count > 10) return { status: "fail", detail: `${count} broken` };
    if (count > 0) return { status: "warn", detail: `${count} broken` };
    return { status: "pass", detail: "none broken" };
  }));

  // Test: challenge pages
  tests.push(await runTest("Challenge pages", async () => {
    const count = await tableCount(service, "monitored_pages", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("health_state", "challenge")
    );
    if (count > 20) return { status: "warn", detail: `${count} pages behind anti-bot walls` };
    return { status: "pass", detail: `${count} challenge pages` };
  }));

  // Test: stale fetches (active pages not fetched in 24h)
  tests.push(await runTest("Stale page fetches (>24h)", async () => {
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = await tableCount(service, "monitored_pages", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("active", true).lt("last_fetched_at", staleCutoff)
    );
    if (count >= 5) return { status: "fail", detail: `${count} stale` };
    if (count > 0) return { status: "warn", detail: `${count} stale` };
    return { status: "pass", detail: "all fresh" };
  }));

  // Test: selector repair suggestions
  tests.push(await runTest("Pending selector repairs", async () => {
    const count = await tableCount(service, "selector_repair_suggestions", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("status", "pending")
    );
    return { status: "pass", detail: `${count} pending` };
  }));

  return { section: "Coverage Health", tests };
}

async function aiLayerTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Test: interpretations
  tests.push(await runTest("Interpretations (7d)", async () => {
    const count = await tableCount(service, "interpretations", (q: any) => q.gte("created_at", ago7d)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "warn", detail: "no interpretations in 7d" };
    return { status: "pass", detail: `${count} interpretations` };
  }));

  // Test: strategic movements
  tests.push(await runTest("Strategic movements (7d)", async () => {
    const count = await tableCount(service, "strategic_movements", (q: any) => q.gte("created_at", ago7d)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "warn", detail: "no movements in 7d" };
    return { status: "pass", detail: `${count} movements` };
  }));

  // Test: movement narratives
  tests.push(await runTest("Movement narratives populated", async () => {
    const count = await tableCount(service, "strategic_movements", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.not("movement_summary", "is", null).gte("created_at", ago7d)
    );
    return { status: count > 0 ? "pass" : "warn", detail: `${count} with narratives` };
  }));

  // Test: radar narratives
  tests.push(await runTest("Radar narratives (7d)", async () => {
    const count = await tableCount(service, "radar_narratives", (q: any) => q.gte("created_at", ago7d)); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (count === 0) return { status: "warn", detail: "no radar narratives in 7d" };
    return { status: "pass", detail: `${count} narratives` };
  }));

  // Test: sector intelligence
  tests.push(await runTest("Sector intelligence", async () => {
    const count = await tableCount(service, "sector_intelligence");
    if (count === 0) return { status: "warn", detail: "no sector intelligence yet" };
    return { status: "pass", detail: `${count} analyses` };
  }));

  // Test: weekly briefs
  tests.push(await runTest("Weekly briefs", async () => {
    const count = await tableCount(service, "weekly_briefs");
    if (count === 0) return { status: "warn", detail: "no briefs generated yet" };
    return { status: "pass", detail: `${count} briefs` };
  }));

  return { section: "AI Layers", tests };
}

async function selfHealingTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Test: interpretation validation
  tests.push(await runTest("Interpretation validation (24h)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("interpretations")
      .select("validation_status")
      .not("validation_status", "is", null)
      .gte("validated_at", ago24h);
    const rows = (data ?? []) as { validation_status: string }[];
    if (rows.length === 0) return { status: "pass", detail: "no validations in 24h" };
    const hallucinated = rows.filter(r => r.validation_status === "hallucinated").length;
    if (hallucinated > 0) return { status: "warn", detail: `${hallucinated}/${rows.length} hallucinated` };
    return { status: "pass", detail: `${rows.length} validated · 0 hallucinated` };
  }));

  // Test: movement validation
  tests.push(await runTest("Movement validation (24h)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("strategic_movements")
      .select("validation_status")
      .not("validation_status", "is", null)
      .gte("created_at", ago24h);
    const rows = (data ?? []) as { validation_status: string }[];
    if (rows.length === 0) return { status: "pass", detail: "no validations in 24h" };
    const hallucinated = rows.filter(r => r.validation_status === "hallucinated").length;
    if (hallucinated > 0) return { status: "warn", detail: `${hallucinated}/${rows.length} hallucinated` };
    return { status: "pass", detail: `${rows.length} validated · 0 hallucinated` };
  }));

  // Test: cron retries
  tests.push(await runTest("Cron retries (24h)", async () => {
    const count = await tableCount(service, "pipeline_events", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("stage", "cron_retry").gte("created_at", ago24h)
    );
    return { status: "pass", detail: `${count} retries attempted` };
  }));

  // Test: noise suppression rules
  tests.push(await runTest("Noise suppression rules", async () => {
    try {
      const count = await tableCount(service, "noise_suppression_rules");
      return { status: "pass", detail: `${count} rules active` };
    } catch {
      return { status: "skip", detail: "table not available" };
    }
  }));

  // Test: confidence calibration
  tests.push(await runTest("Confidence calibration", async () => {
    try {
      const count = await tableCount(service, "confidence_calibration");
      return { status: "pass", detail: `${count} calibration entries` };
    } catch {
      return { status: "skip", detail: "table not available" };
    }
  }));

  // Test: velocity dampening activity
  tests.push(await runTest("Velocity dampening (24h)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pipeline_events")
      .select("metadata")
      .gte("created_at", ago24h)
      .eq("status", "skipped")
      .limit(300);
    let dampened = 0;
    for (const r of (data ?? []) as { metadata: Record<string, unknown> | null }[]) {
      if ((r.metadata?.suppressed_by as string) === "velocity_anomaly") dampened++;
    }
    return { status: "pass", detail: `${dampened} dampened` };
  }));

  return { section: "Self-Healing & Validation", tests };
}

async function runtimeTests(): Promise<TestSection> {
  const tests: TestResult[] = [];
  const runtimeUrl = process.env.RADAR_API_BASE_URL ?? "https://metrivant-runtime.vercel.app";
  const secret = process.env.CRON_SECRET;

  // Test: runtime health endpoint
  tests.push(await runTest("Runtime /api/health", async () => {
    const headers: Record<string, string> = {};
    if (secret) headers["Authorization"] = `Bearer ${secret}`;
    const res = await fetch(`${runtimeUrl}/api/health`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "fail", detail: `HTTP ${res.status}` };
    const json = await res.json();
    if (json.ok) return { status: "pass", detail: `healthy · ${json.response_ms ?? "?"}ms` };
    return { status: "warn", detail: `degraded: ${json.crons?.stale_count ?? 0} stale crons` };
  }));

  // Test: runtime radar-feed endpoint
  tests.push(await runTest("Runtime /api/radar-feed", async () => {
    const headers: Record<string, string> = {};
    if (secret) headers["Authorization"] = `Bearer ${secret}`;
    const res = await fetch(`${runtimeUrl}/api/radar-feed?limit=1`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "fail", detail: `HTTP ${res.status}` };
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return { status: "pass", detail: `${json.data.length} competitor(s) returned` };
    }
    return { status: "warn", detail: "unexpected response shape" };
  }));

  // Test: UI health endpoint
  tests.push(await runTest("UI /api/health", async () => {
    const uiUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
    const res = await fetch(`${uiUrl}/api/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "fail", detail: `HTTP ${res.status}` };
    const json = await res.json();
    return { status: json.ok ? "pass" : "warn", detail: json.ok ? "healthy" : "degraded" };
  }));

  return { section: "Runtime API", tests };
}

async function competitorTests(service: SB): Promise<TestSection> {
  const tests: TestResult[] = [];

  // Test: competitors exist
  tests.push(await runTest("Competitors tracked", async () => {
    const count = await tableCount(service, "competitors");
    if (count === 0) return { status: "fail", detail: "no competitors" };
    return { status: "pass", detail: `${count} competitors` };
  }));

  // Test: tracked_competitors linked
  tests.push(await runTest("Tracked competitors linked", async () => {
    const count = await tableCount(service, "tracked_competitors");
    if (count === 0) return { status: "warn", detail: "no tracked competitors" };
    return { status: "pass", detail: `${count} tracked` };
  }));

  // Test: pressure index freshness
  tests.push(await runTest("Pressure index populated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("competitors")
      .select("pressure_index")
      .not("pressure_index", "is", null)
      .gt("pressure_index", 0)
      .limit(100);
    const count = (data ?? []).length;
    if (count === 0) return { status: "warn", detail: "no competitors with pressure > 0" };
    return { status: "pass", detail: `${count} with active pressure` };
  }));

  // Test: activity events (24h)
  tests.push(await runTest("Activity events (24h)", async () => {
    const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = await tableCount(service, "activity_events", (q: any) => q.gte("detected_at", ago24h)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { status: count > 0 ? "pass" : "warn", detail: `${count} events` };
  }));

  return { section: "Competitors", tests };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const service = createServiceClient();

  // Run test sections sequentially (conserve DB connections)
  const sections: TestSection[] = [];
  sections.push(await databaseTests(service));
  sections.push(await pipelineTests(service));
  sections.push(await signalTests(service));
  sections.push(await cronTests(service));
  sections.push(await poolTests(service));
  sections.push(await coverageTests(service));
  sections.push(await aiLayerTests(service));
  sections.push(await selfHealingTests(service));
  sections.push(await competitorTests(service));
  sections.push(await runtimeTests());

  const allTests = sections.flatMap(s => s.tests);
  const summary = {
    total: allTests.length,
    pass: allTests.filter(t => t.status === "pass").length,
    warn: allTests.filter(t => t.status === "warn").length,
    fail: allTests.filter(t => t.status === "fail").length,
    skip: allTests.filter(t => t.status === "skip").length,
  };

  return NextResponse.json(
    {
      ok: summary.fail === 0,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      summary,
      sections,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache" },
    }
  );
}
