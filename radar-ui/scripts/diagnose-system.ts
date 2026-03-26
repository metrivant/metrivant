#!/usr/bin/env tsx
// System Health Diagnostic Script
// Queries database directly to identify issues and suggest fixes

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config({ path: resolve(__dirname, "../.env.local.ui") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface Issue {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  fix?: string;
}

const issues: Issue[] = [];

async function diagnose() {
  console.log("🔍 Metrivant System Diagnostic\n");

  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Check 1: Stale Crons ──────────────────────────────────────────────
  console.log("📊 Checking cron health...");
  try {
    const { data: cronRows } = await supabase
      .from("cron_heartbeats")
      .select("route, last_run_at, status")
      .order("route");

    let staleCount = 0;
    const staleCrons: string[] = [];

    for (const cron of cronRows || []) {
      const ageMin = Math.floor((Date.now() - new Date(cron.last_run_at).getTime()) / 60_000);
      const threshold = 90; // Default for hourly jobs

      if (ageMin > threshold * 2) {
        staleCount++;
        staleCrons.push(`${cron.route} (${Math.floor(ageMin / 60)}h ago)`);
      }
    }

    if (staleCount > 0) {
      issues.push({
        severity: "critical",
        category: "Cron Health",
        description: `${staleCount} stale cron jobs: ${staleCrons.join(", ")}`,
        fix: "Check Vercel deployment and cron configuration"
      });
    }
  } catch (err) {
    console.error("Failed to check cron health:", err);
  }

  // ── Check 2: Failed Signals ────────────────────────────────────────────
  console.log("🔍 Checking signal health...");
  try {
    const { data: failedSignals } = await supabase
      .from("signals")
      .select("id, status")
      .eq("status", "failed")
      .limit(100);

    if (failedSignals && failedSignals.length > 0) {
      issues.push({
        severity: "high",
        category: "Signal Processing",
        description: `${failedSignals.length} signals stuck in failed status`,
        fix: "Run retention cleanup or investigate interpretation failures"
      });
    }
  } catch (err) {
    console.error("Failed to check signals:", err);
  }

  // ── Check 3: Stuck Pending Signals ──────────────────────────────────────
  console.log("⏳ Checking pending signals...");
  try {
    const { data: oldPending } = await supabase
      .from("signals")
      .select("id, detected_at")
      .eq("status", "pending")
      .lt("detected_at", ago7d)
      .limit(100);

    if (oldPending && oldPending.length > 0) {
      issues.push({
        severity: "medium",
        category: "Signal Processing",
        description: `${oldPending.length} signals pending for >7 days`,
        fix: "Check interpret-signals handler or increase interpretation capacity"
      });
    }
  } catch (err) {
    console.error("Failed to check pending signals:", err);
  }

  // ── Check 4: Recent Pipeline Errors ─────────────────────────────────────
  console.log("❌ Checking pipeline errors...");
  try {
    const { data: errors } = await supabase
      .from("pipeline_events")
      .select("stage, status, created_at, metadata")
      .eq("status", "error")
      .gte("created_at", ago24h)
      .order("created_at", { ascending: false })
      .limit(20);

    if (errors && errors.length > 5) {
      const errorsByStage = new Map<string, number>();
      for (const err of errors) {
        errorsByStage.set(err.stage, (errorsByStage.get(err.stage) || 0) + 1);
      }

      const topErrors = [...errorsByStage.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([stage, count]) => `${stage}(${count})`)
        .join(", ");

      issues.push({
        severity: "high",
        category: "Pipeline Errors",
        description: `${errors.length} errors in last 24h: ${topErrors}`,
        fix: "Check Sentry for error details and investigate failing stages"
      });
    }
  } catch (err) {
    console.error("Failed to check pipeline errors:", err);
  }

  // ── Check 5: Coverage Health ────────────────────────────────────────────
  console.log("🏥 Checking coverage health...");
  try {
    const { data: unhealthyPages } = await supabase
      .from("monitored_pages")
      .select("id, url, health_state, competitors(name)")
      .in("health_state", ["blocked", "challenge", "unresolved"])
      .limit(50);

    if (unhealthyPages && unhealthyPages.length > 10) {
      issues.push({
        severity: "medium",
        category: "Coverage Health",
        description: `${unhealthyPages.length} pages in degraded state`,
        fix: "Check suggest-selector-repairs and heal-coverage handlers"
      });
    }
  } catch (err) {
    console.error("Failed to check coverage health:", err);
  }

  // ── Check 6: Stale Page Fetches ─────────────────────────────────────────
  console.log("📡 Checking fetch staleness...");
  try {
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("monitored_pages")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .lt("last_fetched_at", staleCutoff);

    if (count && count > 10) {
      issues.push({
        severity: "high",
        category: "Fetch Pipeline",
        description: `${count} active pages not fetched in 24h`,
        fix: "Check fetch-snapshots handler execution"
      });
    }
  } catch (err) {
    console.error("Failed to check fetch staleness:", err);
  }

  // ── Check 7: Validation Quality ─────────────────────────────────────────
  console.log("🎯 Checking validation quality...");
  try {
    const { data: interpValidation } = await supabase
      .from("interpretations")
      .select("validation_status")
      .not("validation_status", "is", null)
      .gte("validated_at", ago24h);

    let hallucinated = 0;
    for (const v of interpValidation || []) {
      if (v.validation_status === "hallucinated") hallucinated++;
    }

    if (hallucinated > 5) {
      issues.push({
        severity: "medium",
        category: "AI Quality",
        description: `${hallucinated} hallucinated interpretations in last 24h`,
        fix: "Review interpretation prompts or adjust confidence thresholds"
      });
    }
  } catch (err) {
    console.error("Failed to check validation quality:", err);
  }

  // ── Check 8: Stale Competitors ──────────────────────────────────────────
  console.log("💤 Checking stale competitors...");
  try {
    const staleCutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allComps } = await supabase
      .from("competitors")
      .select("id, name, last_signal_at");

    const { data: recentSignals } = await supabase
      .from("signals")
      .select("competitor_id")
      .gte("detected_at", staleCutoff14d);

    const activeCompIds = new Set(recentSignals?.map(s => s.competitor_id) || []);
    let staleCount = 0;

    for (const comp of allComps || []) {
      if (!activeCompIds.has(comp.id)) staleCount++;
    }

    if (staleCount > 5) {
      issues.push({
        severity: "low",
        category: "Competitor Activity",
        description: `${staleCount} competitors with no signals in 14 days`,
        fix: "Check monitored pages or consider competitor relevance"
      });
    }
  } catch (err) {
    console.error("Failed to check stale competitors:", err);
  }

  // ── Report ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("📋 DIAGNOSTIC RESULTS\n");

  if (issues.length === 0) {
    console.log("✅ No issues found - system is healthy!\n");
  } else {
    issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const issue of issues) {
      const icon = issue.severity === "critical" ? "🔴" :
                   issue.severity === "high" ? "🟠" :
                   issue.severity === "medium" ? "🟡" : "🔵";
      console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.category}`);
      console.log(`   ${issue.description}`);
      if (issue.fix) console.log(`   💡 Fix: ${issue.fix}`);
      console.log();
    }

    console.log(`Total issues: ${issues.length}`);
    console.log(`Critical: ${issues.filter(i => i.severity === "critical").length}`);
    console.log(`High: ${issues.filter(i => i.severity === "high").length}`);
    console.log(`Medium: ${issues.filter(i => i.severity === "medium").length}`);
    console.log(`Low: ${issues.filter(i => i.severity === "low").length}`);
  }

  console.log("=".repeat(60) + "\n");
}

diagnose().catch(console.error);
