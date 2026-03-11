"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarCompetitor, CompetitorDetail } from "../../../lib/api";
import { getCompetitorDetail } from "../../../lib/api";
import { formatRelative } from "../../../lib/format";
import LemonadeStand from "./LemonadeStand";
import EducationOverlay from "./EducationOverlay";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMovementColor(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "#ff6b6b";
    case "product_expansion":      return "#57a6ff";
    case "market_reposition":      return "#34d399";
    case "enterprise_push":        return "#c084fc";
    case "ecosystem_expansion":    return "#facc15";
    default:                       return "#94a3b8";
  }
}

function getMovementLabel(t: string | null): string {
  if (!t) return "Quiet";
  return t.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function getSignalTypeLabel(signalType: string): string {
  switch (signalType) {
    case "price_point_change":  return "Pricing change";
    case "tier_change":         return "Tier change";
    case "feature_launch":      return "Feature launch";
    case "positioning_shift":   return "Positioning shift";
    case "content_strategy":    return "Content strategy";
    case "audience_targeting":  return "Audience targeting";
    default:                    return signalType.replace(/_/g, " ");
  }
}

/** Short uppercase callout label rendered above the stand */
function getCalloutLabel(movementType: string): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "PRICE WAR";
    case "product_expansion":      return "FEATURE PUSH";
    case "market_reposition":      return "REPOSITIONING";
    case "enterprise_push":        return "PREMIUM PUSH";
    case "ecosystem_expansion":    return "EXPANSION";
    default:                       return "MOVING";
  }
}

/**
 * Derive a single editorial sentence per stand for the drawer micro-layer.
 * Reads like a business observer's note, not a data label.
 */
function getLemonadeInterpretation(
  movementType: string | null,
  name: string
): string {
  switch (movementType) {
    case "pricing_strategy_shift":
      return `${name} changed its pricing — likely trying to attract more customers or defend against competitive pressure.`;
    case "product_expansion":
      return `${name} is expanding its offering — adding to what it sells to capture more of the market.`;
    case "market_reposition":
      return `${name} changed how it presents itself — targeting a different type of customer than before.`;
    case "enterprise_push":
      return `${name} is going upmarket — shifting focus toward larger, higher-value customers.`;
    case "ecosystem_expansion":
      return `${name} is building a wider moat — expanding integrations, partnerships, and platform reach.`;
    default:
      return `${name} is holding its position — no strategic changes detected recently.`;
  }
}

/**
 * Build the editorial Street Story sentence from live movement data.
 * Reads as a calm business observer's summary of the scene.
 */
function buildStreetStory(competitors: RadarCompetitor[]): string {
  const active = competitors.filter((c) => c.latest_movement_type);
  const n      = competitors.length;

  if (active.length === 0) {
    return `Quiet street. Metrivant is watching ${n} rival${n !== 1 ? "s" : ""} — no strategic moves detected right now.`;
  }

  const fragments: string[] = [];

  const pricers      = active.filter((c) => c.latest_movement_type === "pricing_strategy_shift");
  const builders     = active.filter((c) => c.latest_movement_type === "product_expansion");
  const repositioners = active.filter((c) => c.latest_movement_type === "market_reposition");
  const enterprise   = active.filter((c) => c.latest_movement_type === "enterprise_push");
  const ecosystem    = active.filter((c) => c.latest_movement_type === "ecosystem_expansion");

  if (pricers.length === 1)
    fragments.push(`${pricers[0].competitor_name} is cutting prices`);
  else if (pricers.length > 1)
    fragments.push(`${pricers.length} stands are fighting on price`);

  if (builders.length === 1)
    fragments.push(`${builders[0].competitor_name} is pushing new features`);
  else if (builders.length > 1)
    fragments.push(`${builders.length} stands are expanding their menu`);

  if (repositioners.length === 1)
    fragments.push(`${repositioners[0].competitor_name} is repositioning`);
  else if (repositioners.length > 1)
    fragments.push(`${repositioners.length} stands are shifting position`);

  if (enterprise.length === 1)
    fragments.push(`${enterprise[0].competitor_name} is chasing premium customers`);
  else if (enterprise.length > 1)
    fragments.push(`${enterprise.length} stands are pushing upmarket`);

  if (ecosystem.length === 1)
    fragments.push(`${ecosystem[0].competitor_name} is expanding its reach`);
  else if (ecosystem.length > 1)
    fragments.push(`${ecosystem.length} stands are expanding their ecosystems`);

  const top  = fragments.slice(0, 3);
  const body = top.join(". ") + ".";

  const quiet = n - active.length;
  const tail  = quiet > 0
    ? ` ${quiet} watching quietly. Metrivant is tracking all ${n}.`
    : ` Metrivant is tracking all ${n}.`;

  return body + tail;
}

