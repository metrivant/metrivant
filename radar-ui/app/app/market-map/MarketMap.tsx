"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CompetitorDetail } from "../../../lib/api";
import { formatRelative } from "../../../lib/format";
import { quadrantLabel } from "../../../lib/positioning";
import { capture } from "../../../lib/posthog";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapCompetitor = {
  competitor_id:          string;
  competitor_name:        string;
  market_focus_score:     number;
  customer_segment_score: number;
  confidence:             number;
  rationale:              string | null;
  momentum_score:         number;
  signals_7d:             number;
  latest_movement_type:   string | null;
  website_url:            string | null;
  history: Array<{
    market_focus_score:     number;
    customer_segment_score: number;
    recorded_at:            string;
  }>;
};

// ── SVG layout constants ──────────────────────────────────────────────────────

const SVG_W = 1100;
const SVG_H = 800;
const PX0 = 130; const PX1 = 970;
const PY0 =  80; const PY1 = 700;
const PW  = PX1 - PX0; // 840
const PH  = PY1 - PY0; // 620

function toX(score: number): number { return PX0 + (score / 100) * PW; }
function toY(score: number): number { return PY1 - (score / 100) * PH; }

const CENTER_X = (PX0 + PX1) / 2; // 550
const CENTER_Y = (PY0 + PY1) / 2; // 390

// ── Movement color + label ────────────────────────────────────────────────────

function getMovementColor(type: string | null): string {
  switch (type) {
    case "pricing_strategy_shift": return "#ff6b6b";
    case "product_expansion":      return "#57a6ff";
    case "market_reposition":      return "#34d399";
    case "enterprise_push":        return "#c084fc";
    case "ecosystem_expansion":    return "#facc15";
    default:                       return "#94a3b8";
  }
}

