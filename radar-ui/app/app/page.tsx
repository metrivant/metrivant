import Link from "next/link";
import Radar from "../../components/Radar";
import RadarViewedTracker from "../../components/RadarViewedTracker";
import NotificationBell from "../../components/NotificationBell";
import { getRadarFeed } from "../../lib/api";
import { formatRelative } from "../../lib/format";

export default async function Page() {
  const competitors = await getRadarFeed(24);

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
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-black text-white">

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

      {/* ── Header — single authoritative command band ────────────────────── */}
      <header className="relative z-20 flex h-[80px] shrink-0 items-center border-b border-[#0e2210] bg-[rgba(0,0,0,0.98)] backdrop-blur-xl">

        {/* Subtle accent line at top of header */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.35) 30%, rgba(46,230,166,0.55) 50%, rgba(46,230,166,0.35) 70%, transparent 100%)",
          }}
        />

        <div className="flex w-full items-center justify-between px-7">

          {/* ── Brand ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-5">

            {/* Logo mark: radar with sweep line */}
            <svg
              width="58"
              height="58"
              viewBox="0 0 46 46"
              fill="none"
              aria-hidden="true"
            >
              {/* Outer ring */}
              <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
              {/* Mid ring */}
              <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
              {/* Inner ring */}
              <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
              {/* Sweep sector */}
              <path
                d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z"
                fill="#2EE6A6"
                fillOpacity="0.10"
              />
              {/* Sweep leading edge line */}
              <line
                x1="23" y1="23"
                x2="38.2" y2="9.8"
                stroke="#2EE6A6"
                strokeWidth="1.5"
                strokeOpacity="0.80"
              />
              {/* Center dot */}
              <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
            </svg>

            {/* Wordmark block */}
            <div className="flex flex-col gap-y-[3px]">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.32em]"
                style={{ color: "rgba(46,230,166,0.55)" }}
              >
                Competitive Intelligence
              </div>
              <div
                className="text-[28px] font-bold leading-none text-white"
                style={{ letterSpacing: "0.09em" }}
              >
                METRIVANT
              </div>
              {/* Status subline */}
              <div className="mt-[3px] flex items-center gap-2">
                <span className="relative flex h-[7px] w-[7px] shrink-0">
                  {!isQuiet && isFresh && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#2EE6A6] opacity-55" />
                  )}
                  <span
                    className={`relative h-[7px] w-[7px] rounded-full ${
                      isQuiet
                        ? "bg-slate-600"
                        : isFresh
                          ? "bg-[#2EE6A6] shadow-[0_0_6px_rgba(46,230,166,0.7)]"
                          : "bg-amber-500"
                    }`}
                  />
                </span>
                <span className="text-[12px] leading-none text-slate-400">
                  {statusText}
                  {!isFresh && lastSignalAt !== null && (
                    <span className="ml-2 text-amber-500/80">· data may be out of date</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* ── Right: stats + live badge ──────────────────────────────── */}
          <div className="hidden items-center gap-4 md:flex">

            {/* Notification bell */}
            <NotificationBell />

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                  Rivals
                </div>
                <div className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums text-slate-200">
                  {competitors.length}
                </div>
              </div>

              <div className="h-10 w-px bg-[#0f2010]" />

              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                  Active
                </div>
                <div
                  className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums"
                  style={{ color: activeCount > 0 ? "#2EE6A6" : "#475569" }}
                >
                  {activeCount}
                </div>
              </div>

              <div className="h-10 w-px bg-[#0f2010]" />

              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                  Signals 7d
                </div>
                <div className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums text-slate-200">
                  {totalSignals7d}
                </div>
              </div>

              <div className="h-10 w-px bg-[#0f2010]" />

              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                  New 24h
                </div>
                <div
                  className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums"
                  style={{ color: newToday > 0 ? "#2EE6A6" : "#475569" }}
                >
                  {newToday}
                </div>
              </div>
            </div>

            {/* Discover link */}
            <Link
              href="/app/discover"
              className="hidden items-center gap-1.5 rounded-full border border-[#0d2010] px-4 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#152a15] hover:text-slate-300 lg:flex"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Discover
            </Link>

            {/* Briefs link */}
            <Link
              href="/app/briefs"
              className="hidden items-center gap-1.5 rounded-full border border-[#0d2010] px-4 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#152a15] hover:text-slate-300 lg:flex"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <rect x="1.5" y="1" width="8" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3.5 3.5h4M3.5 5.5h4M3.5 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Briefs
            </Link>

            {/* Market Map link */}
            <Link
              href="/app/market-map"
              className="hidden items-center gap-1.5 rounded-full border border-[#0d2010] px-4 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#152a15] hover:text-slate-300 lg:flex"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
                <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
              </svg>
              Map
            </Link>

            {/* Strategy link */}
            <Link
              href="/app/strategy"
              className="hidden items-center gap-1.5 rounded-full border border-[#0d2010] px-4 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#152a15] hover:text-slate-300 lg:flex"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="5.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.5" y1="1.5" x2="5.5" y2="3"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5.5" y1="8"   x2="5.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="1.5" y1="5.5" x2="3"   y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="8"   y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Strategy
            </Link>

            {/* Lemonade Stand Mode link */}
            <Link
              href="/app/lemonade"
              className="hidden items-center gap-1.5 rounded-full border border-[#2a1500]/60 bg-[#2a1500]/20 px-4 py-2 text-[11px] font-medium text-[#d97706]/70 transition-colors hover:border-[#854d0e]/50 hover:text-[#d97706] lg:flex"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                {/* Lemonade stand icon: simple stand silhouette */}
                <rect x="2" y="5" width="7" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M1 5h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M4 5V3.5C4 2.7 5.5 2 5.5 2S7 2.7 7 3.5V5" stroke="currentColor" strokeWidth="1" />
              </svg>
              Lemonade
            </Link>

            {/* Live indicator badge */}
            <div className="flex items-center gap-2 rounded-full border border-[#2EE6A6]/22 bg-[#2EE6A6]/6 px-4 py-2">
              <span
                className="h-2 w-2 rounded-full bg-[#2EE6A6]"
                style={{ boxShadow: "0 0 8px rgba(46,230,166,0.7)" }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2EE6A6]">
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main: radar fills everything below the header ─────────────────── */}
      <div className="relative z-10 flex-1 overflow-hidden p-3">
        <RadarViewedTracker />
        <Radar competitors={competitors} />
      </div>

    </main>
  );
}
