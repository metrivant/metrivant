import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

// All sectors accepted by the onboarding selector.
// The core pipeline is sector-agnostic; this string is stored for display
// language and catalog curation purposes only.
const VALID_SECTORS = [
  "saas",
  "cybersecurity",
  "energy",
  "defense",
  "fintech",
  "ai-infrastructure",
  "devtools",
  "healthcare",
  "consumer-tech",
  "custom",
] as const;

type ValidSector = (typeof VALID_SECTORS)[number];

function isValidSector(v: unknown): v is ValidSector {
  return typeof v === "string" && (VALID_SECTORS as readonly string[]).includes(v);
}

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

  const sector = (body as Record<string, unknown>)?.sector;

  if (!isValidSector(sector)) {
    return NextResponse.json({ error: "Invalid sector" }, { status: 400 });
  }

  // Upsert: update existing org or create a new one for this user.
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingOrg) {
    const { error } = await supabase
      .from("organizations")
      .update({ sector })
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, sector });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