function getMovementLabel(type: string | null): string {
  if (!type) return "Dormant";
  return type.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function getNodeRadius(momentum: number): number {
  return Math.max(9, Math.min(30, 9 + Math.sqrt(Math.max(0, momentum)) * 2.2));
}

function getGlowOpacity(signals: number): number {
  if (signals > 5) return 0.22;
  if (signals > 0) return 0.12;
  return 0.05;
}

// ── Spatial isolation ─────────────────────────────────────────────────────────

const ISOLATION_RADIUS = 150;

function computeIsolatedIds(competitors: MapCompetitor[]): Set<string> {
  const isolated = new Set<string>();
  for (const a of competitors) {
    const ax = toX(a.market_focus_score);
    const ay = toY(a.customer_segment_score);
    const hasNeighbor = competitors.some((b) => {
      if (b.competitor_id === a.competitor_id) return false;
      const dx = toX(b.market_focus_score) - ax;
      const dy = toY(b.customer_segment_score) - ay;
      return Math.sqrt(dx * dx + dy * dy) < ISOLATION_RADIUS;
    });
    if (!hasNeighbor) isolated.add(a.competitor_id);
  }
  return isolated;
}

// ── MapNode ───────────────────────────────────────────────────────────────────

type NodeProps = {
  competitor:  MapCompetitor;
  isSelected:  boolean;
  isDimmed:    boolean;
  isIsolated:  boolean;
  onSelect:    (id: string) => void;
  onHoverIn:   (comp: MapCompetitor, cx: number, cy: number) => void;
  onHoverOut:  () => void;
};

const MapNode = memo(function MapNode({
  competitor,
  isSelected,
  isDimmed,
  isIsolated,
  onSelect,
  onHoverIn,
  onHoverOut,
}: NodeProps) {
  const x     = toX(competitor.market_focus_score);
  const y     = toY(competitor.customer_segment_score);
  const color = getMovementColor(competitor.latest_movement_type);
  const r     = getNodeRadius(competitor.momentum_score);
  const glow  = getGlowOpacity(competitor.signals_7d);

  return (
    <g
      onClick={() => onSelect(competitor.competitor_id)}
      onMouseEnter={(e) => onHoverIn(competitor, e.clientX, e.clientY)}
      onMouseLeave={onHoverOut}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ cursor: "pointer" }}
      opacity={isDimmed ? 0.16 : 1}
    >
      {/* Atmospheric glow halo */}
      <circle
        cx={x} cy={y}
        r={r + (competitor.signals_7d > 5 ? 26 : 16)}
        fill={color}
        opacity={glow}
        filter="url(#mapNodeGlow)"
      />

      {/* Selected outer pulse ring */}
      {isSelected && (
        <motion.circle
          cx={x} cy={y}
          r={r + 12}
          fill="none"
          stroke={color}
          strokeWidth="1"
          animate={{ opacity: [0.25, 0.65, 0.25] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Selected bloom */}
      {isSelected && (
        <circle
          cx={x} cy={y}
          r={r + 28}
          fill={color}
          opacity="0.06"
          filter="url(#mapNodeGlowStrong)"
        />
      )}

      {/* Isolation ring — no neighbor within 150 SVG units */}
      {isIsolated && !isSelected && (
        <circle
          cx={x} cy={y}
          r={r + 18}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
      )}

      {/* Main node — filled disc */}
      <motion.circle
        cx={x} cy={y} r={r}
        fill={color}
        filter={isSelected ? "url(#mapNodeGlowStrong)" : "url(#mapNodeGlow)"}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.38, type: "spring", stiffness: 240, damping: 22 }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />

      {/* Node inner dot */}
      <circle cx={x} cy={y} r={2.5} fill="rgba(0,0,0,0.5)" pointerEvents="none" />

      {/* Label */}
      <text
        x={x} y={y + r + 16}
        textAnchor="middle"
        fill={isSelected ? "#e2f5e2" : "#3a5a3a"}
        fontSize="11"
        fontWeight={isSelected ? "600" : "400"}
        fontFamily="'Courier New', Monaco, monospace"
        letterSpacing="0.04em"
        pointerEvents="none"
      >
        {competitor.competitor_name}
      </text>
    </g>
  );
});

// ── MovementTrail ─────────────────────────────────────────────────────────────

function MovementTrail({ competitor }: { competitor: MapCompetitor }) {
  if (competitor.history.length < 1) return null;

  const color = getMovementColor(competitor.latest_movement_type);
  const current = {
    x: toX(competitor.market_focus_score),
    y: toY(competitor.customer_segment_score),
  };

  const histPoints = competitor.history
    .slice(-5)
    .map((h) => ({ x: toX(h.market_focus_score), y: toY(h.customer_segment_score) }));

  const allPoints = [...histPoints, current];
  if (allPoints.length < 2) return null;

  return (
    <g pointerEvents="none">
      {allPoints.slice(0, -1).map((pt, i) => {
        const next       = allPoints[i + 1];
        const segOpacity = ((i + 1) / allPoints.length) * 0.45;
        return (
          <line
            key={i}
            x1={pt.x}  y1={pt.y}
            x2={next.x} y2={next.y}
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            opacity={segOpacity}
          />
        );
      })}
      {/* Faded origin marker */}
      <circle
        cx={allPoints[0].x}
        cy={allPoints[0].y}
        r={3.5}
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.22"
      />
    </g>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

type DrawerProps = {
  competitor:  MapCompetitor;
  detail:      CompetitorDetail | null;
  loading:     boolean;
  error:       boolean;
  onClose:     () => void;
};

function DetailDrawer({ competitor, detail, loading, error, onClose }: DrawerProps) {
  const color = getMovementColor(competitor.latest_movement_type);
  const quad  = quadrantLabel(competitor.market_focus_score, competitor.customer_segment_score);

  const topSignal = detail?.signals?.length
    ? [...detail.signals].sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0))[0]
    : null;

  return (
    <motion.div
      key="map-drawer"
      className="absolute right-0 top-0 bottom-0 z-20 w-[360px] overflow-y-auto p-6"
      style={{
        background: "rgba(0,2,0,0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderLeft: `2px solid ${color}45`,
        boxShadow: `-16px 0 60px rgba(0,0,0,0.8), inset 1px 0 0 ${color}10`,
      }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
      />

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.30em]"
            style={{ color: `${color}70` }}
          >
            Field Assessment
          </div>
          <h2 className="text-[21px] font-bold leading-tight tracking-tight text-white">
            {competitor.competitor_name}
          </h2>
          {competitor.website_url && (
            <a
              href={competitor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block font-mono text-[10px] text-slate-600 transition-colors hover:text-slate-400"
            >
              {competitor.website_url.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{
                backgroundColor: `${color}16`,
                color,
                border: `1px solid ${color}28`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {getMovementLabel(competitor.latest_movement_type)}
            </span>
            <span className="rounded-[6px] border border-[#152415] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
              {quad}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#1a2030] text-slate-500 transition-colors hover:border-[#2a4a30] hover:text-slate-300"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div
        className="mb-5 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}25 40%, ${color}25 60%, transparent)` }}
      />

      {/* Coordinate scores */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          {
            label: "Market Focus",
            value: Math.round(competitor.market_focus_score),
            sub: competitor.market_focus_score >= 60 ? "Broad platform" : competitor.market_focus_score >= 40 ? "Multi-feature" : "Specialist",
          },
          {
            label: "Customer Seg.",
            value: Math.round(competitor.customer_segment_score),
            sub: competitor.customer_segment_score >= 65 ? "Enterprise" : competitor.customer_segment_score >= 40 ? "Mid-market" : "SMB / Teams",
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-[10px] border border-[#0d1e0d] bg-[#030803] p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">{label}</div>
            <div className="mt-1.5 text-[22px] font-bold tabular-nums text-slate-100">{value}</div>
            <div className="mt-0.5 font-mono text-[9px] text-slate-700">{sub}</div>
          </div>
        ))}
      </div>

      {/* Positioning basis */}
      {competitor.rationale && (
        <div className="mb-4 rounded-[10px] border border-[#0d1e0d] bg-[#030803] px-4 py-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
              Intelligence basis
            </div>
            <span className="font-mono text-[9px] tabular-nums" style={{ color: `${color}70` }}>
              {Math.round(competitor.confidence * 100)}% conf
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            {competitor.rationale}
          </p>
        </div>
      )}

      {/* Momentum + signals */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-[#0d1e0d] bg-[#030803] p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">Momentum</div>
          <div className="mt-1 text-[17px] font-bold tabular-nums text-slate-200">
            {Number(competitor.momentum_score).toFixed(1)}
          </div>
        </div>
        <div className="rounded-[10px] border border-[#0d1e0d] bg-[#030803] p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">Signals 7d</div>
          <div className="mt-1 text-[17px] font-bold tabular-nums text-slate-200">
            {competitor.signals_7d}
          </div>
        </div>
      </div>

      {/* Latest signal */}
      {loading && (
        <div className="h-14 animate-pulse rounded-[10px] bg-[#030803]" />
      )}
      {!loading && !error && topSignal?.summary && (
        <div className="mb-4 rounded-[10px] border border-[#0d1e0d] bg-[#030803] px-4 py-3.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
            Latest signal
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            {topSignal.summary}
          </p>
          {topSignal.detected_at && (
            <div className="mt-1.5 font-mono text-[9px] text-slate-700">
              {formatRelative(topSignal.detected_at)}
            </div>
          )}
        </div>
      )}

      {/* Link to radar */}
      <a
        href="/app"
        className="flex items-center gap-1.5 font-mono text-[10px] transition-opacity"
        style={{ color: "rgba(0,180,255,0.55)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,180,255,0.90)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,180,255,0.55)")}
      >
        <svg width="11" height="11" viewBox="0 0 46 46" fill="none" aria-hidden="true">
          <circle cx="23" cy="23" r="21.5" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6" />
          <circle cx="23" cy="23" r="13"   stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="23" cy="23" r="2.5"  fill="currentColor" />
        </svg>
        View in Radar →
      </a>
    </motion.div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

type TooltipState = {
  competitor: MapCompetitor;
  screenX:    number;
  screenY:    number;
};

// ── Compass Rose ──────────────────────────────────────────────────────────────

function CompassRose({ cx, cy }: { cx: number; cy: number }) {
  const r = 22;
  return (
    <g pointerEvents="none" opacity="0.28">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,180,255,0.35)" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={r * 0.38} fill="none" stroke="rgba(0,180,255,0.20)" strokeWidth="0.6" />
      {/* Cardinal spokes */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1  = cx + Math.sin(rad) * r * 0.42;
        const y1  = cy - Math.cos(rad) * r * 0.42;
        const x2  = cx + Math.sin(rad) * r * 0.96;
        const y2  = cy - Math.cos(rad) * r * 0.96;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,180,255,0.50)" strokeWidth="0.8" />;
      })}
      {/* Ordinal tick marks */}
      {[45, 135, 225, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1  = cx + Math.sin(rad) * r * 0.62;
        const y1  = cy - Math.cos(rad) * r * 0.62;
        const x2  = cx + Math.sin(rad) * r * 0.88;
        const y2  = cy - Math.cos(rad) * r * 0.88;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,180,255,0.28)" strokeWidth="0.6" />;
      })}
      {/* N label */}
      <text x={cx} y={cy - r - 5} textAnchor="middle" dominantBaseline="auto"
        fill="rgba(0,180,255,0.50)" fontSize="7" fontFamily="'Courier New', monospace" fontWeight="700"
        letterSpacing="0.08em">
        N
      </text>
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={1.8} fill="rgba(0,180,255,0.55)" />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { competitors: MapCompetitor[] };

export default function MarketMap({ competitors }: Props) {
  const svgRef       = useRef<SVGSVGElement>(null);
  const isDragging   = useRef(false);
  const dragStartScr = useRef({ x: 0, y: 0 });
  const dragStartVb  = useRef({ x: 0, y: 0, w: SVG_W, h: SVG_H });

  const [vb, setVb] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showTrails,  setShowTrails]  = useState(true);
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null);
  const [detail,      setDetail]      = useState<CompetitorDetail | null>(null);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [detailError, setDetailError] = useState(false);

  const selected    = selectedId
    ? (competitors.find((c) => c.competitor_id === selectedId) ?? null)
    : null;
  const isolatedIds = useMemo(() => computeIsolatedIds(competitors), [competitors]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailLoad(false); setDetailError(false); return; }
    setDetailLoad(true);
    setDetail(null);
    setDetailError(false);
    fetch(`/api/competitor-detail?id=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((json) => { if (json.ok) setDetail(json); else setDetailError(true); })
      .catch(() => setDetailError(true))
      .finally(() => setDetailLoad(false));
  }, [selectedId]);

  useEffect(() => {
    capture("market_map_viewed", { competitor_count: competitors.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      const rect   = svg.getBoundingClientRect();
      setVb((prev) => {
        const scaleX = prev.w / rect.width;
        const scaleY = prev.h / rect.height;
        const mx = prev.x + (e.clientX - rect.left) * scaleX;
        const my = prev.y + (e.clientY - rect.top)  * scaleY;
        const newW = Math.max(300, Math.min(SVG_W * 2, prev.w * factor));
        const newH = Math.max(200, Math.min(SVG_H * 2, prev.h * factor));
        return {
          x: mx - (mx - prev.x) / prev.w * newW,
          y: my - (my - prev.y) / prev.h * newH,
          w: newW,
          h: newH,
        };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    isDragging.current   = true;
    dragStartScr.current = { x: e.clientX, y: e.clientY };
    dragStartVb.current  = { ...vb };
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDragging.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect   = svg.getBoundingClientRect();
    const scaleX = dragStartVb.current.w / rect.width;
    const scaleY = dragStartVb.current.h / rect.height;
    const dx = (dragStartScr.current.x - e.clientX) * scaleX;
    const dy = (dragStartScr.current.y - e.clientY) * scaleY;
    setVb({ ...dragStartVb.current, x: dragStartVb.current.x + dx, y: dragStartVb.current.y + dy });
  }

  function stopPan() { isDragging.current = false; }
  function resetView() { setVb({ x: 0, y: 0, w: SVG_W, h: SVG_H }); }

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    capture("competitor_position_inspected", { competitor_id: id });
  }, []);

  const handleHoverIn  = useCallback((comp: MapCompetitor, screenX: number, screenY: number) => {
    setTooltip({ competitor: comp, screenX, screenY });
  }, []);
  const handleHoverOut = useCallback(() => setTooltip(null), []);

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  // Coordinate grid lines (every ~84px = 10 score units)
  const gridXLines = Array.from({ length: 9 }, (_, i) => toX((i + 1) * 10));
  const gridYLines = Array.from({ length: 9 }, (_, i) => toY((i + 1) * 10));

  return (
    <div className="relative flex h-full flex-col overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-between px-5 py-2.5"
        style={{ borderBottom: "1px solid #0a1c0a", background: "rgba(0,1,0,0.97)" }}
      >
        <div className="flex items-center gap-3">
          {/* Trail toggle */}
          <button
            onClick={() => setShowTrails((v) => !v)}
            className="flex items-center gap-1.5 rounded-[7px] border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors"
            style={{
              borderColor:     showTrails ? "rgba(0,180,255,0.28)" : "#0d1020",
              color:           showTrails ? "#00B4FF" : "#3a5a3a",
              backgroundColor: showTrails ? "rgba(0,180,255,0.06)" : "transparent",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1 7.5L3.5 4.5l1.8 1.8L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Routes
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            {[
              {
                label: "+",
                aria: "Zoom in",
                action: () => setVb((v) => {
                  const f = 0.8;
                  return { x: v.x + v.w*(1-f)/2, y: v.y + v.h*(1-f)/2, w: v.w*f, h: v.h*f };
                }),
              },
              {
                label: "−",
                aria: "Zoom out",
                action: () => setVb((v) => {
                  const f = 1.25;
                  return { x: v.x - v.w*(f-1)/2, y: v.y - v.h*(f-1)/2, w: Math.min(v.w*f, SVG_W*2), h: Math.min(v.h*f, SVG_H*2) };
                }),
              },
            ].map(({ label, aria, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#0d1020] font-mono text-[13px] text-slate-700 transition-colors hover:border-[#1a3a1a] hover:text-slate-300"
                aria-label={aria}
              >
                {label}
              </button>
            ))}
            <button
              onClick={resetView}
              className="flex h-7 items-center justify-center rounded-[6px] border border-[#0d1020] px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-[#1a3a1a] hover:text-slate-300"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00B4FF]" style={{ boxShadow: "0 0 4px rgba(0,180,255,0.7)" }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-700">
            {competitors.length} rival{competitors.length !== 1 ? "s" : ""} charted
          </span>
          <span className="text-[#0d1020]">·</span>
          <span className="font-mono text-[10px] text-slate-800">scroll or drag to navigate</span>
        </div>
      </div>

      {/* ── Map area ──────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full"
          role="img"
          aria-label="Competitive market map"
          style={{ cursor: isDragging.current ? "grabbing" : "grab", background: "#000100" }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          <defs>
            <filter id="mapNodeGlow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="mapNodeGlowStrong" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="16" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="centerGlow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="30" />
            </filter>

            {/* Fine coordinate grid pattern */}
            <pattern id="coordGrid" x="0" y="0" width="84" height="62" patternUnits="userSpaceOnUse">
              <path d="M 84 0 L 0 0 0 62" fill="none" stroke="rgba(0,180,255,0.04)" strokeWidth="0.5" />
            </pattern>

            {/* Subtle amber warmth gradient at center */}
            <radialGradient id="centerWarmth" cx="50%" cy="50%" r="40%">
              <stop offset="0%"   stopColor="rgba(180,140,60,0.018)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Full background */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#000100" />

          {/* Coordinate grid */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#coordGrid)" />

          {/* Amber warmth tint at center */}
          <rect x={PX0} y={PY0} width={PW} height={PH} fill="url(#centerWarmth)" />

          {/* ── Plot area ─────────────────────────────────────────────── */}

          {/* Plot area base fill */}
          <rect x={PX0} y={PY0} width={PW} height={PH} fill="rgba(3,8,3,0.6)" />

          {/* Fine grid lines inside plot */}
          {gridXLines.map((x) => (
            <line key={`gx-${x}`} x1={x} y1={PY0} x2={x} y2={PY1}
              stroke="rgba(0,180,255,0.05)" strokeWidth="0.5" />
          ))}
          {gridYLines.map((y) => (
            <line key={`gy-${y}`} x1={PX0} y1={y} x2={PX1} y2={y}
              stroke="rgba(0,180,255,0.05)" strokeWidth="0.5" />
          ))}

          {/* Quadrant subtle fills */}
          {[
            { x: PX0,     y: PY0,     w: PW/2, h: PH/2 },
            { x: CENTER_X, y: PY0,    w: PW/2, h: PH/2 },
            { x: PX0,     y: CENTER_Y, w: PW/2, h: PH/2 },
            { x: CENTER_X, y: CENTER_Y, w: PW/2, h: PH/2 },
          ].map(({ x, y, w, h }, i) => (
            <rect key={i} x={x} y={y} width={w} height={h}
              fill="rgba(0,180,255,0.008)" stroke="none" />
          ))}

          {/* Quadrant divider lines */}
          <line
            x1={CENTER_X} y1={PY0} x2={CENTER_X} y2={PY1}
            stroke="rgba(0,180,255,0.12)" strokeWidth="1" strokeDasharray="8 6"
          />
          <line
            x1={PX0} y1={CENTER_Y} x2={PX1} y2={CENTER_Y}
            stroke="rgba(0,180,255,0.12)" strokeWidth="1" strokeDasharray="8 6"
          />

          {/* Quadrant labels — operational zone names */}
          {[
            { lx: PX0 + PW*0.25, ly: PY0 + PH*0.25, line1: "PRECISION", line2: "INSTRUMENTS" },
            { lx: PX0 + PW*0.75, ly: PY0 + PH*0.25, line1: "MARKET",    line2: "DOMINANCE"   },
            { lx: PX0 + PW*0.25, ly: PY0 + PH*0.75, line1: "CRAFT",     line2: "SPECIALISTS"  },
            { lx: PX0 + PW*0.75, ly: PY0 + PH*0.75, line1: "BROAD",     line2: "REACH"        },
          ].map(({ lx, ly, line1, line2 }) => (
            <g key={line1} pointerEvents="none">
              <text x={lx} y={ly - 8} textAnchor="middle"
                fill="rgba(0,180,255,0.065)" fontSize="11" fontWeight="700"
                fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.20em">
                {line1}
              </text>
              <text x={lx} y={ly + 8} textAnchor="middle"
                fill="rgba(0,180,255,0.065)" fontSize="11" fontWeight="700"
                fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.20em">
                {line2}
              </text>
            </g>
          ))}

          {/* Center astrolabe glow */}
          <circle cx={CENTER_X} cy={CENTER_Y} r={60}
            fill="rgba(0,180,255,0.015)" filter="url(#centerGlow)" />

          {/* Center crosshair */}
          <g pointerEvents="none" opacity="0.22">
            <line x1={CENTER_X - 12} y1={CENTER_Y} x2={CENTER_X + 12} y2={CENTER_Y}
              stroke="rgba(0,180,255,0.55)" strokeWidth="0.8" />
            <line x1={CENTER_X} y1={CENTER_Y - 12} x2={CENTER_X} y2={CENTER_Y + 12}
              stroke="rgba(0,180,255,0.55)" strokeWidth="0.8" />
            <circle cx={CENTER_X} cy={CENTER_Y} r={4}
              fill="none" stroke="rgba(0,180,255,0.35)" strokeWidth="0.7" />
            <circle cx={CENTER_X} cy={CENTER_Y} r={18}
              fill="none" stroke="rgba(0,180,255,0.15)" strokeWidth="0.5" strokeDasharray="3 4" />
          </g>

          {/* Plot outer border — double line */}
          <rect
            x={PX0 + 4} y={PY0 + 4} width={PW - 8} height={PH - 8}
            fill="none" stroke="rgba(0,180,255,0.06)" strokeWidth="0.5"
          />
          <rect
            x={PX0} y={PY0} width={PW} height={PH}
            fill="none" stroke="rgba(0,180,255,0.18)" strokeWidth="1"
          />

          {/* Corner bracket marks */}
          {[
            [PX0, PY0, 1, 1],
            [PX1, PY0, -1, 1],
            [PX0, PY1, 1, -1],
            [PX1, PY1, -1, -1],
          ].map(([cx, cy, sx, sy], i) => (
            <g key={i} stroke="rgba(0,180,255,0.30)" strokeWidth="1" fill="none" pointerEvents="none">
              <line x1={cx} y1={cy} x2={cx + sx * 12} y2={cy} />
              <line x1={cx} y1={cy} x2={cx}           y2={cy + sy * 12} />
            </g>
          ))}

          {/* ── Axis labels ──────────────────────────────────────────── */}

          {/* X axis */}
          <text x={PX0} y={PY1 + 26} fill="rgba(0,180,255,0.32)" fontSize="10"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.15em">
            NICHE · SPECIALIST
          </text>
          <text x={PX1} y={PY1 + 26} fill="rgba(0,180,255,0.32)" fontSize="10"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.15em"
            textAnchor="end">
            BROAD · PLATFORM
          </text>
          <text x={CENTER_X} y={PY1 + 48} fill="rgba(0,180,255,0.18)" fontSize="9"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.22em"
            textAnchor="middle">
            ← MARKET FOCUS →
          </text>

          {/* Y axis */}
          <text
            x={PX0 - 20} y={PY1}
            fill="rgba(0,180,255,0.32)" fontSize="10"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.15em"
            transform={`rotate(-90, ${PX0 - 20}, ${CENTER_Y})`}
            textAnchor="end"
          >
            SMB · TEAMS
          </text>
          <text
            x={PX0 - 20} y={PY0 + 24}
            fill="rgba(0,180,255,0.32)" fontSize="10"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.15em"
            transform={`rotate(-90, ${PX0 - 20}, ${CENTER_Y})`}
            textAnchor="start"
          >
            ENTERPRISE
          </text>
          <text
            x={PX0 - 42} y={CENTER_Y}
            fill="rgba(0,180,255,0.18)" fontSize="9"
            fontWeight="700" fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.22em"
            transform={`rotate(-90, ${PX0 - 42}, ${CENTER_Y})`}
            textAnchor="middle"
          >
            ↑ CUSTOMER SEGMENT ↑
          </text>

          {/* ── Score tick marks ─────────────────────────────────────── */}
          {[25, 50, 75].map((tick) => (
            <g key={`tick-${tick}`} pointerEvents="none">
              <line x1={toX(tick)} y1={PY1} x2={toX(tick)} y2={PY1 + 5}
                stroke="rgba(0,180,255,0.20)" strokeWidth="1" />
              <text x={toX(tick)} y={PY1 + 16} textAnchor="middle"
                fill="rgba(0,180,255,0.18)" fontSize="8"
                fontFamily="'Courier New', Monaco, monospace">
                {tick}
              </text>
              <line x1={PX0 - 5} y1={toY(tick)} x2={PX0} y2={toY(tick)}
                stroke="rgba(0,180,255,0.20)" strokeWidth="1" />
              <text x={PX0 - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle"
                fill="rgba(0,180,255,0.18)" fontSize="8"
                fontFamily="'Courier New', Monaco, monospace">
                {tick}
              </text>
            </g>
          ))}

          {/* ── Compass rose — top-right corner ──────────────────────── */}
          <CompassRose cx={PX1 - 40} cy={PY0 + 42} />

          {/* ── Movement trails ──────────────────────────────────────── */}
          {showTrails && competitors.map((c) => (
            <MovementTrail key={`trail-${c.competitor_id}`} competitor={c} />
          ))}

          {/* ── Competitor nodes ─────────────────────────────────────── */}
          {competitors.map((c) => (
            <MapNode
              key={c.competitor_id}
              competitor={c}
              isSelected={c.competitor_id === selectedId}
              isDimmed={selectedId !== null && c.competitor_id !== selectedId}
              isIsolated={isolatedIds.has(c.competitor_id)}
              onSelect={handleSelect}
              onHoverIn={handleHoverIn}
              onHoverOut={handleHoverOut}
            />
          ))}

          {/* ── Empty state ──────────────────────────────────────────── */}
          {competitors.length === 0 && (
            <g pointerEvents="none">
              <text x={CENTER_X} y={CENTER_Y - 14} textAnchor="middle" dominantBaseline="middle"
                fill="rgba(0,180,255,0.15)" fontSize="12"
                fontFamily="'Courier New', Monaco, monospace" fontWeight="700" letterSpacing="0.20em">
                NO POSITIONS CHARTED
              </text>
              <text x={CENTER_X} y={CENTER_Y + 8} textAnchor="middle" dominantBaseline="middle"
                fill="#0e2010" fontSize="9"
                fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.08em">
                Run positioning analysis to populate the map
              </text>
            </g>
          )}

          {/* ── Map legend — lower-left of plot ──────────────────────── */}
          {competitors.length > 0 && (() => {
            const lx = PX0 + 12;
            const ly = PY1 - 14;
            const legendItems = [
              { color: "#ff6b6b", label: "Pricing" },
              { color: "#57a6ff", label: "Product" },
              { color: "#34d399", label: "Reposition" },
              { color: "#c084fc", label: "Enterprise" },
              { color: "#94a3b8", label: "Dormant" },
            ];
            return (
              <g pointerEvents="none">
                <rect
                  x={lx - 6} y={ly - 12}
                  width={186} height={18}
                  fill="rgba(0,2,0,0.75)"
                  rx="3"
                  stroke="rgba(0,180,255,0.10)"
                  strokeWidth="0.5"
                />
                {legendItems.map(({ color, label }, i) => (
                  <g key={label} transform={`translate(${lx + i * 36}, ${ly})`}>
                    <circle cx={4} cy={-1} r={3.5} fill={color} opacity="0.85" />
                    <text x={10} y={3} dominantBaseline="middle"
                      fill="rgba(100,116,139,0.8)" fontSize="7.5"
                      fontFamily="'Courier New', Monaco, monospace" letterSpacing="0.05em">
                      {label}
                    </text>
                  </g>
                ))}
                <text x={lx + 180} y={ly + 2} textAnchor="end" dominantBaseline="middle"
                  fill="rgba(0,180,255,0.18)" fontSize="7"
                  fontFamily="'Courier New', Monaco, monospace">
                  ⊕ size = momentum
                </text>
              </g>
            );
          })()}

        </svg>

        {/* ── Intelligence drawer ───────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <DetailDrawer
              competitor={selected}
              detail={detail}
              loading={detailLoad}
              error={detailError}
              onClose={() => setSelectedId(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Hover tooltip ─────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-[8px] border border-[#1a2030] px-3 py-2"
          style={{
            left: tooltip.screenX + 14,
            top:  tooltip.screenY - 10,
            background: "rgba(0,3,0,0.95)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
          }}
        >
          <div className="font-mono text-[12px] font-semibold text-slate-100">
            {tooltip.competitor.competitor_name}
          </div>
          <div className="mt-1 flex items-center gap-2.5 font-mono text-[10px] tabular-nums text-slate-600">
            <span>Focus <span className="text-slate-300">{Math.round(tooltip.competitor.market_focus_score)}</span></span>
            <span className="text-slate-800">·</span>
            <span>Seg <span className="text-slate-300">{Math.round(tooltip.competitor.customer_segment_score)}</span></span>
          </div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em]"
            style={{ color: getMovementColor(tooltip.competitor.latest_movement_type) }}>
            {getMovementLabel(tooltip.competitor.latest_movement_type)}
          </div>
        </div>
      )}

    </div>
  );
}
