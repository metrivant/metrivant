import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { getSectorDefaults } from "../../../lib/sector-catalog";
import { captureException } from "../../../lib/sentry";

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

  // ── Step 1: Resolve or create the organization ────────────────────────────

  let orgId: string | null = null;

  // Use limit(1) instead of maybeSingle() to tolerate duplicate org rows.
  // maybeSingle() returns PGRST116 if >1 row exists; limit(1) always succeeds.
  const { data: orgRows, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError) {
    captureException(selectError, {
      route: "initialize-sector",
      step: "org_select",
      user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const existingOrg = orgRows?.[0] ?? null;

  if (existingOrg) {
    orgId = existingOrg.id as string;

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ sector })
      .eq("owner_id", user.id);

    if (updateError) {
      captureException(updateError, {
        route: "initialize-sector",
        step: "org_sector_update",
        user_id: user.id,
        sector,
      });
      return NextResponse.json({ error: "Failed to update sector" }, { status: 500 });
    }
  } else {
    const { data: newOrg, error: insertError } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, sector })
      .select("id")
      .single();

    if (insertError || !newOrg) {
      // Race condition: re-select before failing.
      const { data: raceRows } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const raceOrg = raceRows?.[0] ?? null;
      if (raceOrg) {
        orgId = raceOrg.id as string;
      } else {
        const err = insertError ?? new Error("org insert returned null");
        captureException(err, {
          route: "initialize-sector",
          step: "org_insert",
          user_id: user.id,
        });
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
      }
    } else {
      orgId = newOrg.id as string;
    }
  }

  // ── Step 2: Clear existing tracked competitors for this org ───────────────
  //
  // Sector switch resets the competitor slate. Users who want to keep specific
  // competitors can re-add them manually after onboarding.

  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId);

  if (deleteError) {
    captureException(deleteError, {
      route: "initialize-sector",
      step: "clear_competitors",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json({ error: "Failed to clear existing competitors" }, { status: 500 });
  }

  // ── Step 3: Seed default competitors for the selected sector ──────────────
  //
  // "custom" has no defaults — user starts with an empty slate.
  // Inserting into tracked_competitors is the trigger for metrivant-runtime
  // to create monitored_pages entries on its next scheduled crawl.

  const defaults = getSectorDefaults(sector);
  let seeded = 0;

  if (defaults.length > 0) {
    const rows = defaults.map(({ name, website_url }) => ({
      org_id: orgId as string,
      name,
      website_url,
    }));

    const { error: seedError } = await supabase
      .from("tracked_competitors")
      .insert(rows);

    if (seedError) {
      captureException(seedError, {
        route: "initialize-sector",
        step: "seed_competitors",
        user_id: user.id,
        org_id: orgId,
        sector,
      });
      return NextResponse.json({ error: "Failed to seed competitors" }, { status: 500 });
    }

    seeded = defaults.length;
  }

  return NextResponse.json({ ok: true, seeded });
}
