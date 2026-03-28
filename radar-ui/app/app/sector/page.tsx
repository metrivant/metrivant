import { createClient } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
import SectorIntelligenceView from "../../../components/SectorIntelligenceView";

export const metadata = {
  title: "Sector Intelligence",
};

export default async function SectorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch org and sector
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id, sector")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const org = orgRows?.[0];
  if (!org) {
    redirect("/app/onboarding");
  }

  const orgId = org.id as string;
  const sector = (org.sector as string) ?? "saas";

  // Fetch latest sector intelligence (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sectorIntelligence } = await supabase
    .from("sector_intelligence")
    .select("*")
    .eq("org_id", orgId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  const intelligence = sectorIntelligence?.[0] ?? null;

  // Fetch tracked competitors for context
  const { data: trackedCompetitors } = await supabase
    .from("tracked_competitors")
    .select("competitor_id")
    .eq("org_id", orgId);

  const competitorIds = (trackedCompetitors ?? []).map((tc) => tc.competitor_id);

  // Fetch competitors data
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, website_url")
    .in("id", competitorIds);

  // Fetch recent signals (last 30 days) for sector context
  const { data: recentSignals } = await supabase
    .from("signals")
    .select("signal_type, competitor_id, detected_at, confidence_score")
    .in("competitor_id", competitorIds)
    .eq("status", "interpreted")
    .gte("detected_at", thirtyDaysAgo)
    .order("detected_at", { ascending: false });

  // Fetch recent movements (last 30 days)
  const { data: recentMovements } = await supabase
    .from("strategic_movements")
    .select("movement_type, competitor_id, confidence, last_seen_at")
    .in("competitor_id", competitorIds)
    .gte("last_seen_at", thirtyDaysAgo)
    .order("last_seen_at", { ascending: false });

  return (
    <SectorIntelligenceView
      sector={sector}
      intelligence={intelligence}
      competitors={competitors ?? []}
      recentSignals={recentSignals ?? []}
      recentMovements={recentMovements ?? []}
    />
  );
}
