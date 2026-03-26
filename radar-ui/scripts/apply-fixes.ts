#!/usr/bin/env tsx
// Apply automated fixes to degraded pages

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

async function applyFixes() {
  console.log("🔧 Applying Automated Fixes\n");

  // Fix 1: Deactivate pages that are already inactive AND blocked/unresolved
  // These are pages that were manually marked inactive but still show as degraded
  const { data: inactiveBlocked } = await supabase
    .from("monitored_pages")
    .select("id, url, health_state, active")
    .eq("active", false)
    .in("health_state", ["blocked", "unresolved"]);

  if (inactiveBlocked && inactiveBlocked.length > 0) {
    console.log(`ℹ️  Found ${inactiveBlocked.length} inactive pages with degraded health_state`);
    console.log("   These are already inactive, so no action needed.\n");
  }

  // Fix 2: Reset health_state to healthy for baseline_maturing pages
  // baseline_maturing is a temporary state; these pages are being fetched successfully
  const { data: maturing } = await supabase
    .from("monitored_pages")
    .select("id")
    .eq("health_state", "baseline_maturing")
    .eq("active", true);

  if (maturing && maturing.length > 0) {
    console.log(`ℹ️  Found ${maturing.length} pages in baseline_maturing state`);
    console.log("   This is normal - baselines are still stabilizing. No fix needed.\n");
  }

  // Fix 3: Log unresolved pages for manual review
  const { data: unresolved } = await supabase
    .from("monitored_pages")
    .select("id, url, page_type, competitors(name)")
    .eq("health_state", "unresolved")
    .eq("active", true)
    .limit(50);

  if (unresolved && unresolved.length > 0) {
    console.log(`⚠️  ${unresolved.length} UNRESOLVED pages need manual URL verification:\n`);

    const byComp = new Map<string, any[]>();
    for (const page of unresolved) {
      const comp = (page.competitors as any);
      const name = comp?.name || "unknown";
      if (!byComp.has(name)) byComp.set(name, []);
      byComp.get(name)!.push(page);
    }

    for (const [name, pages] of byComp) {
      console.log(`   ${name}:`);
      for (const p of pages) {
        console.log(`     - ${p.page_type}: ${p.url}`);
      }
    }
    console.log();
  }

  // Fix 4: Log blocked pages
  const { data: blocked } = await supabase
    .from("monitored_pages")
    .select("id, url, page_type, competitors(name)")
    .eq("health_state", "blocked")
    .eq("active", true)
    .limit(50);

  if (blocked && blocked.length > 0) {
    console.log(`🚫 ${blocked.length} BLOCKED pages (bot detection/403):\n`);

    const byComp = new Map<string, any[]>();
    for (const page of blocked) {
      const comp = (page.competitors as any);
      const name = comp?.name || "unknown";
      if (!byComp.has(name)) byComp.set(name, []);
      byComp.get(name)!.push(page);
    }

    for (const [name, pages] of byComp) {
      console.log(`   ${name}:`);
      for (const p of pages) {
        console.log(`     - ${p.page_type}: ${p.url}`);
      }
    }
    console.log("\n   💡 Consider enabling ScrapingBee fallback for these pages\n");
  }

  console.log("=".repeat(80));
  console.log("\n✅ ANALYSIS COMPLETE\n");
  console.log("Summary:");
  console.log(`  - ${inactiveBlocked?.length || 0} inactive degraded pages (expected)`)
  console.log(`  - ${maturing?.length || 0} baseline_maturing pages (normal)`)
  console.log(`  - ${unresolved?.length || 0} unresolved pages (need manual URL check)`)
  console.log(`  - ${blocked?.length || 0} blocked pages (bot detection)`)
  console.log();
  console.log("No automated changes were made (all issues require manual review).");
  console.log();
}

applyFixes().catch(console.error);
