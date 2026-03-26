#!/usr/bin/env tsx
// Analyze which competitors are affected by degraded pages

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
  const { data: degraded } = await supabase
    .from("monitored_pages")
    .select("competitor_id, health_state, page_type, competitors(name)")
    .in("health_state", ["blocked", "degraded", "unresolved"])
    .limit(100);

  const byComp = new Map<string, any[]>();
  for (const page of degraded || []) {
    const comp = (page.competitors as any);
    const name = comp?.name || "unknown";
    if (!byComp.has(name)) byComp.set(name, []);
    byComp.get(name)!.push(page);
  }

  console.log("Competitors with degraded pages:\n");
  const sorted = [...byComp.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [name, pages] of sorted.slice(0, 10)) {
    const states: Record<string, number> = {};
    for (const p of pages) {
      states[p.health_state] = (states[p.health_state] || 0) + 1;
    }
    console.log(`${name}: ${pages.length} degraded`);
    console.log(`  States: ${JSON.stringify(states)}`);
  }

  // Check if these competitors have recent signals
  console.log("\nChecking signal activity for affected competitors...\n");
  const ago14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const compIds = [...new Set((degraded || []).map(p => p.competitor_id))];

  const { data: signals } = await supabase
    .from("signals")
    .select("competitor_id")
    .in("competitor_id", compIds)
    .gte("detected_at", ago14d);

  const activeCompIds = new Set(signals?.map(s => s.competitor_id) || []);
  const staleComps = compIds.filter(id => !activeCompIds.has(id));

  console.log(`Competitors with degraded pages: ${compIds.length}`);
  console.log(`Still producing signals (14d): ${activeCompIds.size}`);
  console.log(`No signals in 14d: ${staleComps.length}`);

  if (staleComps.length > 0) {
    console.log("\n⚠️  Stale competitors (no signals in 14d):");
    for (const compId of staleComps.slice(0, 5)) {
      const pages = degraded?.filter(p => p.competitor_id === compId) || [];
      const comp = (pages[0]?.competitors as any);
      console.log(`  - ${comp?.name || compId}: ${pages.length} degraded pages`);
    }
  }
}

analyze().catch(console.error);
