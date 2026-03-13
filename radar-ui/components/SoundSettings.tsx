"use client";

import { useEffect, useState } from "react";
import { getAudioManager } from "../lib/audio";

/**
 * Sound preference panel for the Settings page.
 * Reads from and writes to localStorage via the AudioManager singleton.
 * Default: disabled. User must explicitly enable.
 */
export default function SoundSettings() {
  const [enabled, setEnabled] = useState(false);

  // Sync with stored preference on mount (avoids SSR mismatch)
  useEffect(() => {
    setEnabled(getAudioManager().isEnabled);
  }, []);

  function handleToggle() {
    const next = getAudioManager().toggle();
    setEnabled(next);
    // Play a soft preview blip on enable so the user hears what they're turning on
    if (next) getAudioManager().play("blip");
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[14px] text-white">Sound Effects</div>
        <div className="mt-0.5 text-[12px] text-slate-600">
          Subtle audio cues for radar interactions and alerts.
          Off by default.
        </div>
      </div>

      {/* Toggle pill */}
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Disable sound effects" : "Enable sound effects"}
        onClick={handleToggle}
        className="relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2EE6A6]"
        style={{
          background: enabled ? "rgba(46,230,166,0.22)" : "#0a1a0a",
          border: `1px solid ${enabled ? "rgba(46,230,166,0.4)" : "#1a3a20"}`,
          boxShadow: enabled ? "0 0 10px rgba(46,230,166,0.15)" : "none",
        }}
      >
        <span
          className="absolute h-4 w-4 rounded-full transition-all duration-200"
          style={{
            background: enabled ? "#2EE6A6" : "#1e3a20",
            left: enabled ? "calc(100% - 18px)" : "2px",
            boxShadow: enabled ? "0 0 6px rgba(46,230,166,0.6)" : "none",
          }}
        />
      </button>
    </div>
  );
}
