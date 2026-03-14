"use client";

import { useState, useEffect, useCallback } from "react";
import { getAmbientAudio } from "../lib/ambientAudio";

const STORAGE_KEY = "mv_sound";

/**
 * SoundToggle
 *
 * A small speaker icon button for the app header.
 * - Default: OFF (browser-safe; AudioContext only created on user gesture)
 * - Toggle on → starts ambient audio manager
 * - Toggle off → fades out and stops
 * - Preference persisted in localStorage
 */
export default function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [ready,   setReady]   = useState(false); // prevents SSR flash

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch { /* no-op */ }
    setReady(true);
  }, []);

  // When enabled state changes (after mount), start/stop the audio manager
  useEffect(() => {
    if (!ready) return;
    const audio = getAmbientAudio();
    if (enabled) {
      audio.start().catch(() => {
        // AudioContext blocked — silently revert to off
        setEnabled(false);
        try { localStorage.setItem(STORAGE_KEY, "0"); } catch { /* no-op */ }
      });
    } else {
      audio.stop();
    }
  }, [enabled, ready]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* no-op */ }
      return next;
    });
  }, []);

  if (!ready) return null;

  return (
    <button
      onClick={toggle}
      aria-label={enabled ? "Disable ambient sound" : "Enable ambient sound"}
      title={enabled ? "Sound on" : "Sound off"}
      className="flex items-center justify-center rounded-lg transition-colors duration-150"
      style={{
        width:      "28px",
        height:     "28px",
        background: enabled ? "rgba(46,230,166,0.08)" : "transparent",
        border:     enabled
          ? "1px solid rgba(46,230,166,0.22)"
          : "1px solid rgba(255,255,255,0.05)",
        color: enabled ? "#2EE6A6" : "#475569",
      }}
    >
      {enabled ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}

// ── Icons (inline SVG — no external import needed) ────────────────────────────

function SoundOnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      {/* Speaker body */}
      <path
        d="M2 4.5h2L7 2v9L4 8.5H2v-4z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Sound wave arcs */}
      <path
        d="M9 4.5a2.5 2.5 0 0 1 0 4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M10.5 3a4.5 4.5 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      {/* Speaker body */}
      <path
        d="M2 4.5h2L7 2v9L4 8.5H2v-4z"
        fill="currentColor"
        opacity="0.45"
      />
      {/* Mute slash */}
      <line
        x1="9"
        y1="4"
        x2="12"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <line
        x1="12"
        y1="4"
        x2="9"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
