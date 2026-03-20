"use client";

import { useEffect, useState } from "react";
import { getAudioManager } from "../lib/audio";

/**
 * Compact sound toggle for the app header — sits next to NotificationBell.
 * Reads/writes localStorage via the AudioManager singleton.
 */
export default function SoundToggleButton() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(getAudioManager().isEnabled);
    setMounted(true);
  }, []);

  function handleToggle() {
    const next = getAudioManager().toggle();
    setEnabled(next);
    if (next) getAudioManager().play("blip");
  }

  if (!mounted) return null;

  return (
    <button
      onClick={handleToggle}
      aria-label={enabled ? "Mute sound effects" : "Enable sound effects"}
      title={enabled ? "Sound on" : "Sound off"}
      className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
      style={{
        borderColor: enabled ? "rgba(0,180,255,0.30)" : "rgba(0,180,255,0.10)",
        background:  enabled ? "rgba(0,180,255,0.06)" : "transparent",
        color:       enabled ? "rgba(0,180,255,0.75)" : "rgba(100,116,139,0.50)",
      }}
    >
      {enabled ? (
        // Sound on — speaker with waves
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M2 5H4L7 2.5V10.5L4 8H2V5Z" fill="currentColor" fillOpacity="0.9" />
          <path d="M9 4.5C9.8 5 10.3 5.9 10.3 7C10.3 8.1 9.8 9 9 9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M10.5 2.8C11.9 3.8 12.8 5.3 12.8 7C12.8 8.7 11.9 10.2 10.5 11.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
        </svg>
      ) : (
        // Sound off — speaker with X
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M2 5H4L7 2.5V10.5L4 8H2V5Z" fill="currentColor" fillOpacity="0.55" />
          <path d="M9 5L12 8M12 5L9 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