// ── PostHog ───────────────────────────────────────────────────────────────────

function phCapture(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const k = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!k) return;
  fetch("https://app.posthog.com/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: k, event, properties: props ?? {} }),
  }).catch(() => null);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  competitors: RadarCompetitor[];
}

export default function LemonadeStreet({ competitors }: Props) {
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [detail, setDetail]               = useState<CompetitorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const streetRef                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    phCapture("lemonade_mode_opened", { competitor_count: competitors.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStandClick(competitorId: string) {
    if (selectedId === competitorId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(competitorId);
    setDetail(null);
    setLoadingDetail(true);
    phCapture("lemonade_stand_clicked", { competitor_id: competitorId });
    const d = await getCompetitorDetail(competitorId);
    setDetail(d);
    setLoadingDetail(false);
  }

  // Derived state
  const selectedCompetitor =
    competitors.find((c) => c.competitor_id === selectedId) ?? null;
  const accentColor  = getMovementColor(selectedCompetitor?.latest_movement_type ?? null);
  const storyText    = buildStreetStory(competitors);
  const activeCount  = competitors.filter((c) => c.latest_movement_type).length;
  const movingFast   = competitors.filter((c) => Number(c.momentum_score ?? 0) >= 3).length;
  const pricingCount = competitors.filter(
    (c) => c.latest_movement_type === "pricing_strategy_shift"
  ).length;
  const quietCount   = competitors.filter(
    (c) => !c.latest_movement_type && (c.signals_7d ?? 0) === 0
  ).length;
  const isQuietStreet = activeCount === 0;
  const hasAnyActive  = activeCount > 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">

      {/* ── Story Banner ────────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 border-b border-[#0c1e0c] px-7 py-4"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,12,5,0.98) 0%, rgba(3,8,3,0.95) 100%)",
        }}
      >
        {/* Subtle top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(217,119,6,0.15) 30%, rgba(217,119,6,0.28) 50%, rgba(217,119,6,0.15) 70%, transparent 100%)",
          }}
        />

        <div className="flex items-start justify-between gap-6">
          {/* Editorial story text */}
          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#d97706]/55">
                The Street Today
              </span>
              {/* Live indicator */}
              <span className="flex items-center gap-1">
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{
                    backgroundColor: isQuietStreet ? "#475569" : "#d97706",
                    boxShadow: isQuietStreet ? "none" : "0 0 6px rgba(217,119,6,0.7)",
                  }}
                />
              </span>
            </div>
            <p
              className="max-w-2xl text-[14px] leading-snug text-slate-300"
              style={{ fontStyle: "italic", letterSpacing: "0.01em" }}
            >
              {storyText}
            </p>
          </div>

          {/* How This Works */}
          <button
            onClick={() => setShowEducation(true)}
            className="mt-0.5 shrink-0 flex items-center gap-1.5 rounded-full border border-[#0d2010] px-3 py-1.5 text-[11px] text-slate-600 transition-colors hover:border-[#1a3a1a] hover:text-slate-300"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 4v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="5.5" cy="2.8" r="0.6" fill="currentColor" />
            </svg>
            How This Works
          </button>
        </div>
      </div>

      {/* ── Status Strip ─────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-[#0a1a0a] px-7 py-2"
        style={{ background: "rgba(2,5,2,0.97)" }}
      >
        {movingFast > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(217,119,6,0.10)",
              color: "#d97706",
              border: "1px solid rgba(217,119,6,0.20)",
            }}
          >
            <span
              className="h-[4px] w-[4px] rounded-full"
              style={{ background: "#d97706" }}
            />
            {movingFast} moving fast
          </span>
        )}

        {pricingCount > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(255,107,107,0.08)",
              color: "#ff6b6b",
              border: "1px solid rgba(255,107,107,0.18)",
            }}
          >
            <span
              className="h-[4px] w-[4px] rounded-full"
              style={{ background: "#ff6b6b" }}
            />
            {pricingCount} changing price{pricingCount !== 1 ? "s" : ""}
          </span>
        )}

        {quietCount > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(71,85,105,0.08)",
              color: "#475569",
              border: "1px solid rgba(71,85,105,0.15)",
            }}
          >
            <span
              className="h-[4px] w-[4px] rounded-full"
              style={{ background: "#475569" }}
            />
            {quietCount} monitored quietly
          </span>
        )}

        {isQuietStreet && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(71,85,105,0.06)",
              color: "#334155",
              border: "1px solid rgba(71,85,105,0.10)",
            }}
          >
            <span className="h-[4px] w-[4px] rounded-full bg-[#334155]" />
            Quiet street — {competitors.length} rivals monitored
          </span>
        )}

        {/* Spacer + total count right-aligned */}
        <div className="ml-auto text-[10px] text-slate-700">
          {competitors.length} total
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* ── Street ────────────────────────────────────────────────────── */}
        <div
          ref={streetRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#0f2010 transparent" }}
        >
          <div
            className="relative flex min-w-max items-end gap-6 px-14 pb-6 pt-14"
            style={{ minHeight: "100%" }}
          >
            {/* Sky / atmospheric depth gradient at top */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[80px]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(4,10,4,0.95) 0%, rgba(2,6,2,0.0) 100%)",
              }}
            />

            {/* Pavement surface */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[64px]"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, #060d06 50%, #040904 100%)",
                borderTop: "1px solid #0d1e0d",
              }}
            />

            {/* Sidewalk curb line — double-line premium treatment */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-[64px] h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #0f2010 8%, #162416 50%, #0f2010 92%, transparent 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-[60px] h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #0a1a0a 8%, #0d1e0d 50%, #0a1a0a 92%, transparent 100%)",
              }}
            />

            {/* Quiet street overlay */}
            {isQuietStreet && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="text-[13px] font-semibold uppercase tracking-[0.3em]"
                    style={{ color: "rgba(71,85,105,0.3)" }}
                  >
                    Quiet Street
                  </div>
                  <div
                    className="mt-1 text-[11px] tracking-[0.12em]"
                    style={{ color: "rgba(51,65,85,0.25)" }}
                  >
                    No major moves detected right now
                  </div>
                </div>
              </div>
            )}

            {/* Stand wrappers with callouts */}
            {competitors.map((c) => {
              const hasCallout =
                c.latest_movement_type !== null &&
                Number(c.momentum_score ?? 0) >= 2;
              const isDimmed =
                hasAnyActive && c.latest_movement_type === null;
              const calloutColor = getMovementColor(c.latest_movement_type);

              return (
                <div
                  key={c.competitor_id}
                  className="relative flex flex-col items-center"
                >
                  {/* Big Move Callout */}
                  <AnimatePresence>
                    {hasCallout && (
                      <motion.div
                        className="absolute z-20 whitespace-nowrap"
                        style={{
                          bottom: "calc(100% - 4px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                        }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          opacity: [0.7, 1, 0.7],
                          y: 0,
                        }}
                        transition={{
                          opacity: {
                            repeat: Infinity,
                            duration: 3,
                            ease: "easeInOut",
                          },
                          y: {
                            duration: 0.4,
                            ease: "easeOut",
                          },
                        }}
                      >
                        <div
                          className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em]"
                          style={{
                            background: `${calloutColor}16`,
                            color: calloutColor,
                            border: `1px solid ${calloutColor}35`,
                            boxShadow: `0 0 12px ${calloutColor}20`,
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          {getCalloutLabel(c.latest_movement_type!)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <LemonadeStand
                    competitor={c}
                    isSelected={selectedId === c.competitor_id}
                    isDimmed={isDimmed}
                    onClick={() => handleStandClick(c.competitor_id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Metrivant brand watermark (in-scene, screenshot-visible) ──── */}
        <div
          className="pointer-events-none absolute bottom-[72px] right-5 z-10 flex items-center gap-2"
          style={{ opacity: 0.18 }}
        >
          <svg width="14" height="14" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.4" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-white">
            METRIVANT
          </span>
        </div>

        {/* ── Intelligence drawer ───────────────────────────────────────── */}
        <AnimatePresence>
          {selectedId && (
            <motion.div
              key="lemonade-drawer"
              initial={{ x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 38 }}
              className="absolute right-0 top-0 h-full w-[360px] shrink-0 overflow-y-auto border-l border-[#0e2210] bg-[rgba(0,2,0,0.97)] backdrop-blur-xl"
              style={{
                boxShadow: `inset 0 1px 0 0 ${accentColor}12, -8px 0 40px rgba(0,0,0,0.7)`,
              }}
            >
              {/* Accent line */}
              <div
                className="absolute inset-x-0 top-0 h-[1px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}38 40%, ${accentColor}38 60%, transparent)`,
                }}
              />

              <div className="p-5">
                {/* Close */}
                <button
                  onClick={() => { setSelectedId(null); setDetail(null); }}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-slate-600 transition-colors hover:text-slate-300"
                  aria-label="Close drawer"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 2l10 10M12 2L2 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {selectedCompetitor && (
                  <>
                    {/* Name + movement badge */}
                    <div className="mb-4 pr-8">
                      <h2 className="text-[18px] font-bold tracking-wide text-white">
                        {selectedCompetitor.competitor_name}
                      </h2>
                      {selectedCompetitor.latest_movement_type && (
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={{
                            backgroundColor: `${accentColor}18`,
                            color: accentColor,
                            border: `1px solid ${accentColor}30`,
                          }}
                        >
                          <span
                            className="h-[5px] w-[5px] rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                          {getMovementLabel(selectedCompetitor.latest_movement_type)}
                        </span>
                      )}
                    </div>

                    {/* ── "Why This Matters" micro-layer ─────────────────── */}
                    <div
                      className="mb-4 rounded-[12px] border px-4 py-3.5"
                      style={{
                        borderColor: `${accentColor}22`,
                        background: `${accentColor}08`,
                      }}
                    >
                      <div
                        className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: `${accentColor}70` }}
                      >
                        What This Means
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-slate-300" style={{ fontStyle: "italic" }}>
                        {getLemonadeInterpretation(
                          selectedCompetitor.latest_movement_type,
                          selectedCompetitor.competitor_name
                        )}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "Momentum",
                          value: (selectedCompetitor.momentum_score ?? 0).toFixed(1),
                        },
                        {
                          label: "Signals 7d",
                          value: String(selectedCompetitor.signals_7d ?? 0),
                        },
                        {
                          label: "Confidence",
                          value:
                            selectedCompetitor.latest_movement_confidence != null
                              ? `${Math.round(
                                  Number(selectedCompetitor.latest_movement_confidence) * 100
                                )}%`
                              : "—",
                        },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-[10px] border border-[#0f2010] bg-[#070d07] px-3 py-2.5"
                        >
                          <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-600">
                            {label}
                          </div>
                          <div className="mt-0.5 text-[18px] font-semibold leading-none tabular-nums text-slate-200">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Technical movement summary */}
                    {selectedCompetitor.latest_movement_summary && (
                      <div className="mb-4 rounded-[10px] border border-[#0f2010] bg-[#070d07] px-3.5 py-3">
                        <p className="text-[12px] leading-relaxed text-slate-400">
                          {selectedCompetitor.latest_movement_summary}
                        </p>
                      </div>
                    )}

                    {/* Website */}
                    {selectedCompetitor.website_url && (
                      <a
                        href={selectedCompetitor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-4 flex items-center gap-2 text-[11px] text-slate-600 transition-colors hover:text-slate-400"
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M5.5 1.5a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.1" />
                          <path d="M5.5 1.5c-.8 1-1.3 2.4-1.3 4s.5 3 1.3 4" stroke="currentColor" strokeWidth="1.1" />
                          <path d="M5.5 1.5c.8 1 1.3 2.4 1.3 4s-.5 3-1.3 4" stroke="currentColor" strokeWidth="1.1" />
                          <line x1="1.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                        {selectedCompetitor.website_url.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </>
                )}

                {/* Loading */}
                {loadingDetail && (
                  <div className="flex items-center gap-2 py-4 text-[11px] text-slate-600">
                    <div className="h-3 w-3 animate-spin rounded-full border border-[#2EE6A6]/20 border-t-[#2EE6A6]/80" />
                    Loading intelligence…
                  </div>
                )}

                {/* Signal list */}
                {detail && detail.signals.length > 0 && (
                  <div className="mt-1">
                    <div className="mb-2.5 text-[10px] uppercase tracking-[0.18em] text-slate-600">
                      Recent Signals
                    </div>
                    <div className="space-y-2">
                      {detail.signals.slice(0, 6).map((s) => (
                        <div
                          key={s.id}
                          className="rounded-[10px] border border-[#0f2010] bg-[#060c06] px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-slate-400">
                              {getSignalTypeLabel(s.signal_type)}
                            </span>
                            <span className="text-[9.5px] text-slate-700">
                              {formatRelative(s.detected_at)}
                            </span>
                          </div>
                          {s.summary && (
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                              {s.summary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail && detail.signals.length === 0 && (
                  <div className="mt-2 rounded-[10px] border border-[#0f2010] bg-[#060c06] px-4 py-5 text-center">
                    <p className="text-[12px] text-slate-700">No signals detected yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Education overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEducation && (
          <EducationOverlay onClose={() => setShowEducation(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
