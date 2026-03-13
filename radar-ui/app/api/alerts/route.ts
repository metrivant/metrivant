import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import type { AlertRow } from "../../../lib/alert";
import { captureException } from "../../../lib/sentry";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!org) {
    return NextResponse.json({ alerts: [], unreadCount: 0 });
  }

  const { data: alerts, error } = await supabase
    .from("alerts")
    .select(
      "id, signal_id, competitor_name, signal_type, summary, urgency, severity, created_at, read"
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    captureException(error, { route: "alerts", step: "alerts_select", org_id: org.id });
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 });
  }

  const rows = (alerts ?? []) as AlertRow[];
  const unreadCount = rows.filter((a) => !a.read).length;

  return NextResponse.json({ alerts: rows, unreadCount });
}
