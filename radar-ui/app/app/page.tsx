// Force dynamic rendering — never serve a cached version of this page.
// The trial gate reads user_metadata.plan which is set by Stripe on payment;
// a stale cached response would serve the lock screen even after a valid upgrade.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
import SyncSubscription from "../../components/SyncSubscription";
import DailyBriefOverlay from "../../components/DailyBriefOverlay";
import MobileNav from "../../components/MobileNav";
import AchievementsButton from "../../components/AchievementsButton";
import SoundToggleButton from "../../components/SoundToggleButton";
import InitBanner from "../../components/InitBanner";
import TutorialHint from "../../components/TutorialHint";
import HistoricalCapsule from "../../components/HistoricalCapsule";
import FeatureDiscoveryPanel from "../../components/FeatureDiscoveryPanel";
import RadarRealtimeSync from "../../components/RadarRealtimeSync";
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
  // Resolve org FIRST so the radar feed can be scoped to this org's competitors.
  // At scale, passing org_id limits the runtime to querying only the org's rows in
  // tracked_competitors, avoiding an unbounded IN() clause across all orgs.
  let sector             = "saas";
  let orgId: string | undefined;
  let plan               = "analyst";
  let hasActiveSub       = false;
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
      if (org?.id) orgId = org.id as string;
      if (org?.sector) sector = org.sector as string;

      // Hard gate: user_metadata.plan is written by the Stripe webhook on successful
      // payment and is the most reliable single source of truth when the subscriptions
      // table row may be missing (race between webhook and page load, org_id resolution
      // failure, or any other write-path failure). Check it FIRST before hitting the DB.
      const metaPlan = user.user_metadata?.plan as string | undefined;
      if (metaPlan === "analyst" || metaPlan === "pro") {
        plan         = metaPlan;
        hasActiveSub = true;
        trialExpired = false;
        // Still compute trial days remaining so the PlanBadge renders correctly
        const trialEnd = new Date(user.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
        if (Date.now() < trialEnd) {
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      } else if (org?.id) {
        // No metadata plan — fall back to subscriptions table as authoritative source
        const subState = await getSubscriptionState(supabase, org.id as string, user.created_at);
        plan         = subState.plan;
        hasActiveSub = subState.status === "active"
                    || subState.status === "canceled_active"
                    || subState.status === "past_due"; // past_due = grace period active

        trialExpired = subState.status === "expired" && !hasActiveSub;
        if (subState.status === "trial") {
          const trialEnd = new Date(user.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      } else {
        // No org yet — time-based trial check only
        const trialEnd = new Date(user.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
        trialExpired = Date.now() > trialEnd;
        if (!trialExpired) {
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      }
    }
  } catch {
    // Non-fatal — sector and plan display are optional
  }

  // Fetch radar feed scoped to this org (orgId may be undefined on first load
  // before an org is created — runtime falls back to all-orgs behavior in that case).
  const competitorsRaw = await getRadarFeed(50, orgId);

  // Deduplicate by name — keeps the highest-momentum entry per name.
  // The feed is sorted momentum DESC before arriving here, so the first occurrence
  // of any name is already the highest-momentum row. This deduplicates cases where
  // the same company was onboarded under slightly different names (e.g. "Notion" and
  // "Notion (notion.so)") that collide after normalisation.
  const seenNames = new Set<string>();
  const competitorsAll = competitorsRaw.filter((c) => {
    const key = c.competitor_name.toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Diagnostic: if runtime returned data but every competitor dropped in dedup, log a warning.
  if (competitorsRaw.length > 0 && competitorsAll.length === 0) {
    console.warn("[radar] zero competitors after dedup — all names collapsed to duplicates", {
      rawCount: competitorsRaw.length,
    });
  }

  // Enforce plan display limit: Pro = 25, Analyst = 10.
  // Slice ensures the radar never renders beyond the plan ceiling regardless
  // of how many competitors the org has accumulated from sector switches.
  const planLimit = plan === "pro" ? 25 : 10;
  const competitors = competitorsAll.slice(0, planLimit);

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  const hasAccelerating = competitors.some(
    (c) => Number(c.momentum_score ?? 0) >= 5
  );

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

  // Strategic insights — check if any patterns exist for this org.
  let hasStrategyContent = false;
  if (orgId) {
    try {
      const supabase = await createClient();
      const { count } = await supabase
        .from("strategic_insights")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .limit(1);
      hasStrategyContent = (count ?? 0) > 0;
    } catch {
      // Non-fatal
    }
  }

  return (
    <main className="page-enter flex h-dvh w-full flex-col overflow-hidden bg-black text-white">

      {/* ── Realtime sync — invisible, pushes router.refresh() on pipeline events */}
      {orgId && <RadarRealtimeSync orgId={orgId} />}

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
              hasAccelerating={hasAccelerating}
              planType={plan as "analyst" | "pro"}
              hasActiveSub={hasActiveSub}
              hasStrategyContent={hasStrategyContent}
            />
            {/* SectorSwitcher (with built-in clean slate X) — desktop only */}
            <div className="hidden md:flex items-center gap-2">
              <SectorSwitcher sector={sector} competitorCount={competitors.length} />
            </div>
            <PlanBadge plan={plan} trialDaysRemaining={trialDaysRemaining} />
            <SoundToggleButton />
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

      {/* ── Post-initialization banner — shown once after sector selection ── */}
      <InitBanner />

      {/* ── Intelligence strip — Bloomberg-style live ticker ──────────────── */}
      <IntelligenceStrip competitors={competitors} newsItems={newsItems} sector={sector} />

      {/* ── Body: sidebar nav + radar ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-row overflow-hidden">

        {/* ── Left sidebar — navigation (desktop only) ──────────────────── */}
        <nav
          className="hidden w-[190px] shrink-0 flex-col overflow-hidden border-r border-[#0e2210] bg-[rgba(0,0,0,0.98)] md:flex xl:w-[240px]"
          aria-label="App navigation"
        >
          <SidebarNav />
        </nav>

        {/* ── Radar content area ─────────────────────────────────────────── */}
        {/* Desktop: flex-1 overflow-hidden p-3 (fixed viewport height)       */}
        {/* Mobile:  p-3 pb-[76px] — extra bottom padding clears mobile nav   */}
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden p-3 pb-[76px] md:pb-3">
          <RadarViewedTracker orgId={orgId} competitorCount={competitors.length} hasActiveAlerts={hasCriticalAlert} />
          <Radar competitors={competitors} sector={sector} orgId={orgId} />
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

      {/* ── Trial lock screen — shown when trial expired and no active subscription ── */}
      {trialExpired && !hasActiveSub && <TrialLockScreen />}

      {/* ── Subscription sync fallback — recovers from webhook write failures ─── */}
      {/* Fires once on mount: checks Stripe for an active sub the webhook missed. */}
      {/* On success: router.refresh() re-renders the page, clearing the lock screen. */}
      {trialExpired && !hasActiveSub && <SyncSubscription />}

      {/* ── Time-based feature discovery hints ──────────────────────────── */}
      {!trialExpired && <TutorialHint />}

      {/* ── Historical trade capsules — periodic ambient intelligence ────── */}
      {!trialExpired && <HistoricalCapsule />}

      {/* ── Feature discovery panels — periodic product education ──────── */}
      {!trialExpired && <FeatureDiscoveryPanel />}

      {/* ── Mobile bottom navigation — md:hidden inside component ─────────── */}
      <MobileNav />

    </main>
  );
}
