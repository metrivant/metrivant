"use client";

import { useState, useTransition } from "react";
import { markActionDone, dismissAction } from "./actionsQueue";

type Props = {
  id:               string;
  action_type:      string;
  urgency:          string;
  priority:         number;
  title:            string;
  description:      string;
  rationale:        string | null;
  competitor_names: string[];
};

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  defensive:  { label: "Defensive",  color: "#9B5CFF" },
  offensive:  { label: "Offensive",  color: "#00F5FF" },
  monitoring: { label: "Monitor",    color: "#2EE6A6" },
};

const URGENCY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.10)",    border: "rgba(239,68,68,0.22)"    },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",   border: "rgba(245,158,11,0.22)"   },
  low:    { color: "#475569", bg: "rgba(71,85,105,0.12)",    border: "rgba(71,85,105,0.18)"    },
};

export function ActionQueueCard({
  id, action_type, urgency, priority, title, description, rationale, competitor_names,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone]              = useState(false);
  const [err, setErr]                = useState<string | null>(null);

  if (done) return null;

  const typeStyle   = TYPE_STYLES[action_type]   ?? TYPE_STYLES.monitoring;
  const urgencyStyle = URGENCY_STYLES[urgency]   ?? URGENCY_STYLES.low;

  function handleDone() {
    startTransition(async () => {
      const result = await markActionDone(id);
      if (result.error) setErr(result.error);
      else setDone(true);
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissAction(id);
      if (result.error) setErr(result.error);
      else setDone(true);
    });
  }

  return (
    <div
      className="flex items-start gap-4 rounded-[14px] border border-[#0e1e0e] bg-[#020802] px-5 py-4"
      style={{ opacity: isPending ? 0.5 : 1, transition: "opacity 0.2s" }}
    >
      {/* Priority number */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
        style={{
          backgroundColor: `${typeStyle.color}12`,
          color:            typeStyle.color,
          border:           `1px solid ${typeStyle.color}25`,
        }}
      >
        {priority}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Badges row */}
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: typeStyle.color }}
          >
            {typeStyle.label}
          </span>
          <span className="text-[10px] text-slate-700">·</span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
            style={{
              background: urgencyStyle.bg,
              color:      urgencyStyle.color,
              border:     `1px solid ${urgencyStyle.border}`,
            }}
          >
            {urgency}
          </span>
        </div>

        {/* Title */}
        <p className="text-[14px] font-semibold leading-snug text-slate-100">{title}</p>

        {/* Description */}
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{description}</p>

        {/* Rationale */}
        {rationale && (
          <p className="mt-1.5 text-[12px] italic leading-relaxed text-slate-600">{rationale}</p>
        )}

        {/* Competitor tags */}
        {competitor_names.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {competitor_names.map((name) => (
              <span
                key={name}
                className="rounded-full border border-[#1a2d1a] bg-[#030803] px-2 py-0.5 text-[10px] text-slate-500"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {err && <p className="mt-2 text-[11px] text-red-500">{err}</p>}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleDone}
            disabled={isPending}
            className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#2EE6A6] opacity-70 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
          >
            ✓ Done
          </button>
          <button
            onClick={handleDismiss}
            disabled={isPending}
            className="text-[11px] uppercase tracking-[0.10em] text-slate-700 transition-colors hover:text-slate-500 disabled:cursor-not-allowed"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
