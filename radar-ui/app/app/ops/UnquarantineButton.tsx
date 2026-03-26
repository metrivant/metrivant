"use client";

import { useState } from "react";
import { unquarantineMonitoredPage } from "./quarantine-actions";

export function UnquarantineButton({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await unquarantineMonitoredPage(pageId);
    if (result.ok) {
      setHidden(true); // Optimistic UI update
    } else {
      console.error("Failed to un-quarantine:", result.error);
      alert(`Failed to un-quarantine: ${result.error}`);
    }
    setLoading(false);
  };

  if (hidden) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold transition-all hover:scale-105 disabled:opacity-50"
      style={{
        color: "#00B4FF",
        backgroundColor: "#00B4FF14",
        border: "1px solid #00B4FF28",
      }}
    >
      {loading ? "..." : "Un-quarantine"}
    </button>
  );
}
