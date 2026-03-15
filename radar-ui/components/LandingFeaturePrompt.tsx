"use client";

import { useEffect, useState } from "react";
import AboutOverlay from "./AboutOverlay";

const SESSION_KEY = "mv_landing_about_shown";

export default function LandingFeaturePrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only auto-open once per session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch { /* sessionStorage unavailable */ }

    const timer = setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* non-fatal */ }
    }, 10_000);

    return () => clearTimeout(timer);
  }, []);

  return <AboutOverlay open={open} onClose={() => setOpen(false)} />;
}
