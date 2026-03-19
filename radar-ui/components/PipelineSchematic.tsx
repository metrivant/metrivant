"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  StageStatus,
  StageDetail,
  PoolDetail,
  PipelineStatusResponse,
} from "../app/api/pipeline-status/route";

// ── Layout constants ─────────────────────────────────────────────────────────

const MAIN_Y = 85;
const CHAMBER_W = 90;
const CHAMBER_H = 42;

const STAGES = [
  { id: "capture",      idx: "01", label: "CAPTURE",   role: "Acquisition",    x: 75 },
  { id: "parse",        idx: "02", label: "EXTRACT",   role: "Segmentation",   x: 225 },
  { id: "baseline",     idx: "03", label: "BASELINE",  role: "Reference",      x: 375 },
  { id: "diff",         idx: "04", label: "DIFF",      role: "Detection",      x: 525 },
  { id: "signal",       idx: "05", label: "SIGNAL",    role: "Classification", x: 675 },
  { id: "intelligence", idx: "06", label: "INTERPRET",  role: "AI Analysis",   x: 825 },
  { id: "movement",     idx: "07", label: "MOVEMENT",  role: "Confirmation",   x: 975 },
  { id: "radar",        idx: "08", label: "RADAR",     role: "Surface",        x: 1125 },
];

const POOL_X_START = 450;
const POOL_SPACING = 75;
const POOL_Y = 300;
const POOL_W = 66;
const POOL_H = 28;
const MANIFOLD_Y = 250;
const JUNCTION_Y = 160;

const POOLS = [
  { id: "newsroom",    label: "NWS" },
  { id: "careers",     label: "CAR" },
  { id: "investor",    label: "INV" },
  { id: "product",     label: "PRD" },
  { id: "procurement", label: "PRC" },
  { id: "regulatory",  label: "REG" },
  { id: "media",       label: "MDA" },
];

const BRANCH_FORK_Y = 148;
const BRANCH_NODE_Y = 198;

// ── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<StageStatus, string> = {
  ok:      "#2EE6A6",
  warn:    "#f59e0b",
  stale:   "#ef4444",
  unknown: "#334155",
};

