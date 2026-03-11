import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { getRadarFeed } from "../../../lib/api";
import MarketMap, { type MapCompetitor } from "./MarketMap";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MarketMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolve org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  let competitors: MapCompetitor[] = [];
  let fetchError = false;
  let lastUpdated: string | null = null;

  if (org) {
    try {
      // Fetch current positioning
      const { data: positioning, error: posError } = await supabase
        .from("competitor_positioning")
        .select(
          "competitor_id, competitor_name, market_focus_score, " +
          "customer_segment_score, confidence, rationale, updated_at"
        )
        .eq("org_id", org.id)
        .order("updated_at", { ascending: false });

      if (posError) {
        fetchError = true;
      } else if (positioning && positioning.length > 0) {
        const firstRow = positioning[0] as unknown as { updated_at: string };
        lastUpdated = firstRow.updated_at;

        // Fetch positioning history (last 10 per competitor for trails)
        const { data: history } = await supabase
          .from("positioning_history")
          .select("competitor_id, market_focus_score, customer_segment_score, recorded_at")
          .eq("org_id", org.id)
          .order("recorded_at", { ascending: false })
          .limit(300);

        // Group history by competitor
        type HistoryPoint = {
          market_focus_score:     number;
          customer_segment_score: number;
          recorded_at:            string;
        };
        const historyMap = new Map<string, HistoryPoint[]>();
        for (const h of history ?? []) {
          const id  = h.competitor_id as string;
          const arr = historyMap.get(id) ?? [];
          if (arr.length < 10) {
            arr.push({
              market_focus_score:     Number(h.market_focus_score),
              customer_segment_score: Number(h.customer_segment_score),
              recorded_at:            h.recorded_at as string,
            });
            historyMap.set(id, arr);
          }
        }

        // Enrich with radar feed data (momentum, signals, movement type)
        let radarData = new Map<string, {
          momentum_score:         number;
          signals_7d:             number;
          latest_movement_type:   string | null;
          website_url:            string | null;
        }>();
        try {
          const feed = await getRadarFeed(50);
          radarData = new Map(
            feed.map((c) => [
              c.competitor_id,
              {
                momentum_score:       Number(c.momentum_score ?? 0),
                signals_7d:           Number(c.signals_7d ?? 0),
                latest_movement_type: c.latest_movement_type,
                website_url:          c.website_url,
              },
            ])
          );
        } catch {
          // Non-fatal — radar enrichment is best-effort
        }

        competitors = (positioning as unknown as {
          competitor_id:          string;
          competitor_name:        string;
          market_focus_score:     number;
          customer_segment_score: number;
          confidence:             number;
          rationale:              string | null;
        }[]).map((p) => {
          const radar = radarData.get(p.competitor_id);
          return {
            competitor_id:          p.competitor_id,
            competitor_name:        p.competitor_name,
            market_focus_score:     Number(p.market_focus_score),
            customer_segment_score: Number(p.customer_segment_score),
            confidence:             Number(p.confidence),
            rationale:              p.rationale,
            momentum_score:         radar?.momentum_score ?? 0,
            signals_7d:             radar?.signals_7d ?? 0,
            latest_movement_type:   radar?.latest_movement_type ?? null,
            website_url:            radar?.website_url ?? null,
            history:                historyMap.get(p.competitor_id) ?? [],
          };
        });
      }
    } catch {
      fetchError = true;
    }
  }

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

      {/* ── Mini header ───────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.20) 40%, rgba(46,230,166,0.35) 50%, rgba(46,230,166,0.20) 60%, transparent 100%)",
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

          {/* Page title */}
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[#0d2010]">|</span>
            <span className="text-[12px] font-medium text-slate-500">Market Map</span>
          </div>

          {lastUpdated && (
            <span className="hidden text-[11px] text-slate-700 xl:block">
              Updated{" "}
              {new Date(lastUpdated).toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          <Link href="/app/strategy" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Strategy</Link>
          <Link href="/app/briefs"   className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Briefs</Link>
          <Link href="/app/settings" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Settings</Link>
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

      {/* ── Error state ───────────────────────────────────────────────── */}
      {fetchError && (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-[14px] border border-[#1a2a1a] bg-[#0a140a] px-8 py-6 text-center">
            <p className="text-[13px] text-slate-600">
              Could not load market map. Run{" "}
              <code className="font-mono text-[12px] text-slate-500">007_market_map.sql</code>{" "}
              in Supabase, then trigger{" "}
              <code className="font-mono text-[12px] text-slate-500">POST /api/update-positioning</code>.
            </p>
          </div>
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────── */}
      {!fetchError && (
        <div className="relative z-10 flex-1 overflow-hidden">
          <MarketMap competitors={competitors} />
        </div>
      )}
    </div>
  );
}
