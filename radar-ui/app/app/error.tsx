"use client";

import { useEffect } from "react";
import { captureException } from "../../lib/sentry";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "app-shell" });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-slate-600">
          Radar error
        </div>
        <p className="text-sm text-slate-500">
          The intelligence surface could not be loaded.
        </p>
        <p className="mt-1 text-xs text-slate-700">
          This may be a temporary connectivity issue.
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-full border border-[#1a301a] bg-[#060d06] px-4 py-2 text-xs text-slate-400 transition-colors hover:border-[#2a4a2a] hover:text-slate-200"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
