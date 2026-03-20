/**
 * System diagnostic — highest-leverage queries for pipeline health visibility.
 * Run: npx tsx scripts/diagnose.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function run() {
  const results: Record<string, unknown> = {};

  // ── 1. Monitored pages health breakdown ────────────────────────
  const { data: pageHealth } = await supabase
    .from("monitored_pages")
    .select("health_state, active")
    .order("health_state");

  const healthCounts: Record<string, { active: number; inactive: number }> = {};
  for (const p of pageHealth ?? []) {
    const hs = p.health_state ?? "null";
    if (!healthCounts[hs]) healthCounts[hs] = { active: 0, inactive: 0 };
    healthCounts[hs][p.active ? "active" : "inactive"]++;
  }
  results["1_page_health"] = healthCounts;

  // ── 2. Competitors with zero active pages ──────────────────────
  const { data: allComps } = await supabase
    .from("competitors")
    .select("id, name, domain");

  const { data: activePages } = await supabase
    .from("monitored_pages")
    .select("competitor_id")
    .eq("active", true);

  const activeCompIds = new Set((activePages ?? []).map((p) => p.competitor_id));
  const orphanComps = (allComps ?? []).filter((c) => !activeCompIds.has(c.id));
  results["2_competitors_zero_active_pages"] = orphanComps.map((c) => c.name);

  // ── 3. Signal pipeline backlog ─────────────────────────────────
  const [snapBacklog, diffBacklog, pendingSignals, stuckSignals] = await Promise.all([
    supabase.from("snapshots").select("*", { count: "exact", head: true })
      .eq("sections_extracted", false).eq("fetch_quality", "full"),
    supabase.from("section_diffs").select("*", { count: "exact", head: true })
      .eq("status", "confirmed").eq("signal_detected", false),
    supabase.from("signals").select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("signals").select("*", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);
  results["3_pipeline_backlog"] = {
    unextracted_snapshots: snapBacklog.count ?? 0,
    unprocessed_diffs: diffBacklog.count ?? 0,
    pending_signals: pendingSignals.count ?? 0,
    failed_signals: stuckSignals.count ?? 0,
  };

  // ── 4. Signal production last 7d by status ─────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentSignals } = await supabase
    .from("signals")
    .select("status, relevance_level, source_type")
    .gte("created_at", sevenDaysAgo);

  const signalStats: Record<string, number> = {};
  const relevanceStats: Record<string, number> = {};
  const sourceStats: Record<string, number> = {};
  for (const s of recentSignals ?? []) {
    signalStats[s.status] = (signalStats[s.status] || 0) + 1;
    if (s.relevance_level) relevanceStats[s.relevance_level] = (relevanceStats[s.relevance_level] || 0) + 1;
    if (s.source_type) sourceStats[s.source_type] = (sourceStats[s.source_type] || 0) + 1;
  }
  results["4_signals_7d"] = { by_status: signalStats, by_relevance: relevanceStats, by_source: sourceStats, total: (recentSignals ?? []).length };

  // ── 5. Pages never successfully fetched ────────────────────────
  const { data: neverFetched } = await supabase
    .from("monitored_pages")
    .select("url, page_type, health_state, active, competitor_id")
    .is("last_fetched_at", null)
    .eq("active", true);

  // Resolve competitor names
  const compMap = new Map((allComps ?? []).map((c) => [c.id, c.name]));
  results["5_never_fetched_active"] = (neverFetched ?? []).map((p) => ({
    competitor: compMap.get(p.competitor_id) ?? "?",
    page_type: p.page_type,
    url: p.url,
    health: p.health_state,
  }));

  // ── 6. Stale pages (active but not fetched in 48h) ────────────
  const staleThreshold = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: stalePages } = await supabase
    .from("monitored_pages")
    .select("url, page_type, health_state, last_fetched_at, competitor_id")
    .eq("active", true)
    .not("last_fetched_at", "is", null)
    .lt("last_fetched_at", staleThreshold);

  results["6_stale_pages_48h"] = (stalePages ?? []).map((p) => ({
    competitor: compMap.get(p.competitor_id) ?? "?",
    page_type: p.page_type,
    url: p.url,
    last_fetched: p.last_fetched_at,
    health: p.health_state,
  }));

  // ── 7. Movements + narratives freshness ────────────────────────
  const { count: recentMovements } = await supabase
    .from("strategic_movements")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  const { count: recentNarratives } = await supabase
    .from("radar_narratives")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  const { data: latestBrief } = await supabase
    .from("weekly_briefs")
    .select("created_at, week_start")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  results["7_ai_layer_freshness"] = {
    movements_7d: recentMovements ?? 0,
    narratives_7d: recentNarratives ?? 0,
    latest_brief: latestBrief ? { created: latestBrief.created_at, week: latestBrief.week_start } : null,
  };

  // ── 8. Pool events backlog ─────────────────────────────────────
  const { data: poolPending } = await supabase
    .from("pool_events")
    .select("pool_type, status")
    .eq("status", "pending");

  const poolCounts: Record<string, number> = {};
  for (const pe of poolPending ?? []) {
    poolCounts[pe.pool_type] = (poolCounts[pe.pool_type] || 0) + 1;
  }
  results["8_pool_events_pending"] = poolCounts;

  // ── 9. Competitor pressure index distribution ──────────────────
  const { data: pressures } = await supabase
    .from("competitors")
    .select("name, pressure_index, last_signal_at")
    .order("pressure_index", { ascending: false });

  results["9_pressure_index"] = (pressures ?? []).map((c) => ({
    name: c.name,
    pressure: c.pressure_index,
    last_signal: c.last_signal_at,
  }));

  // ── 10. Interpretation queue depth ─────────────────────────────
  const { count: pendingInterp } = await supabase
    .from("signals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .in("relevance_level", ["high", "medium"]);

  const { count: pendingReview } = await supabase
    .from("signals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");

  results["10_interpretation_queue"] = {
    pending_high_medium: pendingInterp ?? 0,
    pending_review: pendingReview ?? 0,
  };

  // ── 11. URL migration verification ─────────────────────────────
  const { data: urlCheck } = await supabase
    .from("monitored_pages")
    .select("url, health_state, active")
    .or("url.like.%chime.com%,url.like.%adyen.com%,url.like.%nuvei.com%,url.like.%affirm.com%,url.like.%rippling.com%");

  const stillBroken = (urlCheck ?? []).filter(
    (p) => p.active && (p.health_state === "blocked" || p.health_state === "unresolved")
  );
  results["11_url_migration_check"] = {
    total_rows: (urlCheck ?? []).length,
    still_blocked_or_unresolved: stillBroken.length,
    details: stillBroken.map((p) => ({ url: p.url, health: p.health_state })),
  };

  // ── Print ──────────────────────────────────────────────────────
  for (const [key, val] of Object.entries(results)) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ${key}`);
    console.log(`${"═".repeat(60)}`);
    console.log(JSON.stringify(val, null, 2));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
