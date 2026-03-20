"use client";

/**
 * ElectricityBackground — Atmospheric lightning flicker overlay
 *
 * Renders faint blue lightning-like lines that flash intermittently across
 * the page background. Erratic timing: 2-5 second gaps between flashes.
 * Each flash is a brief (80-150ms) appearance of a randomly positioned
 * lightning bolt SVG path.
 *
 * Pure CSS/SVG animation — no canvas, no heavy deps.
 * Fixed position, pointer-events: none, z-index: 1.
 */

import { useState, useEffect, useCallback } from "react";

interface Bolt {
  id: number;
  path: string;
  opacity: number;
  x: number;
  width: number;
}

// Generate a jagged lightning bolt SVG path
function generateBoltPath(height: number): string {
  const segments = 6 + Math.floor(Math.random() * 5);
  let x = 0;
  let y = 0;
  const stepY = height / segments;
  const parts = [`M ${x} ${y}`];
  for (let i = 0; i < segments; i++) {
    x += (Math.random() - 0.5) * 80;
    y += stepY + (Math.random() - 0.5) * stepY * 0.3;
    parts.push(`L ${x} ${y}`);
  }
  return parts.join(" ");
}

export default function ElectricityBackground() {
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const [counter, setCounter] = useState(0);

  const flash = useCallback(() => {
    const numBolts = 1 + Math.floor(Math.random() * 2); // 1-2 bolts per flash
    const newBolts: Bolt[] = [];
    for (let i = 0; i < numBolts; i++) {
      newBolts.push({
        id: counter + i,
        path: generateBoltPath(400 + Math.random() * 600),
        opacity: 0.04 + Math.random() * 0.06, // 0.04-0.10 — very faint
        x: Math.random() * 100, // % position
        width: 200 + Math.random() * 300,
      });
    }
    setBolts(newBolts);
    setCounter((c) => c + numBolts);

    // Double-flash pattern: sometimes flash again 80-120ms later
    if (Math.random() > 0.5) {
      const flickerDelay = 80 + Math.random() * 40;
      setTimeout(() => {
        setBolts((prev) =>
          prev.map((b) => ({ ...b, opacity: b.opacity * (0.6 + Math.random() * 0.4) }))
        );
      }, flickerDelay);
    }

    // Clear after flash duration (80-150ms)
    const duration = 80 + Math.random() * 70;
    setTimeout(() => setBolts([]), duration);
  }, [counter]);

  useEffect(() => {
    let active = true;

    function scheduleNext() {
      if (!active) return;
      // Erratic timing: 2-5 seconds between flashes
      const delay = 2000 + Math.random() * 3000;
      setTimeout(() => {
        if (!active) return;
        flash();
        scheduleNext();
      }, delay);
    }

    // Initial delay before first flash
    const initialDelay = 3000 + Math.random() * 2000;
    const initialTimer = setTimeout(() => {
      if (!active) return;
      flash();
      scheduleNext();
    }, initialDelay);

    return () => {
      active = false;
      clearTimeout(initialTimer);
    };
  }, [flash]);

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {bolts.map((bolt) => (
        <svg
          key={bolt.id}
          style={{
            position: "absolute",
            left: `${bolt.x}%`,
            top: 0,
            width: bolt.width,
            height: "100%",
            opacity: bolt.opacity,
          }}
          viewBox={`-100 0 200 1000`}
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d={bolt.path}
            stroke="#00B4FF"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Glow layer */}
          <path
            d={bolt.path}
            stroke="#00B4FF"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity="0.3"
            filter="blur(4px)"
            style={{ filter: "blur(4px)" }}
          />
        </svg>
      ))}
    </div>
  );
}
