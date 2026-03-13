import { createClient } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { captureException } from "../../../../lib/sentry";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body as Record<string, unknown>)?.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Resolve the org owned by this user.
  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) {
    captureException(orgError, { route: "discover/untrack", step: "org_select", user_id: user.id });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const orgId = (orgRows?.[0]?.id as string | null) ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  // Delete the specific tracked competitor for this org.
  // RLS enforces ownership — only rows where org.owner_id = auth.uid() are deletable.
  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId)
    .eq("website_url", url);

  if (deleteError) {
    captureException(deleteError, {
      route: "discover/untrack",
      step: "delete",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json({ error: "Failed to remove competitor" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
