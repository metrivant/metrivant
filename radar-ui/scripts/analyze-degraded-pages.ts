#!/usr/bin/env tsx
// Analyze degraded pages to understand the issues

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

async function analyze() {
  console.log("🔍 Analyzing Degraded Pages\n");

  const { data: pages } = await supabase
    .from("monitored_pages")
    .select("id, url, page_type, health_state, last_fetched_at, competitors(name)")
    .in("health_state", ["blocked", "challenge", "degraded", "unresolved"])
    .order("health_state")
    .limit(100);

  if (!pages || pages.length === 0) {
    console.log("✅ No degraded pages found");
    return;
  }

  const byState = new Map<string, typeof pages>();
  for (const page of pages) {
    const state = page.health_state || "unknown";
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state)!.push(page);
  }

  console.log(`Found ${pages.length} degraded pages:\n`);

  for (const [state, statePages] of byState) {
    console.log(`${state.toUpperCase()}: ${statePages.length} pages`);
    for (const page of statePages.slice(0, 5)) {
      const comp = page.competitors as any;
      const compName = comp?.name || "unknown";
      const age = page.last_fetched_at
        ? Math.floor((Date.now() - new Date(page.last_fetched_at).getTime()) / (60 * 60 * 1000))
        : "never";
      console.log(`  - ${compName} / ${page.page_type}`);
      console.log(`    ${page.url}`);
      console.log(`    Last fetch: ${age}h ago`);
    }
    if (statePages.length > 5) {
      console.log(`  ... and ${statePages.length - 5} more`);
    }
    console.log();
  }

  // Check for selector repair suggestions
  const { data: repairs } = await supabase
    .from("selector_repair_suggestions")
    .select("id, monitored_page_id, section_type, confidence, status")
    .eq("status", "pending")
    .limit(50);

  if (repairs && repairs.length > 0) {
    console.log(`💡 ${repairs.length} pending selector repair suggestions available`);
    console.log("   Run heal-coverage or accept repairs in /app/ops\n");
  }
}

analyze().catch(console.error);
