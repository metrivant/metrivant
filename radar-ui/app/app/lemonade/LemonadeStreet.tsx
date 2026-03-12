"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarCompetitor, CompetitorDetail } from "../../../lib/api";
import { getCompetitorDetail } from "../../../lib/api";
import { formatRelative } from "../../../lib/format";
import LemonadeStand from "./LemonadeStand";
import EducationOverlay from "./EducationOverlay";
import { capture } from "../../../lib/posthog";

// ── Pixel-art constants ────────────────────────────────────────────────────────

const HUD_BG      = "#08080f";
const HUD_BORDER  = "#1a2244";
const MONO        = "ui-monospace, 'Courier New', monospace";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMovementColor(type: string | null): string {
  switch (type) {
    case "pricing_strategy_shift": return "#ff3333";
    case "product_expansion":      return "#3399ff";
    case "market_reposition":      return "#33ff88";
    case "enterprise_push":        return "#cc44ff";
    case "ecosystem_expansion":    return "#ffcc00";
    default:                       return "#667788";
  }
}

function getCalloutLabel(type: string): string {
  switch (type) {
    case "pricing_strategy_shift": return "PRICE WAR";
    case "product_expansion":      return "FEATURE PUSH";
    case "market_reposition":      return "REPOSITIONING";
    case "enterprise_push":        return "PREMIUM PUSH";
    case "ecosystem_expansion":    return "EXPANSION";
    default:                       return "MOVING";
  }
}

function getLemonadeNote(type: string | null, name: string): string {
  switch (type) {
    case "pricing_strategy_shift":
      return `${name} changed their prices — probably trying to attract more customers or fend off a rival.`;
    case "product_expansion":
      return `${name} added new items to their menu — expanding what they sell to grab more of the market.`;
    case "market_reposition":
      return `${name} repainted their stand — targeting a different type of customer than before.`;
    case "enterprise_push":
      return `${name} moved upmarket — shifting focus toward bigger, higher-value customers.`;
    case "ecosystem_expansion":
      return `${name} is setting up more stalls — building partnerships and expanding their reach.`;
    default:
      return `${name} is holding their position — no major moves detected right now.`;
  }
}

function getSignalTypeLabel(t: string): string {
  switch (t) {
    case "price_point_change":  return "Price change";
    case "tier_change":         return "Tier change";
    case "feature_launch":      return "Feature launch";
    case "positioning_shift":   return "Positioning shift";
    case "content_strategy":    return "Content strategy";
    case "audience_targeting":  return "Audience targeting";
    default:                    return t.replace(/_/g, " ");
  }
}

function getMarketHeat(cs: RadarCompetitor[]): { label: string; color: string } {
  const a = cs.filter((c) => c.latest_movement_type).length;
  if (a >= 4) return { label: "🔥 HOT",  color: "#ff3333" };
  if (a >= 2) return { label: "⚡ WARM", color: "#ffaa00" };
  if (a >= 1) return { label: "☁ MILD",  color: "#ffcc44" };
  return        { label: "❄ COOL",        color: "#4488cc" };
}

/** "New kid" = no activity ever detected — freshly added to tracking */
function isNewKid(c: RadarCompetitor): boolean {
  return c.signals_7d === 0 && c.latest_movement_type === null && c.last_signal_at === null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  competitors: RadarCompetitor[];
}

