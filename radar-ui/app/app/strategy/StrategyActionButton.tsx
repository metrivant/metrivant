"use client";

import { useState } from "react";

type Props = {
  insightId:   string;
  patternType: string;
  response:    string;
};

// Copies the recommended response to clipboard and fires strategy_action_clicked.
export default function StrategyActionButton({ insightId, patternType, response }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(response);
    } catch {
      // clipboard denied — still fire event
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key) {
      fetch("https://app.posthog.com/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event:   "strategy_action_clicked",
          properties: {
            insight_id:   insightId,
            pattern_type: patternType,
          },
        }),
      }).catch(() => null);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300"
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1.5 5.5L4 8L9.5 2.5" stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ color: "#2EE6A6" }}>Copied to clipboard</span>
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="7" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 3V2a1 1 0 0 1 1-1H9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Copy response
        </>
      )}
    </button>
  );
}
