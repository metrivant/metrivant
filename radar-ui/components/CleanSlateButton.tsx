"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CleanSlateButtonProps {
  competitorCount: number;
}

export default function CleanSlateButton({ competitorCount }: CleanSlateButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/clean-slate", { method: "POST" });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      }
    } catch {
      // Silently reset — non-critical UI path
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">
          Remove {competitorCount > 0 ? `${competitorCount} rival${competitorCount !== 1 ? "s" : ""}` : "all rivals"}?
        </span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-full border border-red-900/60 bg-[#0d0505] px-2.5 py-1 text-[11px] font-medium text-red-500 transition-colors hover:border-red-800 hover:bg-[#150808] disabled:opacity-50"
        >
          {loading ? "Clearing…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-full border border-[#1a2a1a] bg-transparent px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:text-slate-400 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-full border border-[#1a2a1a] bg-transparent px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-red-900/50 hover:text-red-500/80"
      title="Remove all competitors and reset to Custom sector"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true" className="opacity-70">
        <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      Clean Slate
    </button>
  );
}
