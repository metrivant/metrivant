"use client";

// SyncOnSuccess — mounts when the user returns from Stripe checkout with
// ?checkout=success but hasActiveSub is still false (webhook hasn't fired yet).
//
// On mount: calls POST /api/stripe/sync-subscription to reconcile Stripe state.
// On success: calls router.refresh() so the billing page re-renders with the
// updated subscription row. The page will then show SubscribedStatusSurface.

import { useEffect, useRef } from "react";
import { useRouter }         from "next/navigation";

export default function SyncOnSuccess() {
  const router  = useRouter();
  const didSync = useRef(false);

  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;

    (async () => {
      try {
        const res = await fetch("/api/stripe/sync-subscription", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) return;

        const data = await res.json() as { ok?: boolean; synced?: boolean };

        if (data.synced) {
          // Refresh the server component tree so the page reads fresh DB state
          router.refresh();
        }
      } catch {
        // Non-fatal — page already shows checkout success banner
      }
    })();
  }, [router]);

  return (
    <div
      className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex items-center gap-3 rounded-full border border-[#2EE6A6]/20 bg-[#020802] px-5 py-3 shadow-lg"
        style={{ boxShadow: "0 0 20px rgba(46,230,166,0.08)" }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#2EE6A6]"
          style={{ opacity: 0.70 }}
        />
        <span className="text-[12px] font-medium text-slate-400">
          Activating your subscription…
        </span>
      </div>
    </div>
  );
}
