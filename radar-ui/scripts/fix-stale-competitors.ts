#!/usr/bin/env tsx
// Analyze stale competitors and suggest fixes

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

const STALE_COMPETITORS = ["Nuvei", "Marqeta", "Adyen", "Affirm", "Rippling"];

async function analyze() {
  console.log("🔍 Analyzing Stale Competitors\n");

  for (const compName of STALE_COMPETITORS) {
    const { data: comp } = await supabase
      .from("competitors")
      .select("id, name, website_url")
      .eq("name", compName)
      .single();

    if (!comp) {
      console.log(`❌ ${compName}: not found in database`);
      continue;
    }

    const { data: pages } = await supabase
      .from("monitored_pages")
      .select("id, url, page_type, health_state, active, last_fetched_at")
      .eq("competitor_id", comp.id)
      .order("health_state");

    console.log(`\n📊 ${compName} (${comp.website_url})`);
    console.log(`   Total pages: ${pages?.length || 0}`);

    if (pages) {
      const byState = new Map<string, number>();
      for (const p of pages) {
        const state = p.health_state || "healthy";
        byState.set(state, (byState.get(state) || 0) + 1);
      }

      console.log(`   Health breakdown: ${JSON.stringify(Object.fromEntries(byState))}`);

      // Show all pages
      for (const p of pages) {
        const state = p.health_state || "healthy";
        const lastFetch = p.last_fetched_at
          ? new Date(p.last_fetched_at).toISOString().slice(0, 16).replace("T", " ")
          : "never";
        console.log(`   - ${p.page_type?.padEnd(10)} ${state.padEnd(12)} ${p.active ? "active" : "inactive"}  ${lastFetch}`);
        console.log(`     ${p.url}`);
      }

      // Suggest fixes
      const unresolved = pages.filter(p => p.health_state === "unresolved");
      const blocked = pages.filter(p => p.health_state === "blocked");

      if (unresolved.length === pages.length) {
        console.log(`\n   💡 ALL pages unresolved - likely wrong URLs. Check ${comp.website_url} and update.`);
      } else if (blocked.length > pages.length / 2) {
        console.log(`\n   💡 Many pages blocked - likely bot detection. Consider using ScrapingBee.`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🔧 RECOMMENDED FIXES:\n");
  console.log("1. For UNRESOLVED pages: Verify URLs are still valid");
  console.log("2. For BLOCKED pages: Enable ScrapingBee fallback or adjust User-Agent");
  console.log("3. For DEGRADED pages: Check selector-repair-suggestions table");
  console.log("4. Consider deactivating pages that are permanently broken");
  console.log();
}

analyze().catch(console.error);
