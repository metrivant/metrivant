"use client";

import { useRouter } from "next/navigation";
import type { BriefContent, BriefSeverity, BriefMove } from "../../../lib/brief";

// ── Trajectory derivation ─────────────────────────────────────────────────────

type TrajectoryLabel =
  | "Enterprise Expansion"
  | "Pricing War"
  | "Product Acceleration"
  | "Market Repositioning"
  | "Ecosystem Expansion"
  | "Strategic Movement";

function deriveTrajectory(move: string): TrajectoryLabel {
  const m = move.toLowerCase();
  if (/enterprise|upmarket|b2b sales|account\s+exec|seat.based|seat\s+licens|fortune\s+\d/.test(m))
    return "Enterprise Expansion";
  if (/pric|tier|discount|free\s+tier|undercut|cost reduction|subscription/.test(m))
    return "Pricing War";
  if (/launch|ship|releas|new\s+feature|product|api|integrat|built.in/.test(m))
    return "Product Acceleration";
  if (/repositi|rebrand|pivot|messag|narrativ|redefin|icp shift/.test(m))
    return "Market Repositioning";
  if (/partner|ecosystem|marketplace|platform|third.party|acqui|merge/.test(m))
    return "Ecosystem Expansion";
  return "Strategic Movement";
}

// Severity → confidence proxy (displayed in dossier cards)
function deriveConfidence(severity: BriefSeverity): number {
  return severity === "high" ? 0.82 : severity === "medium" ? 0.60 : 0.38;
}

// Short intelligence interpretation for each trajectory + severity combination
function deriveBriefInterpretation(trajectory: TrajectoryLabel, severity: BriefSeverity): string {
  const prefix = severity === "high" ? "Immediate" : severity === "medium" ? "Elevated" : "Low-level";
  switch (trajectory) {
    case "Enterprise Expansion":  return `${prefix} pressure on enterprise segment`;
    case "Pricing War":           return `${prefix} pricing competition detected`;
    case "Product Acceleration":  return `${prefix} velocity in product surface`;
    case "Market Repositioning":  return `${prefix} shift in competitive narrative`;
    case "Ecosystem Expansion":   return `${prefix} platform and partnership play`;
    default:                      return `${prefix} competitive activity detected`;
  }
}

const TRAJECTORY_STYLES: Record<TrajectoryLabel, { color: string; bg: string; border: string }> = {
  "Enterprise Expansion":  { color: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.22)" },
  "Pricing War":           { color: "#ff6b6b", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.20)" },
  "Product Acceleration":  { color: "#57a6ff", bg: "rgba(87,166,255,0.08)",  border: "rgba(87,166,255,0.20)"  },
  "Market Repositioning":  { color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.20)"  },
  "Ecosystem Expansion":   { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.20)"  },
  "Strategic Movement":    { color: "#94a3b8", bg: "rgba(148,163,184,0.07)", border: "rgba(148,163,184,0.16)" },
};

// ── Pressure groups ────────────────────────────────────────────────────────────

type PressureGroup = { trajectory: TrajectoryLabel; competitors: string[] };

function computePressureGroups(moves: BriefMove[]): PressureGroup[] {
  const groups = new Map<TrajectoryLabel, string[]>();
  for (const move of moves) {
    const traj = deriveTrajectory(move.move);
    const list = groups.get(traj) ?? [];
    if (!list.includes(move.competitor)) list.push(move.competitor);
    groups.set(traj, list);
  }
  return Array.from(groups.entries())
    .filter(([, names]) => names.length >= 2)
    .map(([trajectory, competitors]) => ({ trajectory, competitors }));
}

// ── Severity helpers ───────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<BriefSeverity, string> = {
  high: "HIGH", medium: "MED", low: "LOW",
};
const SEVERITY_STYLES: Record<BriefSeverity, { bg: string; text: string; border: string }> = {
  high:   { bg: "rgba(239,68,68,0.08)",   text: "#ef4444", border: "rgba(239,68,68,0.22)"   },
  medium: { bg: "rgba(245,158,11,0.08)",  text: "#f59e0b", border: "rgba(245,158,11,0.22)"  },
  low:    { bg: "rgba(107,114,128,0.08)", text: "#6b7280", border: "rgba(107,114,128,0.20)" },
};

function SeverityBadge({ severity, suffix = "" }: { severity: BriefSeverity; suffix?: string }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {SEVERITY_LABEL[severity]}{suffix}
    </span>
  );
}

