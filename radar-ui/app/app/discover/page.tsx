import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { getSubscriptionState } from "../../../lib/subscription";
import DiscoverClient from "./DiscoverClient";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let trackedDomains: string[] = [];
  let orgSector = "saas";
  let plan = "analyst";
  try {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id, sector")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    const org = orgRows?.[0] ?? null;

    if (org) {
      orgSector = org.sector ?? "saas";

      // Fetch plan — check user_metadata first, then subscriptions table
      const metaPlan = user.user_metadata?.plan as string | undefined;
      if (metaPlan === "analyst" || metaPlan === "pro") {
        plan = metaPlan;
      } else {
        const subState = await getSubscriptionState(supabase, org.id as string, user.created_at);
        plan = subState.plan;
      }

      const { data: competitors } = await supabase
        .from("tracked_competitors")
        .select("website_url")
        .eq("org_id", org.id)
        .not("competitor_id", "is", null);

      if (competitors) {
        trackedDomains = competitors
          .map((c) => {
            try {
              return new URL(c.website_url as string).hostname.replace(/^www\./, "");
            } catch {
              return null;
            }
          })
          .filter((d): d is string => d !== null);
      }
    }
  } catch {
    // continue silently
  }

  return (
    <div className="min-h-screen bg-[#000002] text-white">
      {/* ── Dot grid ───────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      {/* ── Atmospheric glow ───────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,180,255,0.09) 0%, transparent 70%)",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.98)",
        }}
      >
        {/* Brand top-edge line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.18) 40%, rgba(0,180,255,0.30) 50%, rgba(0,180,255,0.18) 60%, transparent 100%)",
          }}
        />
        <Link href="/app" className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.45" />
            <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.25" />
            <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.38" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.75" />
            <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
          </svg>
          <span
            className="text-[12px] font-semibold text-white"
            style={{ letterSpacing: "0.14em" }}
          >
            METRIVANT
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/app/settings"
            className="text-[11px] font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}
          >
            Settings
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-6xl px-6 pb-2 pt-12">
        <div
          className="mb-3 text-[9px] font-medium uppercase"
          style={{ letterSpacing: "0.28em", color: "rgba(255,255,255,0.20)" }}
        >
          Catalog
        </div>
        <h1
          className="text-[28px] font-light text-white"
          style={{ letterSpacing: "0.02em", lineHeight: 1.15 }}
        >
          Select your targets.
        </h1>
        <p
          className="mt-2 text-[13px] font-light"
          style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.03em" }}
        >
          Add a competitor. Metrivant watches immediately.
        </p>
      </div>

      {/* ── Discovery UI ───────────────────────────────────────────────── */}
      <DiscoverClient initialTracked={trackedDomains} initialSector={orgSector} plan={plan} />
    </div>
  );
}
