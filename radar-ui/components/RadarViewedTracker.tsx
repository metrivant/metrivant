"use client";

import { useEffect } from "react";
import { capture } from "../lib/posthog";

type Props = {
  orgId:           string | undefined;
  competitorCount: number;
  hasActiveAlerts: boolean;
};

/**
 * Fires `radar_viewed` once on mount.
 * Rendered as a hidden leaf in app/app/page.tsx so properties from the
 * server-side data fetch (orgId, competitorCount) are available.
 */
export default function RadarViewedTracker({ orgId, competitorCount, hasActiveAlerts }: Props) {
  useEffect(() => {
    capture("radar_viewed", {
      org_id:            orgId,
      competitor_count:  competitorCount,
      has_active_alerts: hasActiveAlerts,
    });
  // Fire once per mount — do not re-fire on data updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