function TrajectoryBadge({ trajectory }: { trajectory: TrajectoryLabel }) {
  const ts = TRAJECTORY_STYLES[trajectory];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: ts.color }} />
      {trajectory}
    </span>
  );
}

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="font-mono text-[11px] font-bold"
        style={{ color: "rgba(46,230,166,0.40)" }}
      >
        {number}
      </span>
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-[0.20em]"
        style={{ color: "rgba(46,230,166,0.72)" }}
      >
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{
          background: "linear-gradient(90deg, rgba(46,230,166,0.18) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

// ── Strategic Pressure Block ───────────────────────────────────────────────────

function StrategicPressureBlock({ groups }: { groups: PressureGroup[] }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      {groups.map(({ trajectory, competitors }) => {
        const ts = TRAJECTORY_STYLES[trajectory];
        return (
          <div
            key={trajectory}
            className="flex items-center gap-3 rounded-[10px] border px-4 py-2.5"
            style={{
              background: ts.bg,
              borderColor: ts.border,
              boxShadow: `inset 0 0 20px ${ts.color}06`,
            }}
          >
            <div
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: ts.color, boxShadow: `0 0 6px ${ts.color}88` }}
            />
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "rgba(100,116,139,0.65)" }}
              >
                Strategic Pressure ·
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: ts.color }}
              >
                {trajectory}
              </span>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-600">
              {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} accelerating
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Strategic Timeline ─────────────────────────────────────────────────────────

