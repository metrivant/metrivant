import type { ReactNode } from "react";
import Link from "next/link";
import Radar from "../../components/Radar";
import RadarViewedTracker from "../../components/RadarViewedTracker";
import NotificationBell from "../../components/NotificationBell";
import SectorSwitcher from "../../components/SectorSwitcher";
import PlanBadge from "../../components/PlanBadge";
import UpgradePrompt from "../../components/UpgradePrompt";
import { getRadarFeed } from "../../lib/api";
import { formatRelative } from "../../lib/format";
import { createClient } from "../../lib/supabase/server";

export default async function Page() {
  const competitors = await getRadarFeed(50);

  // Read org sector + user plan — best-effort, both default to safe values
  let sector = "saas";
  let plan   = "starter";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      plan = (user.user_metadata?.plan as string | undefined) ?? "starter";
      const { data: org } = await supabase
        .from("organizations")
        .select("sector")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (org?.sector) sector = org.sector;
    }
  } catch {
    // Non-fatal — sector and plan display are optional
  }

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  // Competitors with any signal in the last 24h — the habit-forming daily metric.
  const newToday = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const totalSignals7d = competitors.reduce(
    (sum, c) => sum + (c.signals_7d ?? 0),
    0
  );

  const lastSignalAt = competitors.reduce<string | null>((latest, c) => {
    if (!c.last_signal_at) return latest;
    if (!latest) return c.last_signal_at;
    return c.last_signal_at > latest ? c.last_signal_at : latest;
  }, null);

  const isQuiet = totalSignals7d === 0;
  const isFresh =
    lastSignalAt !== null &&
    Date.now() - new Date(lastSignalAt).getTime() < 12 * 60 * 60 * 1000;

  const statusText = isQuiet
    ? `Watching ${competitors.length} rival${competitors.length !== 1 ? "s" : ""} — no movement detected`
    : `${activeCount} rival${activeCount !== 1 ? "s" : ""} moving · ${totalSignals7d} signal${totalSignals7d !== 1 ? "s" : ""} this week${lastSignalAt ? ` · last signal ${formatRelative(lastSignalAt)}` : ""}`;

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-black text-white">

      {/* ── Atmospheric depth layers ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.022,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 50% at 50% -5%, rgba(46,230,166,0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 55%, rgba(46,230,166,0.025) 0%, transparent 100%)",
        }}
      />

      {/* ── Header — brand + stats only ──────────────────────────────────── */}
      <header className="relative z-20 flex h-[68px] shrink-0 items-center border-b border-[#0e2210] bg-[rgba(0,0,0,0.98)] backdrop-blur-xl">

        {/* Accent line at top of header */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.35) 30%, rgba(46,230,166,0.55) 50%, rgba(46,230,166,0.35) 70%, transparent 100%)",
          }}
        />

        <div className="flex w-full items-center justify-between px-5">

          {/* ── Brand ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
              <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
              <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
              <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
              <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
              <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
              <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
            </svg>

            <div className="flex flex-col gap-y-[4px]">
              <div className="text-[22px] font-bold leading-none text-white" style={{ letterSpacing: "0.09em" }}>
                METRIVANT
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: "rgba(46,230,166,0.55)" }}>
                Competitive Intelligence
              </div>
            </div>
          </div>

          {/* ── Right: stats + notification + live badge ───────────────── */}
          <div className="hidden items-center gap-4 md:flex">
            <PlanBadge plan={plan} />
            <SectorSwitcher sector={sector} />
            <NotificationBell />

            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Rivals</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums text-slate-200">{competitors.length}</div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Active</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums" style={{ color: activeCount > 0 ? "#2EE6A6" : "#475569" }}>{activeCount}</div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Signals 7d</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums text-slate-200">{totalSignals7d}</div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">New 24h</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums" style={{ color: newToday > 0 ? "#2EE6A6" : "#475569" }}>{newToday}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="relative flex h-[6px] w-[6px] shrink-0">
                {!isQuiet && isFresh && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#2EE6A6] opacity-55" />
                )}
                <span className={`relative h-[6px] w-[6px] rounded-full ${isQuiet ? "bg-slate-600" : isFresh ? "bg-[#2EE6A6] shadow-[0_0_6px_rgba(46,230,166,0.7)]" : "bg-amber-500"}`} />
              </span>
              <span className="text-[11px] leading-none text-slate-400">
                {statusText}
                {!isFresh && lastSignalAt !== null && (
                  <span className="ml-2 text-amber-500/80">· data may be out of date</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar nav + radar ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar — vertical navigation ───────────────────────── */}
        <nav
          className="hidden w-[220px] shrink-0 flex-col border-r border-[#0e2210] bg-[rgba(0,0,0,0.98)] xl:w-[280px] md:flex"
          aria-label="App navigation"
        >
          <div className="flex flex-col gap-1 p-3 pt-5">

            {(
              [
                {
                  href: "/app/discover",
                  label: "Discover",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  href: "/app/briefs",
                  label: "Briefs",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <rect x="1.5" y="1" width="8" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M3.5 3.5h4M3.5 5.5h4M3.5 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  href: "/app/market-map",
                  label: "Market Map",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
                      <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
                    </svg>
                  ),
                },
                {
                  href: "/app/strategy",
                  label: "Strategy",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="5.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                      <line x1="5.5" y1="1.5" x2="5.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="5.5" y1="8" x2="5.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="1.5" y1="5.5" x2="3" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="8" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ] as { href: string; label: string; icon: ReactNode }[]
            ).map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-[#0a1a0a] hover:text-slate-300"
              >
                {icon}
                {label}
              </Link>
            ))}

            <div className="my-2 h-px bg-[#0e2210]" />

            {/* Lemonade Mode */}
            <Link
              href="/app/lemonade"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-[#0a1a0a] hover:text-slate-300"
              title="Lemonade Mode"
            >
              <span className="text-base leading-none">🍋</span>
              Lemonade Mode
            </Link>
          </div>

          {/* ── Plan / billing ─────────────────────────────────────────── */}
          <div className="mt-auto border-t border-[#0e2210] p-3">
            <Link
              href="/app/billing"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-[#0a1a0a] hover:text-slate-300"
            >
              <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="9" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 3V2.5a2 2 0 0 1 4 0V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {(plan === "analyst" || plan === "starter") ? "Upgrade plan" : "Billing"}
            </Link>
          </div>
        </nav>

        {/* ── Radar content area ─────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden p-3">
          <RadarViewedTracker />
          <Radar competitors={competitors} sector={sector} />
        </div>

      </div>

      {/* ── Timed upgrade prompt — shown after 60s for Analyst plan users ── */}
      <UpgradePrompt plan={plan} />

    </main>
  );
}
