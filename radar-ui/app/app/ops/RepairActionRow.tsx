"use client";

import { useState, useTransition } from "react";
import { acceptRepair, rejectRepair } from "./actions";

type Props = {
  id:                string;
  monitored_page_id: string;
  section_type:      string;
  proposed_selector: string;
  confidence:        number;
  rationale:         string | null;
  created_at:        string;
};

function formatAge(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RepairActionRow({
  id,
  monitored_page_id,
  section_type,
  proposed_selector,
  confidence,
  rationale,
  created_at,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return null;

  const confColor =
    confidence >= 0.70 ? "#2EE6A6" :
    confidence >= 0.40 ? "#f59e0b" :
    "#ef4444";

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptRepair(id, monitored_page_id, section_type, proposed_selector);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectRepair(id);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-[#0e2010] bg-[#020802] px-4 py-3">
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-[12px]"
        style={{ backgroundColor: "rgba(46,230,166,0.35)" }}
      />
      <div className="ml-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-slate-300">{section_type}</span>
            <span className="text-[10px] text-slate-700">·</span>
            <span className="font-mono text-[10px] text-slate-600">{formatAge(created_at)}</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#2EE6A6]">{proposed_selector}</div>
          {rationale && (
            <p className="mt-0.5 text-[11px] text-slate-600">{rationale}</p>
          )}
          {error && (
            <p className="mt-1 font-mono text-[11px] text-red-400">{error}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <span
              className="font-mono text-[13px] font-bold tabular-nums"
              style={{ color: confColor }}
            >
              {Math.round(confidence * 100)}%
            </span>
            <div className="mt-0.5 font-mono text-[10px] text-slate-700">confidence</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="rounded-[6px] border border-[#1a2a1a] bg-[#030a03] px-3 py-1 font-mono text-[10px] text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="rounded-[6px] border border-[#0e3818] bg-[#051505] px-3 py-1 font-mono text-[10px] font-bold text-[#2EE6A6] transition-colors hover:border-[#2EE6A6]/40 hover:bg-[#0a2a0a] disabled:opacity-40"
            >
              {isPending ? "…" : "Accept"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
