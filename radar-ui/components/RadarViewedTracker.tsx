"use client";

import { useEffect } from "react";
import { capture } from "../lib/posthog";

// Fires radar_viewed on mount — keeps the radar page a server component.
export default function RadarViewedTracker() {
  useEffect(() => {
    capture("radar_viewed");
  }, []);

  return null;
}
