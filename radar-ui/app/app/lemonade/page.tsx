import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { getRadarFeed } from "../../../lib/api";
import LemonadeStreet from "./LemonadeStreet";

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LemonadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const competitors = await getRadarFeed(24).catch(() => []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#000200] text-white">

      {/* ── Atmospheric depth ─────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.016,
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(217,119,6,0.20) 40%, rgba(217,119,6,0.35) 50%, rgba(217,119,6,0.20) 60%, transparent 100%)",
          }}
        />

        <div className="flex items-center gap-4">
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

          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[#0d2010]">|</span>
            <span className="text-[12px] font-medium text-slate-500">Lemonade Stand Mode</span>
          </div>

          <span className="rounded-full border border-[#854d0e]/40 bg-[#854d0e]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d97706]">
            Analogy View
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/app/strategy"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Strategy
          </Link>
          <Link
            href="/app/market-map"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Map
          </Link>
          <Link
            href="/app/briefs"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Briefs
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M7.5 2L3.5 6L7.5 10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      {/* ── Street ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <LemonadeStreet competitors={competitors} />
      </div>

    </div>
  );
}
