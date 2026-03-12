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

  const allCompetitors = await getRadarFeed(24).catch(() => []);

  // Top 5 by signals_7d desc, then momentum_score as tiebreaker
  const top5 = [...allCompetitors]
    .sort((a, b) => {
      const bySignals = (b.signals_7d ?? 0) - (a.signals_7d ?? 0);
      if (bySignals !== 0) return bySignals;
      return Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0);
    })
    .slice(0, 5);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#05050f] text-white">

      {/* ── Atmospheric depth ─────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.025,
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6"
        style={{
          background: "#08080f",
          borderBottom: "2px solid #1a2244",
        }}
      >
        {/* Amber pixel accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #ffcc0033 30%, #ffcc0055 50%, #ffcc0033 70%, transparent 100%)",
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
            <span
              className="text-[13px] font-bold tracking-[0.08em] text-white"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              METRIVANT
            </span>
          </Link>

          <span style={{ color: "#1a2244" }}>|</span>

          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              color: "#445566",
              letterSpacing: "0.12em",
            }}
          >
            Lemonade Stand Mode
          </span>

          <span
            style={{
              background: "#ffcc00",
              color: "#000",
              fontFamily: "ui-monospace, monospace",
              fontSize: "9px",
              fontWeight: "bold",
              padding: "2px 8px",
              letterSpacing: "0.16em",
              boxShadow: "2px 2px 0 #000",
            }}
          >
            ANALOGY VIEW
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/app/strategy"
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              color: "#334455",
              letterSpacing: "0.1em",
            }}
            className="transition-colors hover:text-slate-300"
          >
            Strategy
          </Link>
          <Link
            href="/app/briefs"
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              color: "#334455",
              letterSpacing: "0.1em",
            }}
            className="transition-colors hover:text-slate-300"
          >
            Briefs
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 transition-colors hover:text-slate-300"
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              color: "#445566",
              letterSpacing: "0.1em",
            }}
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
        <LemonadeStreet competitors={top5} />
      </div>

    </div>
  );
}
