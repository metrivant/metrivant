"use client";

import { useState, useEffect, useCallback } from "react";
import type { StageStatus } from "../app/api/pipeline-status/route";

// ── Stage definitions ─────────────────────────────────────────────────────────

type StageInfo = {
  id:          string;
  index:       string;
  label:       string;
  role:        string;
  description: string;
  input:       string;
  output:      string;
  steps:       string[];
};

const STAGES: StageInfo[] = [
  {
    id:    "capture",
    index: "01",
    label: "CAPTURE",
    role:  "Intake",
    description:
      "Raw inputs enter the system. Monitored pages are fetched at configured intervals — " +
      "high-priority targets on tight cycles, standard pages on wider rotations. Each fetch " +
      "is stored verbatim as a timestamped snapshot. No processing occurs at this stage.",
    input:  "Monitored page URLs",
    output: "Timestamped raw snapshots",
    steps: [
      "Target URLs resolved and fetched",
      "Content stored verbatim with timestamp",
      "Priority tier determines cycle frequency",
      "Fetch quality and health state recorded",
    ],
  },
  {
    id:    "parse",
    index: "02",
    label: "EXTRACT",
    role:  "Segmentation",
    description:
      "Structure is isolated from noise. Raw snapshots are segmented into typed content " +
      "blocks — pricing, features, navigation, body copy. Each section is classified by " +
      "function and position. This granularity enables surgical change detection downstream.",
    input:  "Raw page snapshot",
    output: "Typed content sections",
    steps: [
      "Content parsed into logical sections",
      "Each section typed by structural role",
      "Position and hierarchy indexed",
      "Extraction quality validated against history",
    ],
  },
  {
    id:    "baseline",
    index: "03",
    label: "BASELINE",
    role:  "Reference",
    description:
      "A stable reference state is established for each section. Baselines are immutable — " +
      "once written, they anchor all future comparisons. Every detected change is measured " +
      "against a known, stable origin.",
    input:  "Extracted content sections",
    output: "Immutable reference per section",
    steps: [
      "Existing baseline checked for each section",
      "New sections anchored with initial reference",
      "Write-once constraint enforced",
      "Instability monitored across rolling window",
    ],
  },
  {
    id:    "diff",
    index: "04",
    label: "DIFF",
    role:  "Detection",
    description:
      "Meaningful changes are identified. Current content is compared against its baseline " +
      "and substantive differences are recorded with full context. Noise filters discard " +
      "cosmetic variations — only real changes advance.",
    input:  "Current content + baseline reference",
    output: "Verified content differences",
    steps: [
      "Character-level comparison against baseline",
      "Noise filters applied (whitespace, dynamic content)",
      "Change magnitude and context recorded",
      "Observation count tracked for confidence",
    ],
  },
  {
    id:    "signal",
    index: "05",
    label: "SIGNAL",
    role:  "Classification",
    description:
      "Changes are evaluated and classified. Each verified diff is assigned a signal type, " +
      "confidence score, and strategic context. Low-confidence signals are suppressed. " +
      "Duplicates are eliminated by content hash. Only unique, high-confidence changes proceed.",
    input:  "Verified content differences",
    output: "Typed signals with confidence scores",
    steps: [
      "Signal type assigned by content pattern",
      "Confidence scored from multiple factors",
      "Low-confidence signals suppressed at gate",
      "Hash-based deduplication enforced",
    ],
  },
  {
    id:    "intelligence",
    index: "06",
    label: "INTELLIGENCE",
    role:  "Contextualisation",
    description:
      "Signals are processed and contextualised. Grouped by competitor, each signal is " +
      "evaluated for strategic intent — what the change indicates about direction and " +
      "positioning. Context accumulates over time, improving interpretation quality.",
    input:  "Classified signals per competitor",
    output: "Strategic interpretation with context",
    steps: [
      "Signals grouped by competitor",
      "Historical context prepended for continuity",
      "Strategic intent evaluated and summarised",
      "Context updated with new evidence",
    ],
  },
  {
    id:    "movement",
    index: "07",
    label: "MOVEMENT",
    role:  "Synthesis",
    description:
      "Outputs are synthesised into structured intelligence. Interpretations are analysed " +
      "across a rolling window for coherent patterns. Confirmed movements require multiple " +
      "signals, sufficient confidence, and measurable velocity.",
    input:  "Interpretations across time window",
    output: "Confirmed strategic movements",
    steps: [
      "Signals evaluated for pattern coherence",
      "Confidence and count thresholds enforced",
      "Velocity computed from temporal spread",
      "Narrative generated for confirmed movements",
    ],
  },
  {
    id:    "radar",
    index: "08",
    label: "RADAR",
    role:  "Output",
    description:
      "Intelligence is delivered. All confirmed movements and signals are assembled into " +
      "the live radar surface — one record per competitor, ranked by momentum. The full " +
      "evidence chain remains accessible behind every detection.",
    input:  "Movements + signals + interpretations",
    output: "Live intelligence surface",
    steps: [
      "Feed computed — one record per competitor",
      "Competitors ranked by momentum score",
      "Evidence chain assembled end-to-end",
      "Surface rendered with full drill-down",
    ],
  },
];

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<StageStatus, string> = {
  ok:      "#00B4FF",
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

// ── Types ─────────────────────────────────────────────────────────────────────

type StageState = { id: string; status: StageStatus };

type Props = {
  initialStages: StageState[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PipelineDiagram({ initialStages }: Props) {
  const [stages, setStages]         = useState<StageState[]>(initialStages);
  const [selected, setSelected]     = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline-status");
      if (!res.ok) return;
      const json = await res.json();
      if (json.stages) setStages(json.stages);
    } catch {
      // silent — keep last known state
    }
  }, []);

  // Poll every 60s
  useEffect(() => {
    const id = setInterval(fetchStatus, 60_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const getStatus = (id: string): StageStatus =>
    stages.find((s) => s.id === id)?.status ?? "unknown";

  const handleNodeClick = (id: string) => {
    if (selected === id) {
      setPanelVisible(false);
      setTimeout(() => setSelected(null), 300);
    } else {
      setSelected(id);
      setPanelVisible(true);
    }
  };

  const closePanel = () => {
    setPanelVisible(false);
    setTimeout(() => setSelected(null), 300);
  };

  const selectedInfo = STAGES.find((s) => s.id === selected) ?? null;
  const selectedStatus = selected ? getStatus(selected) : "unknown";

  // Overall system status
  const statuses = STAGES.map((s) => getStatus(s.id));
  const systemStatus: StageStatus =
    statuses.some((s) => s === "stale")   ? "stale"   :
    statuses.some((s) => s === "warn")    ? "warn"    :
    statuses.every((s) => s === "ok")     ? "ok"      :
    "unknown";

  return (
    <>
      {/* ── Keyframe animations ──────────────────────────────────────────── */}
      <style>{`
        @keyframes flow-right {
          0%   { left: -6px;  opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: calc(100% + 6px); opacity: 0; }
        }
        @keyframes flow-down {
          0%   { top: -6px;  opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: calc(100% + 6px); opacity: 0; }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.4; transform: scale(1);   }
          50%       { opacity: 0.9; transform: scale(1.12); }
        }
        @keyframes slide-in-panel {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes line-glow {
          0%, 100% { opacity: 1; }
          50%      { opacity: 1.6; }
        }
      `}</style>

      {/* ── System status bar ─────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.20em] text-slate-700">
            System Status
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: STATUS_COLOR[systemStatus],
                boxShadow: `0 0 8px ${STATUS_COLOR[systemStatus]}, 0 0 16px ${STATUS_COLOR[systemStatus]}30`,
              }}
            />
            <span className="font-mono text-[13px] font-medium tracking-[0.04em]" style={{ color: STATUS_COLOR[systemStatus] }}>
              {STATUS_LABEL[systemStatus]}
            </span>
            <span className="text-[11px] text-slate-700">— 8 stages active</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-slate-700">60s refresh</div>
          <div className="mt-0.5 flex items-center justify-end gap-3">
            {(["ok","warn","stale","unknown"] as StageStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pipeline diagram ──────────────────────────────────────────────── */}
      <div className="relative">
        {/* Scrollable diagram container */}
        <div className="overflow-x-auto pb-4">
          <div style={{ minWidth: "960px" }}>

            {/* ── Row 1: stages 0–3 ──────────────────────────────────────── */}
            <div className="flex items-stretch">
              {STAGES.slice(0, 4).map((stage, i) => (
                <div key={stage.id} className="flex items-center" style={{ flex: 1 }}>
                  <StageNode
                    stage={stage}
                    status={getStatus(stage.id)}
                    selected={selected === stage.id}
                    onClick={() => handleNodeClick(stage.id)}
                  />
                  {i < 3 && (
                    <Connector
                      direction="right"
                      status={getStatus(STAGES[i + 1].id)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── Vertical connector: DIFF → SIGNAL ──────────────────────── */}
            <div className="flex justify-end" style={{ paddingRight: "0" }}>
              <div
                className="relative"
                style={{ width: "calc(12.5%)", height: "48px" }}
              >
                {/* Vertical line on the right edge of row 1 */}
                <div
                  className="absolute right-0 top-0 w-px"
                  style={{
                    height: "48px",
                    background: `linear-gradient(180deg, rgba(0,180,255,0.25), rgba(0,180,255,0.12))`,
                  }}
                />
                {/* Horizontal return line at the bottom */}
                <div
                  className="absolute bottom-0 right-0"
                  style={{
                    height: "1px",
                    width: "calc(800%)",
                    right: "0",
                    background: "linear-gradient(270deg, rgba(0,180,255,0.18), rgba(0,180,255,0.06))",
                  }}
                />
                {/* Corner arrow indicator */}
                <div
                  className="absolute bottom-0 right-[-4px] font-mono text-[10px]"
                  style={{ color: "rgba(0,180,255,0.30)", lineHeight: 1 }}
                >
                  ↙
                </div>
              </div>
            </div>

            {/* ── Row 2: stages 4–7 ──────────────────────────────────────── */}
            <div className="flex items-stretch">
              {STAGES.slice(4).map((stage, i) => (
                <div key={stage.id} className="flex items-center" style={{ flex: 1 }}>
                  <StageNode
                    stage={stage}
                    status={getStatus(stage.id)}
                    selected={selected === stage.id}
                    onClick={() => handleNodeClick(stage.id)}
                  />
                  {i < 3 && (
                    <Connector
                      direction="right"
                      status={getStatus(STAGES[i + 5].id)}
                    />
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Scroll hint on small screens */}
        <div
          className="pointer-events-none absolute right-0 top-0 flex h-full items-center px-2 sm:hidden"
          style={{
            background: "linear-gradient(270deg, rgba(0,2,0,0.9) 0%, transparent 100%)",
          }}
        >
          <span className="font-mono text-[10px] text-slate-600">→ scroll</span>
        </div>
      </div>

      {/* ── Stage detail panel ────────────────────────────────────────────── */}
      {selected && selectedInfo && (
        <div
          className="mt-10 overflow-hidden rounded-[18px] border"
          style={{
            borderColor: `${STATUS_COLOR[selectedStatus]}25`,
            background: `linear-gradient(135deg, ${STATUS_COLOR[selectedStatus]}06 0%, rgba(2,8,2,0.95) 50%)`,
            animation: panelVisible ? "slide-in-panel 0.25s ease-out" : undefined,
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between border-b px-6 py-4"
            style={{ borderColor: `${STATUS_COLOR[selectedStatus]}18` }}
          >
            <div className="flex items-center gap-4">
              <span
                className="font-mono text-[11px] font-bold"
                style={{ color: "rgba(0,180,255,0.30)" }}
              >
                {selectedInfo.index}
              </span>
              <StageSymbol id={selectedInfo.id} color={`${STATUS_COLOR[selectedStatus]}90`} size={14} />
              <div>
                <div className="font-mono text-[15px] font-bold tracking-[0.12em] text-white">
                  {selectedInfo.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{selectedInfo.role}</div>
              </div>
              {/* Status badge */}
              <span
                className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.10em]"
                style={{
                  color:      STATUS_COLOR[selectedStatus],
                  background: `${STATUS_COLOR[selectedStatus]}12`,
                  border:     `1px solid ${STATUS_COLOR[selectedStatus]}30`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLOR[selectedStatus],
                    boxShadow: `0 0 5px ${STATUS_COLOR[selectedStatus]}`,
                  }}
                />
                {STATUS_LABEL[selectedStatus]}
              </span>
            </div>
            <button
              onClick={closePanel}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3a1a] text-slate-600 transition-colors hover:border-[#00B4FF]/30 hover:text-slate-400"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Panel body */}
          <div className="grid gap-8 px-6 py-6 sm:grid-cols-3">
            {/* Description */}
            <div className="sm:col-span-2">
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Function
              </div>
              <p className="text-[13px] leading-[1.7] text-slate-400">
                {selectedInfo.description}
              </p>

              {/* Sub-steps */}
              <div className="mt-5">
                <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  Sequence
                </div>
                <div className="flex flex-col gap-2">
                  {selectedInfo.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="mt-[3px] shrink-0 font-mono text-[10px] font-bold tabular-nums"
                        style={{ color: `${STATUS_COLOR[selectedStatus]}60` }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[12px] leading-snug text-slate-500">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Input / Output */}
            <div className="flex flex-col gap-4">
              <div
                className="rounded-[12px] border border-[#0e1022] bg-[#010501] p-4"
              >
                <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-slate-700">
                  Input
                </div>
                <div className="flex items-start gap-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0" aria-hidden>
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(0,180,255,0.35)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[12px] leading-snug text-slate-400">{selectedInfo.input}</span>
                </div>
              </div>
              <div
                className="rounded-[12px] border p-4"
                style={{
                  borderColor: `${STATUS_COLOR[selectedStatus]}20`,
                  background: `${STATUS_COLOR[selectedStatus]}06`,
                }}
              >
                <div
                  className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.20em]"
                  style={{ color: `${STATUS_COLOR[selectedStatus]}80` }}
                >
                  Output
                </div>
                <div className="flex items-start gap-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0" aria-hidden>
                    <path d="M10 6H2M5 3L2 6l3 3" stroke={STATUS_COLOR[selectedStatus]} strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[12px] leading-snug text-slate-300">{selectedInfo.output}</span>
                </div>
              </div>

              {/* Pipeline position indicator */}
              <div className="rounded-[12px] border border-[#0e1e0e] bg-[#010501] p-4">
                <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-slate-700">
                  Position
                </div>
                <div className="flex items-center gap-1">
                  {STAGES.map((s) => (
                    <div
                      key={s.id}
                      className="h-1 flex-1 rounded-full transition-all"
                      style={{
                        backgroundColor:
                          s.id === selected
                            ? STATUS_COLOR[selectedStatus]
                            : "rgba(0,180,255,0.10)",
                        boxShadow:
                          s.id === selected
                            ? `0 0 4px ${STATUS_COLOR[selectedStatus]}`
                            : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate-700">
                  <span>INTAKE</span>
                  <span>OUTPUT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Stage symbol ─────────────────────────────────────────────────────────────

function StageSymbol({ id, color, size = 12 }: { id: string; color: string; size?: number }) {
  const vb = "0 0 12 12";
  const sw = 1.2;
  const lc: "round" = "round";
  const lj: "round" = "round";

  switch (id) {
    case "capture":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <path d="M6 2v5.5M3.5 5L6 7.5 8.5 5" stroke={color} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} />
          <line x1="3" y1="10" x2="9" y2="10" stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        </svg>
      );
    case "parse":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <line x1="3" y1="3" x2="9" y2="3" stroke={color} strokeWidth={sw} strokeLinecap={lc} />
          <line x1="3" y1="6" x2="9" y2="6" stroke={color} strokeWidth={sw} strokeLinecap={lc} />
          <line x1="3" y1="9" x2="7" y2="9" stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        </svg>
      );
    case "baseline":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <line x1="2" y1="6" x2="10" y2="6" stroke={color} strokeWidth={sw} strokeLinecap={lc} />
          <line x1="4" y1="4.5" x2="4" y2="7.5" stroke={color} strokeWidth={1} strokeLinecap={lc} />
          <line x1="8" y1="4.5" x2="8" y2="7.5" stroke={color} strokeWidth={1} strokeLinecap={lc} />
        </svg>
      );
    case "diff":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <path d="M6 2.5L9.5 9.5H2.5Z" stroke={color} strokeWidth={sw} strokeLinejoin={lj} />
        </svg>
      );
    case "signal":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <polyline points="1,6 3,6 4.5,2.5 6,9.5 7.5,4 9,6 11,6" stroke={color} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} />
        </svg>
      );
    case "intelligence":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <circle cx="6" cy="6" r="2.5" stroke={color} strokeWidth={sw} />
          <circle cx="6" cy="6" r="0.7" fill={color} />
          <line x1="6" y1="1.5" x2="6" y2="3.5" stroke={color} strokeWidth={1} strokeLinecap={lc} />
          <line x1="6" y1="8.5" x2="6" y2="10.5" stroke={color} strokeWidth={1} strokeLinecap={lc} />
          <line x1="1.5" y1="6" x2="3.5" y2="6" stroke={color} strokeWidth={1} strokeLinecap={lc} />
          <line x1="8.5" y1="6" x2="10.5" y2="6" stroke={color} strokeWidth={1} strokeLinecap={lc} />
        </svg>
      );
    case "movement":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <path d="M2.5 6h6.5M7 3.5L9.5 6 7 8.5" stroke={color} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} />
        </svg>
      );
    case "radar":
      return (
        <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
          <circle cx="6" cy="6" r="1.5" stroke={color} strokeWidth={sw} />
          <path d="M6 6l2.5-2.5" stroke={color} strokeWidth={1} strokeLinecap={lc} />
          <path d="M9.5 3A5 5 0 0 1 9.5 9" stroke={color} strokeWidth={0.8} />
          <path d="M2.5 3A5 5 0 0 0 2.5 9" stroke={color} strokeWidth={0.8} />
        </svg>
      );
    default:
      return null;
  }
}

// ── StageNode ─────────────────────────────────────────────────────────────────

function StageNode({
  stage,
  status,
  selected,
  onClick,
}: {
  stage:    StageInfo;
  status:   StageStatus;
  selected: boolean;
  onClick:  () => void;
}) {
  const color = STATUS_COLOR[status];
  const isActive = status === "ok";

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full flex-col items-start rounded-[14px] border p-4 text-left transition-all duration-200"
      style={{
        borderColor: selected ? `${color}50` : `${color}20`,
        background:  selected
          ? `linear-gradient(135deg, ${color}10 0%, rgba(2,8,2,0.95) 60%)`
          : "rgba(2,8,2,0.80)",
        boxShadow: selected
          ? `0 0 24px ${color}15, inset 0 0 20px ${color}06`
          : isActive
            ? `0 0 12px ${color}08`
            : "none",
        minHeight:   "104px",
      }}
    >
      {/* Status indicator — top right */}
      <div className="absolute right-3 top-3">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: isActive
              ? `0 0 6px ${color}, 0 0 12px ${color}40`
              : `0 0 4px ${color}`,
            animation: isActive ? "pulse-ring 3s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* Stage index */}
      <div
        className="mb-1.5 font-mono text-[9px] font-bold"
        style={{ color: "rgba(0,180,255,0.25)" }}
      >
        {stage.index}
      </div>

      {/* Stage symbol + label */}
      <div className="flex items-center gap-1.5">
        <StageSymbol
          id={stage.id}
          color={selected ? color : "rgba(0,180,255,0.35)"}
        />
        <div
          className="font-mono text-[12px] font-bold tracking-[0.14em] transition-colors"
          style={{ color: selected ? color : "rgba(255,255,255,0.85)" }}
        >
          {stage.label}
        </div>
      </div>

      {/* Role */}
      <div className="mt-1 text-[10px] tracking-[0.02em] text-slate-600 transition-colors group-hover:text-slate-500">
        {stage.role}
      </div>

      {/* Status label — bottom */}
      <div
        className="mt-auto pt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em]"
        style={{ color: `${color}70` }}
      >
        {STATUS_LABEL[status]}
      </div>
    </button>
  );
}

// ── Connector ─────────────────────────────────────────────────────────────────

function Connector({
  direction,
  status,
}: {
  direction: "right" | "down";
  status:    StageStatus;
}) {
  const color = STATUS_COLOR[status];
  const isHorizontal = direction === "right";
  const isActive = status === "ok" || status === "warn";

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={
        isHorizontal
          ? { width: "40px", height: "100%" }
          : { width: "100%", height: "40px" }
      }
    >
      {/* The line — with subtle glow when active */}
      <div
        className="absolute"
        style={
          isHorizontal
            ? {
                top: "50%",
                left: "4px",
                right: "4px",
                height: "1px",
                transform: "translateY(-50%)",
                background: isActive
                  ? "rgba(0,180,255,0.22)"
                  : "rgba(0,180,255,0.12)",
                boxShadow: status === "ok"
                  ? "0 0 4px rgba(0,180,255,0.08)"
                  : "none",
              }
            : {
                left: "50%",
                top: "4px",
                bottom: "4px",
                width: "1px",
                transform: "translateX(-50%)",
                background: isActive
                  ? "rgba(0,180,255,0.22)"
                  : "rgba(0,180,255,0.12)",
                boxShadow: status === "ok"
                  ? "0 0 4px rgba(0,180,255,0.08)"
                  : "none",
              }
        }
      />

      {/* Animated travelling dot — neon pulse */}
      {isActive && (
        <div
          className="absolute rounded-full"
          style={
            isHorizontal
              ? {
                  top:             "50%",
                  width:           "4px",
                  height:          "4px",
                  marginTop:       "-2px",
                  backgroundColor: color,
                  boxShadow:       `0 0 6px ${color}, 0 0 14px ${color}50, 0 0 22px ${color}18`,
                  animation:       `flow-right ${status === "ok" ? "3.2s" : "4.5s"} ease-in-out infinite`,
                }
              : {
                  left:            "50%",
                  width:           "4px",
                  height:          "4px",
                  marginLeft:      "-2px",
                  backgroundColor: color,
                  boxShadow:       `0 0 6px ${color}, 0 0 14px ${color}50, 0 0 22px ${color}18`,
                  animation:       `flow-down ${status === "ok" ? "3.2s" : "4.5s"} ease-in-out infinite`,
                }
          }
        />
      )}

      {/* Arrowhead */}
      <div
        className="absolute"
        style={
          isHorizontal
            ? {
                right:     "2px",
                top:       "50%",
                transform: "translateY(-50%) rotate(45deg)",
                width:     "5px",
                height:    "5px",
                borderTop:   `1px solid ${isActive ? "rgba(0,180,255,0.40)" : "rgba(0,180,255,0.25)"}`,
                borderRight: `1px solid ${isActive ? "rgba(0,180,255,0.40)" : "rgba(0,180,255,0.25)"}`,
              }
            : {
                bottom:    "2px",
                left:      "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width:     "5px",
                height:    "5px",
                borderBottom: `1px solid ${isActive ? "rgba(0,180,255,0.40)" : "rgba(0,180,255,0.25)"}`,
                borderRight:  `1px solid ${isActive ? "rgba(0,180,255,0.40)" : "rgba(0,180,255,0.25)"}`,
              }
        }
      />
    </div>
  );
}
