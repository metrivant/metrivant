"use client";

import { useState } from "react";

export type CausalRelationship = {
  signal_id: string;
  related_signal_id: string;
  relationship_type: "precursor" | "consequence" | "corroboration";
  confidence_score: number;
  template_name?: string;
  time_gap_days?: number;
  precursor_signal_type: string;
  consequence_signal_type: string;
  precursor_detected_at: string;
  consequence_detected_at: string;
  competitor_name: string;
};

function formatSignalType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTimeGap(days: number | undefined): string {
  if (!days) return "";
  if (days < 1) return "same day";
  if (days === 1) return "1 day";
  return `${Math.round(days)}d`;
}

function CausalChain({ rel }: { rel: CausalRelationship }) {
  const [expanded, setExpanded] = useState(false);

  const arrow = rel.relationship_type === "corroboration" ? "⟷" : "→";
  const confidenceColor =
    rel.confidence_score >= 0.8
      ? "#2EE6A6"
      : rel.confidence_score >= 0.6
      ? "#f59e0b"
      : "#64748b";

  return (
    <div
      className="rounded-lg border border-[#0e1022] bg-[#050510] p-3 transition-colors hover:border-[#1a1d3a]"
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: "pointer" }}
    >
      {/* Competitor name */}
      <div
        className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em]"
        style={{ color: "#64748b" }}
      >
        {rel.competitor_name}
      </div>

      {/* Chain visualization */}
      <div className="flex items-center gap-2 text-[11px]">
        <span style={{ color: "#94a3b8" }}>{formatSignalType(rel.precursor_signal_type)}</span>
        <span style={{ color: confidenceColor, fontSize: "14px" }}>{arrow}</span>
        <span style={{ color: "#94a3b8" }}>{formatSignalType(rel.consequence_signal_type)}</span>
      </div>

      {/* Metadata on expand */}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-[#0e1022] pt-2 text-[10px]">
          {rel.time_gap_days !== undefined && (
            <div style={{ color: "#64748b" }}>
              <span style={{ color: "#475569" }}>Time gap:</span> {formatTimeGap(rel.time_gap_days)}
            </div>
          )}
          <div style={{ color: "#64748b" }}>
            <span style={{ color: "#475569" }}>Confidence:</span>{" "}
            <span style={{ color: confidenceColor }}>
              {Math.round(rel.confidence_score * 100)}%
            </span>
          </div>
          {rel.template_name && (
            <div style={{ color: "#64748b" }}>
              <span style={{ color: "#475569" }}>Pattern:</span> {rel.template_name.replace(/_/g, " ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CausalityView({ relationships }: { relationships: CausalRelationship[] }) {
  if (relationships.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div
          className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#64748b" }}
        >
          No Causal Chains
        </div>
        <div className="text-[11px] leading-relaxed" style={{ color: "#475569" }}>
          Causal relationships appear when signals form strategic sequences
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 border-b border-[#0e1022] pb-2">
        <div
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#00B4FF" }}
        >
          Causal Chains
        </div>
        <div className="mt-1 text-[10px]" style={{ color: "#64748b" }}>
          {relationships.length} detected relationship{relationships.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Chains list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {relationships.map((rel, idx) => (
          <CausalChain key={`${rel.signal_id}-${rel.related_signal_id}-${idx}`} rel={rel} />
        ))}
      </div>
    </div>
  );
}
