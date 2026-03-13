import Link from "next/link";
import Radar from "../../components/Radar";
import RadarViewedTracker from "../../components/RadarViewedTracker";
import NotificationBell from "../../components/NotificationBell";
import SectorSwitcher from "../../components/SectorSwitcher";
import PlanBadge from "../../components/PlanBadge";
import UpgradePrompt from "../../components/UpgradePrompt";
import SidebarNav from "../../components/SidebarNav";
import RadarLogo from "../../components/RadarLogo";
import LiveIndicator from "../../components/LiveIndicator";
import { getRadarFeed } from "../../lib/api";
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

  // Most active rival by momentum score
  const topRivalData = competitors.length > 0
    ? [...competitors].sort((a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0))[0]
    : null;
  const topRival = topRivalData
    ? { name: topRivalData.competitor_name, movementType: topRivalData.latest_movement_type }
    : null;

  // Market pressure from dominant movement type across all competitors
  const movementCounts = new Map<string, number>();
  for (const c of competitors) {
    if (c.latest_movement_type) {
      movementCounts.set(c.latest_movement_type, (movementCounts.get(c.latest_movement_type) ?? 0) + 1);
    }
  }
  const topMovement = movementCounts.size > 0
    ? [...movementCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;
  const MOVEMENT_PRESSURE: Record<string, string> = {
    pricing_strategy_shift: "Pricing pressure rising",
    product_expansion:       "Product velocity high",
    market_reposition:       "Narrative shift active",
    enterprise_push:         "Enterprise segment heating",
    ecosystem_expansion:     "Platform plays emerging",
  };
  const marketPressure = topMovement
    ? (MOVEMENT_PRESSURE[topMovement] ?? "Strategic movement active")
    : "No active movements";

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

      {/* ── Header — brand + stats ───────────────────────────────────────── */}
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
          <div className="flex items-center gap-3.5">
            <RadarLogo />

            <div className="flex flex-col gap-y-[3px]">
              <div
                className="text-[20px] font-bold leading-none text-white"
                style={{ letterSpacing: "0.10em" }}
              >
                METRIVANT
              </div>
              <div
                className="text-[9px] font-semibold uppercase"
                style={{ letterSpacing: "0.32em", color: "rgba(46,230,166,0.48)" }}
              >
                Competitive Intelligence
              </div>
            </div>
          </div>

          {/* ── Right: stats + notification + live badge ───────────────── */}
          <div className="flex items-center gap-4">
            <PlanBadge plan={plan} />
            <SectorSwitcher sector={sector} />
            <NotificationBell />

            <div className="flex items-center gap-5">
              {/* Rivals */}
              <div className="group relative cursor-default text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Rivals</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums text-slate-200">{competitors.length}</div>
                <div
                  className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-52 rounded-[10px] border border-[#1a3020] bg-[#060d06] px-3 py-2.5 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.06)" }}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2EE6A6]">Rivals</div>
                  <div className="text-[11px] leading-snug text-slate-500">Companies currently monitored by Metrivant.</div>
                </div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              {/* Active */}
              <div className="group relative cursor-default text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Active</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums" style={{ color: activeCount > 0 ? "#2EE6A6" : "#475569" }}>{activeCount}</div>
                <div
                  className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-52 rounded-[10px] border border-[#1a3020] bg-[#060d06] px-3 py-2.5 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.06)" }}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2EE6A6]">Active</div>
                  <div className="text-[11px] leading-snug text-slate-500">Competitors showing recent strategic movement in the last 7 days.</div>
                </div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              {/* Signals */}
              <div className="group relative cursor-default text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Signals</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums text-slate-200">{totalSignals7d}</div>
                <div
                  className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-52 rounded-[10px] border border-[#1a3020] bg-[#060d06] px-3 py-2.5 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.06)" }}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2EE6A6]">Signals</div>
                  <div className="text-[11px] leading-snug text-slate-500">Detected competitive changes across monitored sources in the last 7 days.</div>
                </div>
              </div>
              <div className="h-8 w-px bg-[#0f2010]" />
              {/* New 24h */}
              <div className="group relative cursor-default text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">New 24h</div>
                <div className="mt-0.5 text-[20px] font-semibold leading-none tabular-nums" style={{ color: newToday > 0 ? "#2EE6A6" : "#475569" }}>{newToday}</div>
                <div
                  className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-52 rounded-[10px] border border-[#1a3020] bg-[#060d06] px-3 py-2.5 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.06)" }}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2EE6A6]">New 24h</div>
                  <div className="text-[11px] leading-snug text-slate-500">Rivals with new signal activity detected in the last 24 hours.</div>
                </div>
              </div>
            </div>

            <LiveIndicator
              isQuiet={isQuiet}
              isFresh={isFresh}
              topRival={topRival}
              marketPressure={marketPressure}
              showStaleWarning={!isFresh && lastSignalAt !== null}
            />
          </div>
        </div>
      </header>

      {/* ── Body: sidebar nav + radar ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-row overflow-hidden">

        {/* ── Left sidebar — navigation ─────────────────────────────────── */}
        <nav
          className="flex w-[220px] shrink-0 flex-col border-r border-[#0e2210] bg-[rgba(0,0,0,0.98)] xl:w-[280px]"
          aria-label="App navigation"
        >
          <SidebarNav plan={plan} competitors={competitors} />
        </nav>

        {/* ── Radar content area ─────────────────────────────────────────── */}
        {/*
          Desktop: flex-1 overflow-hidden p-3 (fixed viewport height)
          Mobile:  natural height, p-3 with extra bottom padding to clear the fixed bottom nav
        */}
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
