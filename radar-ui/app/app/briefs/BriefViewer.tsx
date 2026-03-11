import type { BriefContent, BriefSeverity } from "../../../lib/brief";

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<BriefSeverity, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const SEVERITY_STYLES: Record<BriefSeverity, { bg: string; text: string; border: string }> = {
  high:   { bg: "rgba(239,68,68,0.08)",   text: "#ef4444", border: "rgba(239,68,68,0.22)"   },
  medium: { bg: "rgba(245,158,11,0.08)",  text: "#f59e0b", border: "rgba(245,158,11,0.22)"  },
  low:    { bg: "rgba(107,114,128,0.08)", text: "#6b7280", border: "rgba(107,114,128,0.20)" },
};

function SeverityBadge({
  severity,
  suffix = "",
}: {
  severity: BriefSeverity;
  suffix?: string;
}) {
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

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="font-mono text-[11px] font-bold"
        style={{ color: "rgba(46,230,166,0.40)" }}
      >
        {number}
      </span>
      <div
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(46,230,166,0.15) 0%, transparent 100%)",
        }}
      />
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[0.20em]"
        style={{ color: "rgba(46,230,166,0.55)" }}
      >
        {label}
      </span>
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
  const date = new Date(generatedAt);
  const weekLabel = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className="relative rounded-[18px] border border-[#0d2010] bg-[#020802]"
      style={
        isLatest
          ? { boxShadow: "0 0 60px rgba(46,230,166,0.025)" }
          : undefined
      }
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
                style={{
                  background: "rgba(46,230,166,0.06)",
                  color: "#2EE6A6",
                }}
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
              <span className="font-mono text-[10px] text-slate-700">
                {brief.model}
              </span>
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

        {/* ── Section 1: Major Moves ─────────────────────────────────── */}
        {brief.major_moves.length > 0 && (
          <div className="mb-8">
            <SectionHeader number="01" label="Major Moves" />
            <div className="flex flex-col gap-3">
              {brief.major_moves.map((move, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-[12px] border border-[#0f1f0f] bg-[#030c03] p-4"
                >
                  <SeverityBadge severity={move.severity} />
                  <div className="min-w-0">
                    <div className="mb-1 text-[13px] font-semibold text-white">
                      {move.competitor}
                    </div>
                    <div className="text-[13px] leading-relaxed text-slate-400">
                      {move.move}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 2: Strategic Implications ─────────────────────── */}
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

        {/* ── Section 3: Recommended Actions ────────────────────────── */}
        {brief.recommended_actions.length > 0 && (
          <div>
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

        {/* ── Empty state ────────────────────────────────────────────── */}
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
