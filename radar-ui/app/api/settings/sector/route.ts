import { createClient } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { SECTORS } from "../../../../lib/sectors";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const sector = formData.get("sector") as string | null;

  if (!sector || !(SECTORS as readonly string[]).includes(sector)) {
    return NextResponse.json({ error: "Invalid sector" }, { status: 400 });
  }

  // Resolve org — use limit(1) to tolerate duplicate org rows (maybeSingle throws PGRST116 if >1).
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const existingOrg = orgRows?.[0] ?? null;

  if (existingOrg) {
    const { error } = await supabase
      .from("organizations")
      .update({ sector })
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to update sector" }, { status: 500 });
    }
  } else {
    // First visit — create org with chosen sector
    const { error } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, sector });

    if (error) {
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL("/app/settings", request.url), { status: 302 });
}
