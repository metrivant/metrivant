import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getRadarFeed } from "../../../lib/api";
import LemonadeView from "./LemonadeView";

export default async function LemonadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const all = await getRadarFeed(24).catch(() => []);

  // Top 5 by signals this week, momentum as tiebreaker
  const competitors = [...all]
    .sort((a, b) => {
      const bySignals = (b.signals_7d ?? 0) - (a.signals_7d ?? 0);
      if (bySignals !== 0) return bySignals;
      return Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0);
    })
    .slice(0, 5);

  return <LemonadeView competitors={competitors} />;
}
