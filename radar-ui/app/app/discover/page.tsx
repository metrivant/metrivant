import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import DiscoverClient from "./DiscoverClient";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Pre-load already-tracked domains and org sector
  let trackedDomains: string[] = [];
  let orgSector = "saas";
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
    // Table may not exist yet — silently continue
  }

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Atmospheric depth ──────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.06) 0%, transparent 70%)",
        }}
      />

      {/* ── Mini header ────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,0,0,0.98)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.20) 40%, rgba(46,230,166,0.35) 50%, rgba(46,230,166,0.20) 60%, transparent 100%)",
          }}
        />
        <Link href="/app" className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/app/settings"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Settings
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      {/* ── Page hero ──────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-6xl px-6 pb-2 pt-10">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
            Discovery
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          Who&apos;s making moves in your market?
        </h1>
        <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-slate-500">
          Add competitors to your radar and Metrivant starts watching them immediately —
          pricing changes, feature launches, positioning shifts. Browse by category or search by name.
        </p>
      </div>

      {/* ── Discovery UI ───────────────────────────────────────────────── */}
      <DiscoverClient initialTracked={trackedDomains} initialSector={orgSector} />
    </div>
  );
}
