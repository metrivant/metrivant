"use client";

import { useEffect } from "react";
import { capture } from "../../../lib/posthog";

// Fires brief_viewed on mount — keeps the briefs page a server component.
export default function BriefViewedTracker() {
  useEffect(() => {
    capture("brief_viewed");
  }, []);

  return null;
}
