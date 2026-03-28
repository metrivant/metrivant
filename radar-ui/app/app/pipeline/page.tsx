import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import PipelineVisualization from "../../../components/PipelineVisualization";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch organization sector
  const { data: orgData } = await supabase
    .from("organizations")
    .select("sector")
    .eq("owner_id", user.id)
    .single();

  const sector = orgData?.sector ?? "saas";

  // Fetch pipeline metrics
  const [
    { count: competitorCount },
    { count: pageCount },
    { count: signalCount },
    { count: movementCount },
  ] = await Promise.all([
    supabase.from("tracked_competitors").select("*", { count: "exact", head: true }),
    supabase.from("monitored_pages").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("signals").select("*", { count: "exact", head: true }).gte("detected_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("strategic_movements").select("*", { count: "exact", head: true }).gte("last_seen_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return (
    <PipelineVisualization
      sector={sector}
      metrics={{
        competitors: competitorCount ?? 0,
        pages: pageCount ?? 0,
        signals_7d: signalCount ?? 0,
        movements_14d: movementCount ?? 0,
      }}
    />
  );
}