function StrategicTimeline({
  moves,
  generatedAt,
}: {
  moves: BriefMove[];
  generatedAt: string;
}) {
  const dateStr = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div>
      <SectionHeader number="04" label="Signal Timeline" />
      <div className="relative pl-8">
        {/* Vertical rule */}
        <div
          className="absolute left-[7px] top-1 bottom-2 w-px"
          style={{
            background:
              "linear-gradient(180deg, rgba(46,230,166,0.18) 0%, transparent 100%)",
          }}
        />
        <div className="flex flex-col gap-5">
          {moves.map((move, i) => {
            const traj = deriveTrajectory(move.move);
            const ts = TRAJECTORY_STYLES[traj];
            return (
              <div key={i} className="relative">
                {/* Timeline dot */}
                <div
                  className="absolute -left-[25px] top-1.5 h-[9px] w-[9px] rounded-full border"
                  style={{
                    backgroundColor: `${ts.color}22`,
                    borderColor: ts.border,
                  }}
                >
                  <div
                    className="absolute inset-[2px] rounded-full"
                    style={{ backgroundColor: ts.color }}
                  />
                </div>

                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-700">{dateStr}</span>
                  <span className="text-slate-800">·</span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: ts.color }}
                  >
                    {traj}
                  </span>
                </div>
                <p className="text-[12px] font-semibold leading-snug text-slate-300">
                  {move.competitor}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  {move.move}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type BriefViewerProps = {
  id: string;
  brief: BriefContent;
  generatedAt: string;
  signalCount: number;
  isLatest?: boolean;
};

export default function BriefViewer({
  brief,
  generatedAt,
  signalCount,
  isLatest = false,
}: BriefViewerProps) {
  const router = useRouter();

  const date = new Date(generatedAt);
  const weekLabel = date.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const pressureGroups = computePressureGroups(brief.major_moves);

  function focusOnRadar(competitorName: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("mv_radar_focus", competitorName);
    }
    router.push("/app");
  }

  return (
    <article
      className="relative rounded-[18px] border border-[#0d2010] bg-[#020802]"
      style={isLatest ? { boxShadow: "0 0 60px rgba(46,230,166,0.025)" } : undefined}
    >
      {isLatest && (
        <div
          className="absolute inset-x-0 top-0 h-[1px] rounded-t-[18px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.30) 30%, rgba(46,230,166,0.50) 50%, rgba(46,230,166,0.30) 70%, transparent 100%)",
          }}
        />
      )}

      {/* ── Brief header ─────────────────────────────────────────────── */}
      <div className="border-b border-[#0d2010] px-7 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "rgba(46,230,166,0.45)" }}
            >
              Intelligence Brief
            </div>
            <div className="mt-1 font-mono text-[13px] font-semibold tracking-[0.06em] text-white">
              Week of {weekLabel}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 pt-0.5">
            {isLatest && (
              <span
                className="flex items-center gap-1.5 rounded-full border border-[#2EE6A6]/18 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ background: "rgba(46,230,166,0.06)", color: "#2EE6A6" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#2EE6A6]"
                  style={{ boxShadow: "0 0 4px rgba(46,230,166,0.8)" }}
                />
                Latest
              </span>
            )}
            <span className="text-[11px] text-slate-700">{dayLabel}</span>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="mt-3 flex items-center gap-4">
          {brief.competitors_analyzed.length > 0 && (
            <span className="text-[11px] text-slate-600">
              <span className="tabular-nums text-slate-400">
                {brief.competitors_analyzed.length}
              </span>{" "}
              competitor{brief.competitors_analyzed.length !== 1 ? "s" : ""} analyzed
            </span>
          )}
          {signalCount > 0 && (
            <>
              <span className="text-slate-800">·</span>
              <span className="text-[11px] text-slate-600">
                <span className="tabular-nums text-slate-400">{signalCount}</span>{" "}
                signal{signalCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {brief.model && (
            <>
              <span className="text-slate-800">·</span>
              <span className="font-mono text-[10px] text-slate-700">{brief.model}</span>
            </>
          )}
        </div>
      </div>

      <div className="p-7">

        {/* ── Headline ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div
            className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "rgba(46,230,166,0.45)" }}
          >
            Summary
          </div>
          <p className="text-[16px] font-medium leading-relaxed text-white">
            {brief.headline}
          </p>
        </div>

        {/* ── Strategic Pressure ────────────────────────────────────── */}
        {pressureGroups.length > 0 && (
          <StrategicPressureBlock groups={pressureGroups} />
        )}

        {/* ── Section 01: Major Moves ───────────────────────────────── */}
        {brief.major_moves.length > 0 && (
          <div className="mb-8">
            <SectionHeader number="01" label="Major Moves" />
            <div className="flex flex-col gap-3">
              {brief.major_moves.map((move, i) => {
                const traj = deriveTrajectory(move.move);
                const ts = TRAJECTORY_STYLES[traj];
                const conf = deriveConfidence(move.severity);
                const confPct = Math.round(conf * 100);
                const interpretation = deriveBriefInterpretation(traj, move.severity);
                return (
                  <div
                    key={i}
                    className="rounded-[12px] border border-[#0f1f0f] bg-[#030c03] p-4"
                    style={{ borderLeftWidth: "3px", borderLeftColor: `${ts.color}44` }}
                  >
                    {/* Trajectory + severity row */}
                    <div className="mb-2.5 flex items-center gap-2">
                      <TrajectoryBadge trajectory={traj} />
                      <SeverityBadge severity={move.severity} />
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 text-[13px] font-semibold text-white">
                          {move.competitor}
                        </div>
                        <div className="text-[13px] leading-relaxed text-slate-400">
                          {move.move}
                        </div>
                      </div>

                      {/* Radar synergy hook */}
                      <button
                        onClick={() => focusOnRadar(move.competitor)}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-[#0d2010] bg-[#020802] px-2 py-1 text-[10px] text-slate-600 transition-colors hover:border-[#2EE6A6]/25 hover:text-slate-400"
                        title={`Focus ${move.competitor} on Radar`}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" strokeOpacity="0.55" />
                          <circle cx="5" cy="5" r="2.2" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.40" />
                          <circle cx="5" cy="5" r="0.9" fill="currentColor" fillOpacity="0.70" />
                        </svg>
                        Radar
                      </button>
                    </div>

                    {/* Dossier footer — confidence bar + interpretation */}
                    <div className="mt-3 flex items-center gap-4 border-t border-[#0d1a0d] pt-2.5">
                      <div className="flex flex-1 items-center gap-2">
                        <span className="w-[60px] shrink-0 text-[10px] text-slate-700">Confidence</span>
                        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-[#0d1a0d]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${confPct}%`, backgroundColor: ts.color }}
                          />
                        </div>
                        <span
                          className="w-[28px] text-right font-mono text-[10px] tabular-nums"
                          style={{ color: ts.color }}
                        >
                          {confPct}%
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] italic text-slate-600">
                        {interpretation}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section 02: Strategic Implications ────────────────────── */}
        {brief.strategic_implications.length > 0 && (
          <div className="mb-8">
            <SectionHeader number="02" label="Strategic Implications" />
            <div className="flex flex-col gap-3">
              {brief.strategic_implications.map((imp, i) => (
                <div
                  key={i}
                  className="rounded-[12px] border border-[#0f1f0f] bg-[#030c03] p-4"
                >
                  <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-300">
                    {imp.theme}
                  </div>
                  <div className="text-[13px] leading-relaxed text-slate-400">
                    {imp.implication}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 03: Recommended Actions ──────────────────────── */}
        {brief.recommended_actions.length > 0 && (
          <div className="mb-8">
            <SectionHeader number="03" label="Recommended Actions" />
            <div className="flex flex-col gap-2.5">
              {brief.recommended_actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-[12px] border border-[#0f1f0f] bg-[#030c03] p-4"
                >
                  <SeverityBadge severity={action.priority} suffix=" Priority" />
                  <p className="text-[13px] leading-relaxed text-slate-300">
                    {action.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 04: Signal Timeline ───────────────────────────── */}
        {brief.major_moves.length > 0 && (
          <StrategicTimeline moves={brief.major_moves} generatedAt={generatedAt} />
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {brief.major_moves.length === 0 &&
          brief.strategic_implications.length === 0 &&
          brief.recommended_actions.length === 0 && (
            <div className="py-8 text-center text-[13px] text-slate-700">
              No significant competitive activity detected this week.
            </div>
          )}
      </div>
    </article>
  );
}
