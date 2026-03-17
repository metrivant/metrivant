"use client";

// ── RadarRealtimeSync ─────────────────────────────────────────────────────────
//
// Invisible client component. Subscribes to two Supabase realtime channels
// and calls router.refresh() when relevant data changes, so the radar updates
// without the user having to reload.
//
// Channel 1: competitors UPDATE (org_id scoped) — fires whenever last_signal_at
//   changes (written by DB trigger on every new signal) or when the pipeline
//   updates pressure_index. Covers the most frequent live data change.
//
// Channel 2: strategic_movements INSERT — fires when a new confirmed movement
//   lands for any of this org's competitors. RLS scopes delivery to the org.
//
// Debounce: rapid pipeline events (multiple signals in the same cron batch)
// are collapsed into one refresh. Prevents router.refresh() storms.
//
// Fallback: the existing 60s interval poll in Radar.tsx remains active. If the
// realtime connection drops, data stays fresh within 60 seconds.
//
// Requires: migration 048 enables the supabase_realtime publication for both
// tables. Until the migration runs, this component is a no-op (subscriptions
// silently receive no events).

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

const DEBOUNCE_MS = 1500;

export default function RadarRealtimeSync({ orgId }: { orgId: string }) {
  const router  = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    // Channel 1: competitor row updates scoped to this org
    // last_signal_at is stamped by DB trigger on signal INSERT — every new
    // signal for any competitor in this org fires this channel.
    const competitorChannel = supabase
      .channel("radar-competitor-sync")
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "competitors",
          filter: `org_id=eq.${orgId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    // Channel 2: new strategic movements (RLS scopes to org's competitors)
    const movementChannel = supabase
      .channel("radar-movement-sync")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "strategic_movements",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(competitorChannel);
      supabase.removeChannel(movementChannel);
    };
  }, [orgId, router]);

  return null;
}
