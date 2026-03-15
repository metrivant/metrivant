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
// Plot area bounds
const PX0 = 130; const PX1 = 970;
const PY0 =  80; const PY1 = 700;
const PW  = PX1 - PX0; // 840
const PH  = PY1 - PY0; // 620

// Convert data score (0-100) to SVG coordinates
function toX(score: number): number { return PX0 + (score / 100) * PW; }
function toY(score: number): number { return PY1 - (score / 100) * PH; } // inverted

const CENTER_X = (PX0 + PX1) / 2; // 550
const CENTER_Y = (PY0 + PY1) / 2; // 390

// ── Movement color ────────────────────────────────────────────────────────────

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

// ── MapNode ───────────────────────────────────────────────────────────────────

// ── Spatial isolation ─────────────────────────────────────────────────────────

const ISOLATION_RADIUS = 150; // SVG units

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
      onMouseDown={(e) => e.stopPropagation()} // prevent pan start on node click
      style={{ cursor: "pointer" }}
      opacity={isDimmed ? 0.18 : 1}
    >
      {/* Atmospheric glow halo */}
      <circle
        cx={x} cy={y}
        r={r + (competitor.signals_7d > 5 ? 22 : 14)}
        fill={color}
        opacity={glow}
        filter="url(#mapNodeGlow)"
      />

      {/* Selected outer ring */}
      {isSelected && (
        <motion.circle
          cx={x} cy={y}
          r={r + 10}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Selected bloom */}
      {isSelected && (
        <circle
          cx={x} cy={y}
          r={r + 24}
          fill={color}
          opacity="0.07"
          filter="url(#mapNodeGlowStrong)"
        />
      )}

      {/* Isolation ring — node has no neighbor within 150 SVG units */}
      {isIsolated && !isSelected && (
        <circle
          cx={x} cy={y}
          r={r + 16}
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      )}

      {/* Main node */}
      <motion.circle
        cx={x} cy={y} r={r}
        fill={color}
        filter={isSelected ? "url(#mapNodeGlowStrong)" : "url(#mapNodeGlow)"}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />

      {/* Label */}
      <text
        x={x} y={y + r + 15}
        textAnchor="middle"
        fill={isSelected ? "#ddf0dd" : "#4a6a4a"}
        fontSize="11.5"
        fontWeight={isSelected ? "600" : "400"}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.02em"
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

  // Last 5 history points + current position
  const histPoints = competitor.history
    .slice(-5)
    .map((h) => ({ x: toX(h.market_focus_score), y: toY(h.customer_segment_score) }));

  const allPoints = [...histPoints, current];
  if (allPoints.length < 2) return null;

  return (
    <g pointerEvents="none">
      {allPoints.slice(0, -1).map((pt, i) => {
        const next       = allPoints[i + 1];
        const segOpacity = ((i + 1) / allPoints.length) * 0.55;
        return (
          <line
            key={i}
            x1={pt.x}  y1={pt.y}
            x2={next.x} y2={next.y}
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity={segOpacity}
          />
        );
      })}
      {/* Ghost dot at oldest visible position */}
      <circle
        cx={allPoints[0].x}
        cy={allPoints[0].y}
        r={4}
        fill={color}
        opacity="0.20"
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
      className="absolute right-0 top-0 bottom-0 z-20 w-[360px] overflow-y-auto border-l border-[#0d2010] bg-[#030b03] p-6"
      style={{ boxShadow: `-8px 0 40px rgba(0,0,0,0.5), inset 0 1px 0 0 ${color}12` }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
            Map Position
          </div>
          <h2 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-100">
            {competitor.competitor_name}
          </h2>
          {competitor.website_url && (
            <a
              href={competitor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              {competitor.website_url.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em]"
              style={{
                backgroundColor: `${color}18`,
                color,
                border: `1px solid ${color}30`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {getMovementLabel(competitor.latest_movement_type)}
            </span>
            <span
              className="rounded-full border border-[#152415] px-2.5 py-1 text-[10px] uppercase tracking-[0.10em] text-slate-500"
            >
              {quad}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1c3a1c] bg-[#071207] text-slate-400 transition-colors hover:text-slate-200"
          aria-label="Close"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div
        className="mb-5 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}30 40%, ${color}30 60%, transparent)` }}
      />

      {/* Position scores */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-[#152415] bg-[#071507] p-3.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Market Focus</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-slate-100">
            {Math.round(competitor.market_focus_score)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-600">
            {competitor.market_focus_score >= 60
              ? "Broad platform"
              : competitor.market_focus_score >= 40
                ? "Multi-feature"
                : "Specialist"}
          </div>
        </div>
        <div className="rounded-[12px] border border-[#152415] bg-[#071507] p-3.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Customer Seg.</div>
          <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-slate-100">
            {Math.round(competitor.customer_segment_score)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-600">
            {competitor.customer_segment_score >= 65
              ? "Enterprise"
              : competitor.customer_segment_score >= 40
                ? "Mid-market"
                : "SMB / Teams"}
          </div>
        </div>
      </div>

      {/* Confidence + rationale */}
      {competitor.rationale && (
        <div className="mb-4 rounded-[12px] border border-[#152415] bg-[#071507] px-4 py-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Positioning basis
            </div>
            <span className="text-[10px] tabular-nums text-slate-600">
              {Math.round(competitor.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            {competitor.rationale}
          </p>
        </div>
      )}

      {/* Momentum + signals */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-[#152415] bg-[#071507] p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Momentum</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-200">
            {Number(competitor.momentum_score).toFixed(1)}
          </div>
        </div>
        <div className="rounded-[12px] border border-[#152415] bg-[#071507] p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Signals 7d</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-200">
            {competitor.signals_7d}
          </div>
        </div>
      </div>

      {/* Latest signal from detail */}
      {loading && (
        <div className="h-16 animate-pulse rounded-[12px] bg-[#071507]" />
      )}
      {!loading && !error && topSignal?.summary && (
        <div className="mb-4 rounded-[12px] border border-[#152415] bg-[#071507] px-4 py-3.5">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Latest signal
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            {topSignal.summary}
          </p>
          {topSignal.detected_at && (
            <div className="mt-1.5 text-[10px] text-slate-600">
              {formatRelative(topSignal.detected_at)}
            </div>
          )}
        </div>
      )}

      {/* Link to full radar view */}
      <a
        href="/app"
        className="flex items-center gap-1.5 text-[11px] text-[#2EE6A6]/70 transition-opacity hover:text-[#2EE6A6]"
      >
        <svg width="11" height="11" viewBox="0 0 46 46" fill="none" aria-hidden="true">
          <circle cx="23" cy="23" r="21.5" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6" />
          <circle cx="23" cy="23" r="13"   stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="23" cy="23" r="2.5"  fill="currentColor" />
        </svg>
        Open full intelligence in Radar →
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

// ── Main component ────────────────────────────────────────────────────────────

type Props = { competitors: MapCompetitor[] };

export default function MarketMap({ competitors }: Props) {
  const svgRef       = useRef<SVGSVGElement>(null);
  const isDragging   = useRef(false);
  const dragStartScr = useRef({ x: 0, y: 0 });
  const dragStartVb  = useRef({ x: 0, y: 0, w: SVG_W, h: SVG_H });

  // Viewbox state — zoom & pan by mutating this
  const [vb, setVb] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showTrails,  setShowTrails]  = useState(true);
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null);
  const [detail,      setDetail]      = useState<CompetitorDetail | null>(null);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [detailError, setDetailError] = useState(false);

  const selected = selectedId
    ? (competitors.find((c) => c.competitor_id === selectedId) ?? null)
    : null;

  const isolatedIds = useMemo(() => computeIsolatedIds(competitors), [competitors]);

  // Fetch competitor detail when selected
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

  // PostHog: market_map_viewed
  useEffect(() => {
    capture("market_map_viewed", { competitor_count: competitors.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel zoom — attach with {passive:false} so we can preventDefault
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

  // Pan handlers
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

  const handleHoverIn = useCallback((comp: MapCompetitor, screenX: number, screenY: number) => {
    setTooltip({ competitor: comp, screenX, screenY });
  }, []);

  const handleHoverOut = useCallback(() => setTooltip(null), []);

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#0a1c0a] bg-[rgba(2,8,2,0.95)] px-5 py-2.5">
        <div className="flex items-center gap-3">
          {/* Trail toggle */}
          <button
            onClick={() => setShowTrails((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              showTrails
                ? "border-[#2EE6A6]/30 bg-[#2EE6A6]/8 text-[#2EE6A6]"
                : "border-[#0d2010] text-slate-600 hover:text-slate-400"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 8L4 5l2 2 3-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Trails
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setVb((v) => {
                const f = 0.8;
                return { x: v.x + v.w * (1-f)/2, y: v.y + v.h * (1-f)/2, w: v.w*f, h: v.h*f };
              })}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#0d2010] text-slate-600 transition-colors hover:text-slate-300"
              aria-label="Zoom in"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => setVb((v) => {
                const f = 1.25;
                return { x: v.x - v.w*(f-1)/2, y: v.y - v.h*(f-1)/2, w: Math.min(v.w*f, SVG_W*2), h: Math.min(v.h*f, SVG_H*2) };
              })}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#0d2010] text-slate-600 transition-colors hover:text-slate-300"
              aria-label="Zoom out"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="flex h-7 items-center justify-center rounded border border-[#0d2010] px-2 text-[10px] text-slate-600 transition-colors hover:text-slate-300"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-700">
          {competitors.length} rival{competitors.length !== 1 ? "s" : ""} positioned
          &nbsp;·&nbsp;scroll or drag to navigate
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
          style={{ cursor: isDragging.current ? "grabbing" : "grab", background: "#010601" }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          <defs>
            <filter id="mapNodeGlow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="mapNodeGlowStrong" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Atmospheric dot grid */}
            <pattern id="dotGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.8" fill="rgba(46,230,166,0.08)" />
            </pattern>
          </defs>

          {/* Dot grid background */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#dotGrid)" />

          {/* ── Plot area ────────────────────────────────────────────── */}

          {/* Quadrant fills */}
          {[
            { x: PX0, y: PY0, w: PW/2, h: PH/2, label: "Specialist · Enterprise", lx: PX0 + PW*0.25, ly: PY0 + PH*0.25 },
            { x: CENTER_X, y: PY0, w: PW/2, h: PH/2, label: "Platform · Enterprise", lx: PX0 + PW*0.75, ly: PY0 + PH*0.25 },
            { x: PX0, y: CENTER_Y, w: PW/2, h: PH/2, label: "Specialist · SMB", lx: PX0 + PW*0.25, ly: PY0 + PH*0.75 },
            { x: CENTER_X, y: CENTER_Y, w: PW/2, h: PH/2, label: "Platform · SMB", lx: PX0 + PW*0.75, ly: PY0 + PH*0.75 },
          ].map(({ x, y, w, h, label, lx, ly }) => (
            <g key={label}>
              <rect x={x} y={y} width={w} height={h} fill="rgba(46,230,166,0.012)" stroke="none" />
              <text
                x={lx} y={ly}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(46,230,166,0.08)"
                fontSize="13" fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="0.10em"
                style={{ textTransform: "uppercase" } as React.CSSProperties}
                pointerEvents="none"
              >
                {label}
              </text>
            </g>
          ))}

          {/* Quadrant dividers */}
          <line
            x1={CENTER_X} y1={PY0} x2={CENTER_X} y2={PY1}
            stroke="rgba(46,230,166,0.14)" strokeWidth="1" strokeDasharray="6 5"
          />
          <line
            x1={PX0} y1={CENTER_Y} x2={PX1} y2={CENTER_Y}
            stroke="rgba(46,230,166,0.14)" strokeWidth="1" strokeDasharray="6 5"
          />

          {/* Plot border */}
          <rect
            x={PX0} y={PY0} width={PW} height={PH}
            fill="none" stroke="rgba(46,230,166,0.18)" strokeWidth="1"
          />

          {/* ── Axis labels ─────────────────────────────────────────── */}

          {/* X axis label — bottom */}
          <text x={PX0} y={PY1 + 28} fill="rgba(46,230,166,0.35)" fontSize="11"
            fontWeight="600" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.12em">
            NICHE / SPECIALIST
          </text>
          <text x={PX1} y={PY1 + 28} fill="rgba(46,230,166,0.35)" fontSize="11"
            fontWeight="600" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.12em"
            textAnchor="end">
            BROAD PLATFORM
          </text>
          <text x={CENTER_X} y={PY1 + 52} fill="rgba(46,230,166,0.22)" fontSize="10"
            fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.18em"
            textAnchor="middle">
            ← MARKET FOCUS →
          </text>

          {/* Y axis label — left */}
          <text
            x={PX0 - 18} y={PY1} fill="rgba(46,230,166,0.35)" fontSize="11"
            fontWeight="600" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.12em"
            transform={`rotate(-90, ${PX0 - 18}, ${CENTER_Y})`}
            textAnchor="end"
          >
            SMB / TEAMS
          </text>
          <text
            x={PX0 - 18} y={PY0 + 24} fill="rgba(46,230,166,0.35)" fontSize="11"
            fontWeight="600" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.12em"
            transform={`rotate(-90, ${PX0 - 18}, ${CENTER_Y})`}
            textAnchor="start"
          >
            ENTERPRISE
          </text>
          <text
            x={PX0 - 40} y={CENTER_Y} fill="rgba(46,230,166,0.22)" fontSize="10"
            fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.18em"
            transform={`rotate(-90, ${PX0 - 40}, ${CENTER_Y})`}
            textAnchor="middle"
          >
            ↑ CUSTOMER SEGMENT ↑
          </text>

          {/* ── Score tick marks ────────────────────────────────────── */}
          {[25, 50, 75].map((tick) => (
            <g key={`tick-${tick}`}>
              <line x1={toX(tick)} y1={PY1} x2={toX(tick)} y2={PY1+6}
                stroke="rgba(46,230,166,0.22)" strokeWidth="1" />
              <text x={toX(tick)} y={PY1 + 18} textAnchor="middle"
                fill="rgba(46,230,166,0.20)" fontSize="9"
                fontFamily="Inter, system-ui, sans-serif">
                {tick}
              </text>
              <line x1={PX0-6} y1={toY(tick)} x2={PX0} y2={toY(tick)}
                stroke="rgba(46,230,166,0.22)" strokeWidth="1" />
              <text x={PX0 - 10} y={toY(tick)} textAnchor="end" dominantBaseline="middle"
                fill="rgba(46,230,166,0.20)" fontSize="9"
                fontFamily="Inter, system-ui, sans-serif">
                {tick}
              </text>
            </g>
          ))}

          {/* ── Movement trails ─────────────────────────────────────── */}
          {showTrails && competitors.map((c) => (
            <MovementTrail key={`trail-${c.competitor_id}`} competitor={c} />
          ))}

          {/* ── Competitor nodes ────────────────────────────────────── */}
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
            <>
              <text x={CENTER_X} y={CENTER_Y - 10} textAnchor="middle" dominantBaseline="middle"
                fill="#1a3a1a" fontSize="13" fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="0.06em">
                NO POSITIONING DATA YET
              </text>
              <text x={CENTER_X} y={CENTER_Y + 12} textAnchor="middle" dominantBaseline="middle"
                fill="#0f2a0f" fontSize="10" fontFamily="Inter, system-ui, sans-serif">
                Run POST /api/update-positioning to generate
              </text>
            </>
          )}
        </svg>

        {/* ── Intelligence drawer ──────────────────────────────────── */}
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
          className="pointer-events-none fixed z-50 rounded-[10px] border border-[#1c3a1c] bg-[#030c03] px-3 py-2.5"
          style={{
            left: tooltip.screenX + 14,
            top:  tooltip.screenY - 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          <div className="text-[13px] font-semibold text-slate-100">
            {tooltip.competitor.competitor_name}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] tabular-nums text-slate-500">
            <span>
              Focus&nbsp;
              <span className="font-medium text-slate-300">
                {Math.round(tooltip.competitor.market_focus_score)}
              </span>
            </span>
            <span>·</span>
            <span>
              Segment&nbsp;
              <span className="font-medium text-slate-300">
                {Math.round(tooltip.competitor.customer_segment_score)}
              </span>
            </span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.10em]"
            style={{ color: getMovementColor(tooltip.competitor.latest_movement_type) }}>
            {getMovementLabel(tooltip.competitor.latest_movement_type)}
          </div>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-center gap-5 border-t border-[#0a1c0a] py-2.5">
        {(
          [
            { color: "#ff6b6b", label: "Pricing" },
            { color: "#57a6ff", label: "Product" },
            { color: "#34d399", label: "Market" },
            { color: "#c084fc", label: "Enterprise" },
            { color: "#94a3b8", label: "Dormant" },
          ] as { color: string; label: string }[]
        ).map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}55` }} />
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-600">
              {label}
            </span>
          </span>
        ))}
        <span className="text-[10px] text-slate-700">· node size = momentum</span>
      </div>
    </div>
  );
}
