import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { alertIds?: string[] };
  const { alertIds } = body;

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!org) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  let query = supabase
    .from("alerts")
    .update({ read: true })
    .eq("org_id", org.id)
    .eq("read", false);

  // Optionally scope to specific alert IDs
  if (alertIds && alertIds.length > 0) {
    query = query.in("id", alertIds);
  }

  const { error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // PostHog (best-effort)
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    void fetch("https://app.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "alert_viewed",
        distinct_id: user.email ?? user.id,
        properties: { count: count ?? 0 },
      }),
    });
  }

  return NextResponse.json({ ok: true, updated: count ?? 0 });
}
