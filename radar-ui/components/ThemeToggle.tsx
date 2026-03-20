"use client";

import { useEffect, useState } from "react";
import { getTheme, toggleTheme, type Theme } from "../lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("classic");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  return (
    <button
      onClick={() => setTheme(toggleTheme())}
      className="hidden items-center justify-center rounded-full border bg-[#020208] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors md:inline-flex"
      style={{
        borderColor: theme === "hud" ? "rgba(0,229,255,0.25)" : "#0e1022",
        color: theme === "hud" ? "rgba(0,229,255,0.70)" : "rgba(100,116,139,0.80)",
      }}
      title={theme === "classic" ? "Switch to HUD mode" : "Switch to Classic mode"}
    >
      O
    </button>
  );
}
