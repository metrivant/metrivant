import Link from "next/link";
import Radar from "../../components/Radar";
import RadarViewedTracker from "../../components/RadarViewedTracker";
import NotificationBell from "../../components/NotificationBell";
import SectorSwitcher from "../../components/SectorSwitcher";
import PlanBadge from "../../components/PlanBadge";
import UpgradePrompt from "../../components/UpgradePrompt";
import FirstSignalCelebration from "../../components/FirstSignalCelebration";
import SidebarNav from "../../components/SidebarNav";
import RadarLogo from "../../components/RadarLogo";
import IntelligenceStrip from "../../components/IntelligenceStrip";
import AppOverlays from "../../components/AppOverlays";
import TrialLockScreen from "../../components/TrialLockScreen";
import DailyBriefOverlay from "../../components/DailyBriefOverlay";
import MobileNav from "../../components/MobileNav";
import AchievementsButton from "../../components/AchievementsButton";
import SoundToggle from "../../components/SoundToggle";
import CleanSlateButton from "../../components/CleanSlateButton";
import { getRadarFeed } from "../../lib/api";
import { createClient } from "../../lib/supabase/server";
import { getSubscriptionState } from "../../lib/subscription";

// ── Sector news — Google News RSS, cached 1 hour ──────────────────────────────

const SECTOR_QUERIES: Record<string, string> = {
  saas:               "B2B SaaS software competitive market",
  defense:            "defense aerospace government contract",
  energy:             "energy oil gas renewables market",
  cybersecurity:      "cybersecurity threat intelligence breach",
  fintech:            "fintech financial technology market",
  "ai-infrastructure": "artificial intelligence AI infrastructure market",
  devtools:           "developer tools software platform",
  healthcare:         "healthcare technology digital health",
  "consumer-tech":    "consumer technology product launch",
};

async function fetchSectorNews(sector: string): Promise<string[]> {
  const q = SECTOR_QUERIES[sector] ?? "technology market intelligence";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)];
    return matches.slice(1, 7).map((m) => m[1]);
  } catch {
    return [];
  }
}

export default async function Page() {
  const competitorsRaw = await getRadarFeed(50);
  // Deduplicate by name (keep highest-momentum entry per name — feed is already sorted desc)
  const seenNames = new Set<string>();
  const competitors = competitorsRaw.filter((c) => {
    const key = c.competitor_name.toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Read org sector + subscription state — best-effort, both default to safe values
  let sector             = "saas";
  let plan               = "analyst";
  let trialExpired       = false;
  let trialDaysRemaining: number | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Resolve org for both sector and subscription lookup
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("id, sector")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const org = orgRows?.[0] ?? null;
      if (org?.sector) sector = org.sector as string;

      // Subscription state — authoritative source for plan + trial gate
      if (org?.id) {
        const subState = await getSubscriptionState(supabase, org.id as string, user.created_at);
        plan         = subState.plan;
        trialExpired = subState.status === "expired";
        if (subState.status === "trial") {
          const trialEnd = new Date(user.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      } else {
        // No org yet — fall back to time-based trial check
        plan = (user.user_metadata?.plan as string | undefined) ?? "analyst";
        if (plan !== "pro") {
          const trialEnd = new Date(user.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
          trialExpired = Date.now() > trialEnd;
          if (!trialExpired) {
            trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
          }
        }
      }
    }
  } catch {
    // Non-fatal — sector and plan display are optional
  }

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  const hasCriticalAlert = competitors.some(
    (c) =>
      Number(c.momentum_score ?? 0) >= 7 &&
      Number(c.signals_7d ?? 0) >= 3 &&
      Number(c.latest_movement_confidence ?? 0) >= 0.7 &&
      c.latest_movement_type != null &&
      c.latest_movement_last_seen_at != null &&
      Date.now() - new Date(c.latest_movement_last_seen_at).getTime() < 48 * 60 * 60 * 1000
  );

  // Competitors with any signal in the last 24h — the habit-forming daily metric.
  const newToday = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const totalSignals7d = competitors.reduce(
    (sum, c) => sum + (c.signals_7d ?? 0),
    0
  );

  // Sector news — fetched server-side, cached 1 hour. Non-blocking; falls back to [].
  const newsItems = await fetchSectorNews(sector);

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
                className="text-[18px] font-bold leading-none text-white md:text-[20px]"
                style={{ letterSpacing: "0.10em" }}
              >
                METRIVANT
              </div>
              <div
                className="hidden text-[9px] font-semibold uppercase md:block"
                style={{ letterSpacing: "0.32em", color: "rgba(46,230,166,0.48)" }}
              >
                Competitive Intelligence
              </div>
            </div>
          </div>

          {/* ── Right: stats + notification ────────────────────────────── */}
          <div className="flex items-center gap-3 md:gap-4">
            <AchievementsButton
              totalSignals7d={totalSignals7d}
              competitorCount={competitors.length}
              hasMovement={competitors.some((c) => c.latest_movement_type != null)}
              hasCriticalAlert={hasCriticalAlert}
            />
            <PlanBadge plan={plan} trialDaysRemaining={trialDaysRemaining} />
            {/* SectorSwitcher + Clean Slate: accessible via Settings on mobile */}
            <div className="hidden md:flex items-center gap-2">
              <CleanSlateButton competitorCount={competitors.length} />
              <SectorSwitcher sector={sector} />
            </div>
            <SoundToggle />
            <NotificationBell />

            {/* Stats — hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center gap-5">
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

          </div>
        </div>
      </header>

      {/* ── Intelligence strip — Bloomberg-style live ticker ──────────────── */}
      <IntelligenceStrip competitors={competitors} newsItems={newsItems} sector={sector} />

      {/* ── Body: sidebar nav + radar ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-row overflow-hidden">

        {/* ── Left sidebar — navigation (desktop only) ──────────────────── */}
        <nav
          className="hidden w-[190px] shrink-0 flex-col border-r border-[#0e2210] bg-[rgba(0,0,0,0.98)] md:flex xl:w-[240px]"
          aria-label="App navigation"
        >
          <SidebarNav plan={plan} competitors={competitors} />
        </nav>

        {/* ── Radar content area ─────────────────────────────────────────── */}
        {/* Desktop: flex-1 overflow-hidden p-3 (fixed viewport height)       */}
        {/* Mobile:  p-3 pb-[76px] — extra bottom padding clears mobile nav   */}
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden p-3 pb-[76px] md:pb-3">
          <RadarViewedTracker />
          <Radar competitors={competitors} sector={sector} />
        </div>

      </div>

      {/* ── First signal celebration — shown once when pipeline delivers first intel */}
      <FirstSignalCelebration hasSignals={totalSignals7d > 0} />

      {/* ── Timed upgrade prompt — shown after 60s for Analyst plan users ── */}
      <UpgradePrompt plan={plan} />

      {/* ── Full-screen/slide-in overlays for Map, Briefs, Strategy ─────── */}
      <AppOverlays competitors={competitors} />

      {/* ── Daily scan brief — shown once per day on first radar load ──────── */}
      {!trialExpired && <DailyBriefOverlay competitors={competitors} />}

      {/* ── Trial lock screen — shown when trial expired and plan is not Pro ── */}
      {trialExpired && <TrialLockScreen />}

      {/* ── Mobile bottom navigation — md:hidden inside component ─────────── */}
      <MobileNav />

    </main>
  );
}
