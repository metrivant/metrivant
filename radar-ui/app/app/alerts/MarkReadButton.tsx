"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function markAllRead() {
    if (disabled || loading || done) return;
    setLoading(true);

    await fetch("/api/alerts/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setDone(true);
    setLoading(false);
    router.refresh();
  }

  if (disabled) {
    return (
      <span className="text-[12px] text-slate-700">All caught up</span>
    );
  }

  return (
    <button
      onClick={markAllRead}
      disabled={loading || done}
      className="text-[12px] text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
    >
      {done ? "Marked as read" : loading ? "Marking…" : "Mark all read"}
    </button>
  );
}