const STATUS_LABEL: Record<StageStatus, string> = {
  ok:      "Operational",
  warn:    "Delayed",
  stale:   "Degraded",
  unknown: "Checking",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "\u2014";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Types ────────────────────────────────────────────────────────────────────

type SelectedItem =
  | { type: "stage"; data: StageDetail }
  | { type: "pool";  data: PoolDetail };

// ── Main component ───────────────────────────────────────────────────────────

export default function PipelineSchematic({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<PipelineStatusResponse | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline-status");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch { /* keep last known state */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const getStage = (id: string): StageDetail | undefined =>
    data?.stages.find(s => s.id === id);
  const getPool = (id: string): PoolDetail | undefined =>
    data?.pools.find(p => p.id === id);
  const stageStatus = (id: string): StageStatus =>
    getStage(id)?.status ?? "unknown";
  const poolStatus = (id: string): StageStatus =>
    getPool(id)?.status ?? "unknown";

  const handleStageClick = (id: string) => {
    const stage = getStage(id);
    if (!stage) return;
    setSelected(prev =>
      prev?.type === "stage" && prev.data.id === id ? null : { type: "stage", data: stage }
    );
  };

  const handlePoolClick = (id: string) => {
    const pool = getPool(id);
    if (!pool) return;
    setSelected(prev =>
      prev?.type === "pool" && prev.data.id === id ? null : { type: "pool", data: pool }
    );
  };

  const allStatuses = STAGES.map(s => stageStatus(s.id));
  const systemStatus: StageStatus =
    allStatuses.some(s => s === "stale")  ? "stale" :
    allStatuses.some(s => s === "warn")   ? "warn" :
    allStatuses.every(s => s === "ok")    ? "ok" :
    "unknown";

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto"
      style={{ background: "rgba(0,2,0,0.97)", animation: "sch-fade 0.25s ease-out" }}
    >
      <style>{`
        @keyframes sch-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#0e2210] px-6 py-4">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
              System Schematic
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.10em]"
              style={{
                color: STATUS_COLOR[systemStatus],
                background: `${STATUS_COLOR[systemStatus]}12`,
                border: `1px solid ${STATUS_COLOR[systemStatus]}30`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: STATUS_COLOR[systemStatus],
                  boxShadow: `0 0 4px ${STATUS_COLOR[systemStatus]}`,
                }}
              />
              {STATUS_LABEL[systemStatus]}
            </span>
          </div>
          <h2 className="text-[18px] font-bold tracking-tight text-white">
            Pipeline Schematic
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            {(["ok", "warn", "stale", "unknown"] as StageStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1 font-mono text-[9px] text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1a3a1a] text-slate-600 transition-colors hover:border-[#2EE6A6]/30 hover:text-slate-400"
            aria-label="Close schematic"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SVG Diagram ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <div className="overflow-x-auto pb-2">
          <div style={{ minWidth: "960px" }}>
            <svg viewBox="0 0 1200 360" className="w-full" style={{ maxHeight: "52vh" }}>
              <defs>
                <pattern id="sch-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 0 0 0 20" fill="none"
                    stroke="rgba(46,230,166,0.025)" strokeWidth="0.5"
                  />
                </pattern>
              </defs>

              {/* Background grid */}
              <rect width="1200" height="360" fill="url(#sch-grid)" />

              {/* ── Main pipeline connectors ─────────────────────────── */}
              {STAGES.slice(0, -1).map((stage, i) => {
                const next = STAGES[i + 1];
                const x1 = stage.x + CHAMBER_W / 2;
                const x2 = next.x - CHAMBER_W / 2;
                const status = stageStatus(next.id);
                const color = STATUS_COLOR[status];
                const flowing = status === "ok" || status === "warn";
                return (
                  <g key={`pipe-${stage.id}`}>
                    <line
                      x1={x1} y1={MAIN_Y} x2={x2} y2={MAIN_Y}
                      stroke="rgba(46,230,166,0.12)" strokeWidth="1"
                    />
                    <path
                      d={`M ${x2 - 4} ${MAIN_Y - 3} L ${x2} ${MAIN_Y} L ${x2 - 4} ${MAIN_Y + 3}`}
                      fill="none" stroke="rgba(46,230,166,0.25)" strokeWidth="0.8"
                    />
                    {flowing && (
                      <circle cy={MAIN_Y} r="2" fill={color}>
                        <animate
                          attributeName="cx"
                          from={String(x1)} to={String(x2)}
                          dur={status === "ok" ? "2.5s" : "4s"}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.8;0.8;0" keyTimes="0;0.08;0.92;1"
                          dur={status === "ok" ? "2.5s" : "4s"}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* ── Stage chambers ───────────────────────────────────── */}
              {STAGES.map(stage => {
                const status = stageStatus(stage.id);
                const color = STATUS_COLOR[status];
                const isSel = selected?.type === "stage" && selected.data.id === stage.id;
                const rx = stage.x - CHAMBER_W / 2;
                const ry = MAIN_Y - CHAMBER_H / 2;
                return (
                  <g
                    key={stage.id}
                    onClick={() => handleStageClick(stage.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{stage.label} \u2014 {STATUS_LABEL[status]}</title>
                    <rect
                      x={rx} y={ry} width={CHAMBER_W} height={CHAMBER_H} rx={8}
                      fill={isSel ? `${color}10` : "rgba(2,8,2,0.90)"}
                      stroke={isSel ? `${color}60` : `${color}20`}
                      strokeWidth={isSel ? 1.5 : 1}
                    />
                    {/* Index */}
                    <text
                      x={rx + 8} y={MAIN_Y - 6}
                      fill="rgba(46,230,166,0.22)" fontSize="8"
                      fontFamily="monospace" fontWeight="bold"
                    >
                      {stage.idx}
                    </text>
                    {/* Label */}
                    <text
                      x={stage.x} y={MAIN_Y - 4}
                      textAnchor="middle" fill="white" fontSize="10"
                      fontFamily="monospace" fontWeight="bold" letterSpacing="0.12em"
                    >
                      {stage.label}
                    </text>
                    {/* Role */}
                    <text
                      x={stage.x} y={MAIN_Y + 10}
                      textAnchor="middle" fill="rgba(148,163,184,0.40)" fontSize="8"
                      fontFamily="monospace"
                    >
                      {stage.role}
                    </text>
                    {/* Status dot */}
                    <circle
                      cx={rx + CHAMBER_W - 10} cy={ry + 10}
                      r={3} fill={color}
                    />
                    {/* Selected pulse ring */}
                    {isSel && (
                      <circle
                        cx={rx + CHAMBER_W - 10} cy={ry + 10}
                        r={3} fill="none" stroke={color} strokeWidth="0.5"
                      >
                        <animate
                          attributeName="r" values="3;7;3"
                          dur="2s" repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity" values="0.5;0;0.5"
                          dur="2s" repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* ── Pool manifold ────────────────────────────────────── */}

              {/* Vertical pipe: SIGNAL bottom → junction */}
              <line
                x1={675} y1={MAIN_Y + CHAMBER_H / 2}
                x2={675} y2={JUNCTION_Y - 10}
                stroke="rgba(46,230,166,0.12)" strokeWidth="1"
              />

              {/* Junction valve symbol */}
              <circle
                cx={675} cy={JUNCTION_Y} r={9}
                fill="rgba(2,8,2,0.95)" stroke="rgba(46,230,166,0.30)" strokeWidth="1"
              />
              <line
                x1={671} y1={JUNCTION_Y} x2={679} y2={JUNCTION_Y}
                stroke="rgba(46,230,166,0.35)" strokeWidth="1"
              />
              <line
                x1={675} y1={JUNCTION_Y - 4} x2={675} y2={JUNCTION_Y + 4}
                stroke="rgba(46,230,166,0.35)" strokeWidth="1"
              />

              {/* Vertical pipe: junction → manifold header */}
              <line
                x1={675} y1={JUNCTION_Y + 10}
                x2={675} y2={MANIFOLD_Y}
                stroke="rgba(46,230,166,0.10)" strokeWidth="1"
              />

              {/* Manifold header (horizontal) */}
              <line
                x1={POOL_X_START} y1={MANIFOLD_Y}
                x2={POOL_X_START + (POOLS.length - 1) * POOL_SPACING} y2={MANIFOLD_Y}
                stroke="rgba(46,230,166,0.12)" strokeWidth="1"
              />

              {/* Manifold label */}
              <text
                x={675} y={MANIFOLD_Y - 10}
                textAnchor="middle" fill="rgba(46,230,166,0.16)" fontSize="8"
                fontFamily="monospace" fontWeight="bold" letterSpacing="0.20em"
              >
                POOL MANIFOLD
              </text>

              {/* Pool drops and nodes */}
              {POOLS.map((pool, i) => {
                const px = POOL_X_START + i * POOL_SPACING;
                const status = poolStatus(pool.id);
                const color = STATUS_COLOR[status];
                const isDimmed = pool.id === "media";
                const isSel = selected?.type === "pool" && selected.data.id === pool.id;
                const nodeTop = POOL_Y - POOL_H / 2;

                return (
                  <g
                    key={pool.id}
                    onClick={() => handlePoolClick(pool.id)}
                    style={{ cursor: "pointer" }}
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    <title>
                      {pool.label} Pool {isDimmed ? "(inactive)" : ""} \u2014 {STATUS_LABEL[status]}
                    </title>

                    {/* Drop from manifold */}
                    <line
                      x1={px} y1={MANIFOLD_Y} x2={px} y2={nodeTop}
                      stroke="rgba(46,230,166,0.10)" strokeWidth="0.8"
                    />
                    {/* Node */}
                    <rect
                      x={px - POOL_W / 2} y={nodeTop}
                      width={POOL_W} height={POOL_H} rx={5}
                      fill={isSel ? `${color}10` : "rgba(2,8,2,0.90)"}
                      stroke={isSel ? `${color}50` : `${color}18`}
                      strokeWidth={isSel ? 1.2 : 0.8}
                    />
                    {/* Label */}
                    <text
                      x={px} y={POOL_Y + 2}
                      textAnchor="middle"
                      fill={isDimmed ? "rgba(148,163,184,0.30)" : "rgba(255,255,255,0.65)"}
                      fontSize="9" fontFamily="monospace" fontWeight="bold"
                      letterSpacing="0.10em"
                    >
                      {pool.label}
                    </text>
                    {/* Status dot */}
                    <circle
                      cx={px + POOL_W / 2 - 7} cy={nodeTop + 7}
                      r={2} fill={color}
                    />
                    {/* Upward flow dot */}
                    {status === "ok" && !isDimmed && (
                      <circle cx={px} r="1.5" fill={color}>
                        <animate
                          attributeName="cy"
                          from={String(nodeTop)} to={String(MANIFOLD_Y)}
                          dur="3s" repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.6;0.6;0" keyTimes="0;0.1;0.9;1"
                          dur="3s" repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Upward flow dot through junction pipe */}
              {stageStatus("signal") === "ok" && (
                <circle cx={675} r="2" fill={STATUS_COLOR.ok}>
                  <animate
                    attributeName="cy"
                    from={String(MANIFOLD_Y)}
                    to={String(MAIN_Y + CHAMBER_H / 2)}
                    dur="3.5s" repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.6;0.6;0" keyTimes="0;0.1;0.9;1"
                    dur="3.5s" repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* ── Analysis branches (dashed, off MOVEMENT) ──────── */}

              {/* Fork pipe down from MOVEMENT */}
              <line
                x1={975} y1={MAIN_Y + CHAMBER_H / 2}
                x2={975} y2={BRANCH_FORK_Y}
                stroke="rgba(46,230,166,0.08)" strokeWidth="0.8"
                strokeDasharray="4 3"
              />

              {/* Branch to SECTOR INTEL */}
              <line
                x1={975} y1={BRANCH_FORK_Y}
                x2={925} y2={BRANCH_NODE_Y - 12}
                stroke="rgba(46,230,166,0.08)" strokeWidth="0.8"
                strokeDasharray="4 3"
              />
              <rect
                x={925 - 42} y={BRANCH_NODE_Y - 12}
                width={84} height={24} rx={4}
                fill="rgba(2,8,2,0.85)"
                stroke="rgba(46,230,166,0.10)" strokeWidth="0.8"
                strokeDasharray="4 3"
              />
              <text
                x={925} y={BRANCH_NODE_Y + 2}
                textAnchor="middle" fill="rgba(148,163,184,0.32)" fontSize="7.5"
                fontFamily="monospace" fontWeight="bold" letterSpacing="0.10em"
              >
                SECTOR INTEL
              </text>

              {/* Branch to BRIEFS */}
              <line
                x1={975} y1={BRANCH_FORK_Y}
                x2={1035} y2={BRANCH_NODE_Y - 12}
                stroke="rgba(46,230,166,0.08)" strokeWidth="0.8"
                strokeDasharray="4 3"
              />
              <rect
                x={1035 - 30} y={BRANCH_NODE_Y - 12}
                width={60} height={24} rx={4}
                fill="rgba(2,8,2,0.85)"
                stroke="rgba(46,230,166,0.10)" strokeWidth="0.8"
                strokeDasharray="4 3"
              />
              <text
                x={1035} y={BRANCH_NODE_Y + 2}
                textAnchor="middle" fill="rgba(148,163,184,0.32)" fontSize="7.5"
                fontFamily="monospace" fontWeight="bold" letterSpacing="0.10em"
              >
                BRIEFS
              </text>

              {/* ── Schematic border ─────────────────────────────────── */}
              <rect
                x={8} y={8} width={1184} height={344} rx={12}
                fill="none" stroke="rgba(46,230,166,0.05)" strokeWidth="0.5"
              />
            </svg>
          </div>
        </div>

        {/* ── Readout panel ─────────────────────────────────────────── */}
        {selected && (
          <div
            className="mt-3 overflow-hidden rounded-[14px] border border-[#0e2210] bg-[#020802]"
            style={{ animation: "sch-fade 0.2s ease-out" }}
          >
            {selected.type === "stage" ? (
              <StageReadout detail={selected.data} onClose={() => setSelected(null)} />
            ) : (
              <PoolReadout detail={selected.data} onClose={() => setSelected(null)} />
            )}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between pb-6">
          <div className="flex items-center gap-4 font-mono text-[9px] text-slate-700">
            <span>8 pipeline stages</span>
            <span className="text-slate-800">\u00b7</span>
            <span>7 pool feeds</span>
            <span className="text-slate-800">\u00b7</span>
            <span>2 analysis branches</span>
            <span className="text-slate-800">\u00b7</span>
            <span>Click any node for details</span>
          </div>
          <span className="font-mono text-[9px] text-slate-700">Updates every 60s</span>
        </div>
      </div>
    </div>
  );
}

// ── Readout sub-components ───────────────────────────────────────────────────

function StageReadout({
  detail,
  onClose,
}: {
  detail: StageDetail;
  onClose: () => void;
}) {
  const color = STATUS_COLOR[detail.status];
  const meta = STAGES.find(s => s.id === detail.id);

  return (
    <div className="flex items-start justify-between gap-6 px-5 py-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold tracking-[0.12em] text-white">
            {meta?.label ?? detail.id}
          </span>
          <StatusBadge status={detail.status} />
        </div>
        <div className="mt-0.5 text-[11px] text-slate-600">{meta?.role ?? ""}</div>
      </div>
      <div className="flex items-center gap-6">
        <ReadoutStat label="Last Run" value={detail.lastRunAt ? formatAge(detail.lastRunAt) : "\u2014"} />
        <ReadoutStat label="Avg Duration" value={formatDuration(detail.avgDurationMs)} />
        <ReadoutStat label="24h Runs" value={String(detail.totalRuns24h)} />
        <ReadoutStat
          label="24h Errors"
          value={String(detail.errorCount24h)}
          color={detail.errorCount24h > 0 ? "#ef4444" : undefined}
        />
        <CloseReadoutButton onClick={onClose} />
      </div>
    </div>
  );
}

function PoolReadout({
  detail,
  onClose,
}: {
  detail: PoolDetail;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[13px] font-bold tracking-[0.12em] text-white">
          {detail.label}
        </span>
        <span className="text-[11px] text-slate-600">Pool</span>
        <StatusBadge status={detail.status} />
      </div>
      <div className="flex items-center gap-6">
        <ReadoutStat
          label="Last Heartbeat"
          value={detail.lastRunAt ? formatAge(detail.lastRunAt) : "\u2014"}
        />
        <CloseReadoutButton onClick={onClose} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StageStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.10em]"
      style={{
        color,
        background: `${color}12`,
        border: `1px solid ${color}28`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ReadoutStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-700">
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-[13px] font-bold tabular-nums leading-none"
        style={{ color: color ?? "rgba(255,255,255,0.85)" }}
      >
        {value}
      </div>
    </div>
  );
}

function CloseReadoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="ml-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#1a3a1a] text-slate-700 transition-colors hover:text-slate-500"
      aria-label="Close readout"
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