export default function LemonadeStreet({ competitors }: Props) {
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [detail,        setDetail]        = useState<CompetitorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showEducation, setShowEducation] = useState(false);

  useEffect(() => {
    capture("lemonade_mode_opened", { competitor_count: competitors.length });
    capture("street_viewed",        { competitor_count: competitors.length });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStandClick(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetail(null);
    setLoadingDetail(true);
    const name = competitors.find((c) => c.competitor_id === id)?.competitor_name ?? "";
    capture("stand_clicked", { competitor_id: id, competitor_name: name });
    const d = await getCompetitorDetail(id);
    setDetail(d);
    setLoadingDetail(false);
  }

  // Derived
  const selected   = competitors.find((c) => c.competitor_id === selectedId) ?? null;
  const accent     = getMovementColor(selected?.latest_movement_type ?? null);
  const heat       = getMarketHeat(competitors);
  const activeCount = competitors.filter((c) => c.latest_movement_type).length;
  const hasActive  = activeCount > 0;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ fontFamily: MONO, background: "#05050f" }}
    >

      {/* ══════════════ TOP HUD ══════════════════════════════════════════════ */}
      <div
        style={{
          background: HUD_BG,
          borderBottom: `2px solid ${HUD_BORDER}`,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Mode badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              background: "#ffcc00",
              color: "#000",
              fontSize: "9px",
              fontWeight: "bold",
              padding: "2px 9px",
              letterSpacing: "0.2em",
              boxShadow: "2px 2px 0 #000",
              whiteSpace: "nowrap",
            }}
          >
            LEMONADE MODE
          </div>
          <div style={{ fontSize: "9px", color: "#334455", letterSpacing: "0.12em" }}>
            TOP {competitors.length} RIVAL{competitors.length !== 1 ? "S" : ""}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "7px", color: "#334455", letterSpacing: "0.18em" }}>STANDS</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#6688cc",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {competitors.length}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: HUD_BORDER }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "7px", color: "#334455", letterSpacing: "0.18em" }}>ACTIVE</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: activeCount > 0 ? "#ffcc00" : "#334455",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {activeCount}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: HUD_BORDER }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "7px", color: "#334455", letterSpacing: "0.18em" }}>MARKET</div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                color: heat.color,
                lineHeight: 1,
                marginTop: 3,
                letterSpacing: "0.1em",
              }}
            >
              {heat.label}
            </div>
          </div>
        </div>

        {/* Activity pixel bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  background: i < activeCount ? "#ffcc00" : "#1a2233",
                  boxShadow: i < activeCount ? "0 0 5px #ffcc00" : "none",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setShowEducation(true)}
            style={{
              background: "transparent",
              border: `1px solid ${HUD_BORDER}`,
              color: "#334455",
              fontFamily: MONO,
              fontSize: "8px",
              padding: "3px 8px",
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            ? HELP
          </button>
        </div>
      </div>

      {/* ══════════════ STREET ═══════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

        {/* Sky */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, #080820 0%, #05050f 45%)",
            pointerEvents: "none",
          }}
        />
        {/* Stars */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            opacity: 0.05,
            pointerEvents: "none",
          }}
        />

        {/* Horizontal scroll */}
        <div
          style={{
            height: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: `${HUD_BORDER} transparent`,
          }}
        >
          <div
            style={{
              minWidth: "max-content",
              height: "100%",
              display: "flex",
              alignItems: "flex-end",
              paddingLeft: 64,
              paddingRight: 64,
              paddingBottom: 80,
              paddingTop: 72,
              gap: 44,
              position: "relative",
            }}
          >
            {/* Pavement */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 80,
                background: "#0c0c1e",
                borderTop: "2px solid #1a2233",
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0px, transparent 28px, #1a2233 28px, #1a2233 30px)",
                pointerEvents: "none",
              }}
            />

            {/* Empty state */}
            {competitors.length === 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: "11px", color: "#334455", letterSpacing: "0.3em" }}>
                  NO RIVALS TRACKED
                </div>
                <div style={{ fontSize: "9px", color: "#1a2233", letterSpacing: "0.18em" }}>
                  ADD COMPETITORS IN DISCOVER
                </div>
              </div>
            )}

            {/* Stands */}
            {competitors.map((c, i) => {
              const isDimmed  = hasActive && !c.latest_movement_type;
              const isNew     = isNewKid(c);
              const calloutColor = getMovementColor(c.latest_movement_type);
              const showCallout  =
                c.latest_movement_type !== null && Number(c.momentum_score ?? 0) >= 2;

              return (
                <div
                  key={c.competitor_id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  {/* Callout */}
                  {showCallout && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 10px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: calloutColor + "18",
                        border: `1px solid ${calloutColor}44`,
                        color: calloutColor,
                        fontFamily: MONO,
                        fontSize: "7px",
                        fontWeight: "bold",
                        padding: "3px 8px",
                        letterSpacing: "0.18em",
                        whiteSpace: "nowrap",
                        zIndex: 5,
                        boxShadow: `0 0 8px ${calloutColor}22`,
                      }}
                    >
                      ▼ {getCalloutLabel(c.latest_movement_type!)}
                    </div>
                  )}

                  <LemonadeStand
                    competitor={c}
                    isSelected={selectedId === c.competitor_id}
                    isDimmed={isDimmed}
                    isNew={isNew}
                    rank={i + 1}
                    onClick={() => handleStandClick(c.competitor_id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════ BOTTOM HUD ════════════════════════════════════════════ */}
      <div
        style={{
          background: HUD_BG,
          borderTop: `2px solid ${HUD_BORDER}`,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "8px", color: "#334466", letterSpacing: "0.2em" }}>
          {selected
            ? `► STAND SELECTED: ${selected.competitor_name.toUpperCase()}`
            : "► CLICK A STAND TO OPEN INTELLIGENCE"}
        </div>
        <div style={{ fontSize: "8px", color: "#1a2233", letterSpacing: "0.16em" }}>
          METRIVANT
        </div>
      </div>

      {/* ══════════════ STAND DETAIL CARD (bottom sheet) ═════════════════════ */}
      <AnimatePresence>
        {selectedId && selected && (
          <motion.div
            key="stand-detail"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              background: "#09091a",
              borderTop: `3px solid ${accent}`,
              maxHeight: "54vh",
              overflowY: "auto",
              fontFamily: MONO,
            }}
          >
            {/* Accent glow strip */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${accent}66 30%, ${accent}66 70%, transparent)`,
                pointerEvents: "none",
              }}
            />

            <div style={{ padding: "16px 20px 20px" }}>
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div>
                  {/* Rank + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div
                      style={{
                        background: accent,
                        color: "#000",
                        fontSize: "8px",
                        fontWeight: "bold",
                        padding: "2px 7px",
                        boxShadow: "2px 2px 0 #000",
                        letterSpacing: "0.14em",
                      }}
                    >
                      STAND INTEL
                    </div>
                    {selected.latest_movement_type && (
                      <div
                        style={{
                          border: `1px solid ${accent}55`,
                          color: accent,
                          fontSize: "8px",
                          fontWeight: "bold",
                          padding: "2px 7px",
                          letterSpacing: "0.12em",
                        }}
                      >
                        {selected.latest_movement_type.replace(/_/g, " ").toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#eeeeff",
                      letterSpacing: "0.05em",
                      lineHeight: 1,
                    }}
                  >
                    {selected.competitor_name}
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={() => { setSelectedId(null); setDetail(null); }}
                  style={{
                    background: "#13131f",
                    border: `1px solid ${HUD_BORDER}`,
                    color: "#445566",
                    fontFamily: MONO,
                    fontSize: "10px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    letterSpacing: "0.1em",
                    boxShadow: "2px 2px 0 #000",
                    flexShrink: 0,
                  }}
                >
                  ✕ CLOSE
                </button>
              </div>

              {/* "What this means" panel */}
              <div
                style={{
                  background: accent + "0d",
                  border: `1px solid ${accent}33`,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: "7px",
                    color: accent + "88",
                    letterSpacing: "0.2em",
                    marginBottom: 5,
                  }}
                >
                  WHAT THIS MEANS
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#aabbcc",
                    lineHeight: 1.6,
                    margin: 0,
                    fontStyle: "italic",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {getLemonadeNote(selected.latest_movement_type, selected.competitor_name)}
                </p>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {[
                  {
                    label: "SIGNALS 7D",
                    value: String(selected.signals_7d ?? 0),
                    color: (selected.signals_7d ?? 0) > 0 ? accent : "#334455",
                  },
                  {
                    label: "MOMENTUM",
                    value: Number(selected.momentum_score ?? 0).toFixed(1),
                    color: Number(selected.momentum_score ?? 0) > 0 ? accent : "#334455",
                  },
                  {
                    label: "CONFIDENCE",
                    value:
                      selected.latest_movement_confidence != null
                        ? `${Math.round(Number(selected.latest_movement_confidence) * 100)}%`
                        : "—",
                    color: "#6688aa",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    style={{
                      background: "#0d0d1e",
                      border: `1px solid ${HUD_BORDER}`,
                      padding: "8px 10px",
                      boxShadow: "2px 2px 0 #000",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "7px",
                        color: "#334455",
                        letterSpacing: "0.18em",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color,
                        lineHeight: 1,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Movement summary */}
              {selected.latest_movement_summary && (
                <div
                  style={{
                    background: "#0d0d1e",
                    border: `1px solid ${HUD_BORDER}`,
                    padding: "10px 12px",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{ fontSize: "7px", color: "#334455", letterSpacing: "0.18em", marginBottom: 6 }}
                  >
                    INTEL SUMMARY
                  </div>
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "#8899aa",
                      lineHeight: 1.6,
                      margin: 0,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {selected.latest_movement_summary}
                  </p>
                </div>
              )}

              {/* Loading */}
              {loadingDetail && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    fontSize: "9px",
                    color: "#445566",
                    letterSpacing: "0.16em",
                  }}
                >
                  <div
                    className="animate-spin"
                    style={{
                      width: 10,
                      height: 10,
                      border: `1px solid ${HUD_BORDER}`,
                      borderTop: `1px solid ${accent}`,
                    }}
                  />
                  LOADING SIGNALS…
                </div>
              )}

              {/* Signal list */}
              {detail && detail.signals.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "7px",
                      color: "#334455",
                      letterSpacing: "0.2em",
                      marginBottom: 8,
                    }}
                  >
                    RECENT SIGNALS ({Math.min(detail.signals.length, 6)})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {detail.signals.slice(0, 6).map((s) => (
                      <div
                        key={s.id}
                        style={{
                          background: "#0d0d1e",
                          border: `1px solid ${HUD_BORDER}`,
                          padding: "8px 12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: s.summary ? 5 : 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: "bold",
                              color: "#8899aa",
                              letterSpacing: "0.08em",
                            }}
                          >
                            {getSignalTypeLabel(s.signal_type).toUpperCase()}
                          </span>
                          <span style={{ fontSize: "8px", color: "#334455" }}>
                            {formatRelative(s.detected_at)}
                          </span>
                        </div>
                        {s.summary && (
                          <p
                            style={{
                              fontSize: "11px",
                              color: "#556677",
                              lineHeight: 1.5,
                              margin: 0,
                              fontFamily: "system-ui, sans-serif",
                            }}
                          >
                            {s.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail && detail.signals.length === 0 && (
                <div
                  style={{
                    background: "#0d0d1e",
                    border: `1px solid ${HUD_BORDER}`,
                    padding: "14px",
                    textAlign: "center",
                    fontSize: "9px",
                    color: "#334455",
                    letterSpacing: "0.18em",
                  }}
                >
                  NO SIGNALS DETECTED YET
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ EDUCATION OVERLAY ════════════════════════════════════ */}
      <AnimatePresence>
        {showEducation && (
          <EducationOverlay onClose={() => setShowEducation(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}
