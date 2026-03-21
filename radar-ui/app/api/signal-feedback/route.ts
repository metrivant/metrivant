import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { signal_id, verdict } = body as { signal_id?: string; verdict?: string };

  if (!signal_id || !verdict || !["valid", "noise", "uncertain"].includes(verdict)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const service = createServiceClient();

  // Upsert — one feedback per signal
  const { error } = await service
    .from("signal_feedback")
    .upsert(
      { signal_id, verdict, updated_at: new Date().toISOString() },
      { onConflict: "signal_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, signal_id, verdict });
}
