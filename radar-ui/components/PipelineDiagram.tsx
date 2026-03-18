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
    role:  "Page Acquisition",
    description:
      "Every 30 minutes, Metrivant fetches the full content of every monitored competitor page. " +
      "Pages are tiered by strategic importance — pricing and changelog pages are captured more " +
      "frequently than standard pages, which run on a 3-hour cycle. Each fetch is stored verbatim " +
      "as a timestamped snapshot. No processing occurs at this stage — it is pure data collection.",
    input:  "Monitored competitor URLs",
    output: "Raw page snapshots stored with timestamp",
    steps: [
      "URL resolved, redirects followed",
      "HTTP fetch with timeout and retry",
      "Raw HTML stored verbatim in Supabase",
      "Page classified by priority tier (high_value / standard / ambient)",
    ],
  },
  {
    id:    "parse",
    index: "02",
    label: "PARSE",
    role:  "Content Segmentation",
    description:
      "Raw snapshots are segmented into logical sections — pricing tables, feature blocks, " +
      "headings, body copy, navigation items. Each section is typed and labelled by its role " +
      "on the page. This segmentation is what enables surgical diff detection: instead of comparing " +
      "entire pages, Metrivant compares like-for-like sections, reducing false positives dramatically.",
    input:  "Raw HTML snapshot",
    output: "Typed page sections (pricing, features, changelog, etc.)",
    steps: [
      "HTML parsed with CSS selector extraction",
      "Sections typed by content pattern",
      "Position and hierarchy recorded",
      "Extraction quality validated against historical section count",
    ],
  },
  {
    id:    "baseline",
    index: "03",
    label: "BASELINE",
    role:  "Reference State",
    description:
      "For each section, the first stable version becomes its baseline — the canonical " +
      "'before' state against which all future content is measured. Baselines are insert-only: " +
      "they never overwrite, which means Metrivant always knows what a page looked like before " +
      "any detected change. A new baseline is only established when a section has no prior record.",
    input:  "Extracted page sections",
    output: "Immutable reference content per section",
    steps: [
      "Check if section baseline already exists",
      "If new section: create baseline from current content",
      "Baseline is write-once — never updated automatically",
      "Baseline instability warnings fire when >5 new baselines per page in 7 days",
    ],
  },
  {
    id:    "diff",
    index: "04",
    label: "DIFF",
    role:  "Change Detection",
    description:
      "New section content is compared against its baseline. Differences are recorded with the " +
      "full before-and-after text. Noise filters run before any diff is persisted: whitespace-only " +
      "changes, dynamic timestamps, and UTM parameter variations are discarded. Only substantive " +
      "content changes advance to the next stage.",
    input:  "New section content + section baseline",
    output: "Section diff with change magnitude and before/after excerpts",
    steps: [
      "Character-level comparison against baseline",
      "Whitespace normalization filter applied",
      "Dynamic content stripped (timestamps, UTM params)",
      "Observation count tracked — repeated changes increase confidence",
    ],
  },
  {
    id:    "signal",
    index: "05",
    label: "SIGNAL",
    role:  "Classification",
    description:
      "Each meaningful diff is classified by signal type: pricing shift, feature launch, " +
      "positioning change, hiring surge, or content update. A confidence score (0–1) is assigned " +
      "based on section type, change magnitude, and recency. Low-confidence signals are suppressed " +
      "automatically. Duplicate signals — the same change detected twice — are eliminated by a " +
      "content hash. Only unique, high-confidence changes advance to interpretation.",
    input:  "Section diff",
    output: "Typed signal with confidence score and strategic context",
    steps: [
      "Signal typed by section pattern (pricing_strategy_shift, feature_launch, etc.)",
      "Confidence scored: section weight + recency bonus + observation bonus",
      "Signals below 0.35 confidence suppressed",
      "SHA-256 hash deduplication — one unique signal per change",
      "Signals ≥0.65 confidence sent immediately to intelligence",
    ],
  },
  {
    id:    "intelligence",
    index: "06",
    label: "INTELLIGENCE",
    role:  "AI Interpretation",
    description:
      "Signals are grouped per competitor and interpreted by GPT-4o-mini. The model assesses " +
      "strategic intent — what the change likely means for the competitor's direction — and writes " +
      "a concise analyst-quality summary. Each competitor's accumulated intelligence history is " +
      "prepended as context, so interpretations improve as more signals are observed over time. " +
      "Temperature is kept low for consistency.",
    input:  "Grouped signals per competitor",
    output: "Interpretation: strategic summary, implication, recommended action",
    steps: [
      "Competitor's intelligence context prepended (hypothesis, evidence trail)",
      "Signals batched per competitor for efficiency",
      "GPT-4o-mini called at low temperature (0.25) for determinism",
      "Context updated after each batch — hypothesis evolves with evidence",
    ],
  },
  {
    id:    "movement",
    index: "07",
    label: "MOVEMENT",
    role:  "Pattern Confirmation",
    description:
      "Interpretations are analyzed for patterns over a 14-day rolling window. A single signal " +
      "is an observation. A confirmed movement requires multiple signals of coherent type, " +
      "sufficient confidence, and measurable velocity. When confirmed, the movement is labelled " +
      "by type (pricing shift, market reposition, enterprise push) and given a narrative summary " +
      "written by GPT-4o — the most capable model, used specifically for synthesis.",
    input:  "Interpretations over 14-day window",
    output: "Confirmed strategic movement with type, confidence, and narrative",
    steps: [
      "Signals grouped by competitor and movement type",
      "Minimum confidence threshold and signal count required",
      "Velocity computed from first-seen to last-seen timestamps",
      "GPT-4o writes a 2-sentence analyst narrative per movement",
    ],
  },
  {
    id:    "radar",
    index: "08",
    label: "RADAR",
    role:  "Intelligence Surface",
    description:
      "All confirmed movements and signals are assembled into the live radar feed — one record " +
      "per competitor, ordered by momentum score. Momentum is a composite of signal density, " +
      "recency, confidence, and movement velocity. The radar renders this as a precision " +
      "instrument: node position encodes momentum, size reflects activity, and the intelligence " +
      "drawer surfaces the full evidence chain behind every detected movement.",
    input:  "Strategic movements + signals + interpretations",
    output: "Live radar with ranked competitors, momentum scores, and intelligence drawers",
    steps: [
      "Radar feed view computed — one row per competitor",
      "Competitors ranked by momentum score (accelerating / rising / stable / cooling)",
      "Evidence chain assembled: movement → signals → diffs → raw content",
      "UI renders nodes as radar blips; selected competitor reveals full intelligence",
    ],
  },
];

// ── Status helpers ────────────────────────────────────────────────────────────

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
          0%   { left: -8px;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: calc(100% + 8px); opacity: 0; }
        }
        @keyframes flow-down {
          0%   { top: -8px;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% + 8px); opacity: 0; }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.5; transform: scale(1);   }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes slide-in-panel {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>

      {/* ── System status bar ─────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-slate-700">
            System Status
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: STATUS_COLOR[systemStatus],
                boxShadow: `0 0 8px ${STATUS_COLOR[systemStatus]}`,
              }}
            />
            <span className="font-mono text-[13px] font-semibold" style={{ color: STATUS_COLOR[systemStatus] }}>
              {STATUS_LABEL[systemStatus]}
            </span>
            <span className="text-[12px] text-slate-700">— all 8 pipeline stages monitored</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-slate-700">Updates every 60s</div>
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
                    background: `linear-gradient(180deg, rgba(46,230,166,0.25), rgba(46,230,166,0.15))`,
                  }}
                />
                {/* Horizontal return line at the bottom */}
                <div
                  className="absolute bottom-0 right-0"
                  style={{
                    height: "1px",
                    width: "calc(800%)",
                    right: "0",
                    background: "rgba(46,230,166,0.12)",
                  }}
                />
                {/* Corner arrow indicator */}
                <div
                  className="absolute bottom-0 right-[-4px] font-mono text-[10px]"
                  style={{ color: "rgba(46,230,166,0.35)", lineHeight: 1 }}
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
                style={{ color: "rgba(46,230,166,0.35)" }}
              >
                {selectedInfo.index}
              </span>
              <div>
                <div className="font-mono text-[15px] font-bold tracking-[0.14em] text-white">
                  {selectedInfo.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{selectedInfo.role}</div>
              </div>
              {/* Status badge */}
              <span
                className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
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
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3a1a] text-slate-600 transition-colors hover:border-[#2EE6A6]/30 hover:text-slate-400"
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
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.20em] text-slate-600">
                How it works
              </div>
              <p className="text-[13px] leading-[1.75] text-slate-400">
                {selectedInfo.description}
              </p>

              {/* Sub-steps */}
              <div className="mt-5">
                <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.20em] text-slate-600">
                  Process
                </div>
                <div className="flex flex-col gap-2">
                  {selectedInfo.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="mt-[3px] shrink-0 font-mono text-[10px] font-bold tabular-nums"
                        style={{ color: `${STATUS_COLOR[selectedStatus]}70` }}
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
                className="rounded-[12px] border border-[#0e2210] bg-[#010501] p-4"
              >
                <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-slate-700">
                  Input
                </div>
                <div className="flex items-start gap-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0" aria-hidden>
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(46,230,166,0.4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
                  className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
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
                <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-slate-700">
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
                            : "rgba(46,230,166,0.12)",
                        boxShadow:
                          s.id === selected
                            ? `0 0 4px ${STATUS_COLOR[selectedStatus]}`
                            : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate-700">
                  <span>START</span>
                  <span>RADAR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
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

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full flex-col items-start rounded-[14px] border p-4 text-left transition-all duration-200"
      style={{
        borderColor: selected ? `${color}50` : `${color}20`,
        background:  selected
          ? `linear-gradient(135deg, ${color}10 0%, rgba(2,8,2,0.95) 60%)`
          : "rgba(2,8,2,0.80)",
        boxShadow:   selected ? `0 0 20px ${color}15, inset 0 0 20px ${color}06` : "none",
        minHeight:   "104px",
      }}
    >
      {/* Status indicator — top right */}
      <div className="absolute right-3 top-3">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow:        `0 0 6px ${color}`,
            animation:        status === "ok" ? "pulse-ring 3s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* Stage index */}
      <div
        className="mb-1 font-mono text-[9px] font-bold"
        style={{ color: "rgba(46,230,166,0.28)" }}
      >
        {stage.index}
      </div>

      {/* Stage label */}
      <div
        className="font-mono text-[12px] font-bold tracking-[0.16em] transition-colors"
        style={{ color: selected ? color : "rgba(255,255,255,0.85)" }}
      >
        {stage.label}
      </div>

      {/* Role description */}
      <div className="mt-1 text-[10px] text-slate-600 transition-colors group-hover:text-slate-500">
        {stage.role}
      </div>

      {/* Status label — bottom */}
      <div
        className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ color: `${color}80` }}
      >
        {STATUS_LABEL[status]}
      </div>

      {/* Hover hint */}
      <div
        className="absolute bottom-3 right-3 font-mono text-[9px] text-slate-700 opacity-0 transition-opacity group-hover:opacity-100"
      >
        tap
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

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={
        isHorizontal
          ? { width: "40px", height: "100%" }
          : { width: "100%", height: "40px" }
      }
    >
      {/* The line */}
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
                background: `rgba(46,230,166,0.18)`,
              }
            : {
                left: "50%",
                top: "4px",
                bottom: "4px",
                width: "1px",
                transform: "translateX(-50%)",
                background: `rgba(46,230,166,0.18)`,
              }
        }
      />

      {/* Animated travelling dot */}
      <div
        className="absolute rounded-full"
        style={
          isHorizontal
            ? {
                top:             "50%",
                width:           "5px",
                height:          "5px",
                marginTop:       "-2.5px",
                backgroundColor: color,
                boxShadow:       `0 0 6px ${color}`,
                animation:       `flow-right 2.4s linear infinite`,
              }
            : {
                left:            "50%",
                width:           "5px",
                height:          "5px",
                marginLeft:      "-2.5px",
                backgroundColor: color,
                boxShadow:       `0 0 6px ${color}`,
                animation:       `flow-down 2.4s linear infinite`,
              }
        }
      />

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
                borderTop:   "1px solid rgba(46,230,166,0.35)",
                borderRight: "1px solid rgba(46,230,166,0.35)",
              }
            : {
                bottom:    "2px",
                left:      "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width:     "5px",
                height:    "5px",
                borderBottom: "1px solid rgba(46,230,166,0.35)",
                borderRight:  "1px solid rgba(46,230,166,0.35)",
              }
        }
      />
    </div>
  );
}
