"use client";

/**
 * FeatureDiscoveryPanel — Metrivant Feature Discovery System
 *
 * Surfaces draggable, diagram-illustrated panels that explain how Metrivant
 * features work. Appears 10–15 minutes after dashboard load (randomized),
 * then 10–15 minutes after each dismissal. Session-deduplicated.
 *
 * Coordinates with HistoricalCapsule via panel-coordinator to guarantee
 * only one panel is ever visible and a 90-second gap between any two panels.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FEATURE_PANELS } from "../lib/feature-panels";
import type { FeaturePanel, DiagramKey } from "../lib/feature-panels";
import type { FeatureExpandedContent, FeatureStep } from "../app/api/expand-feature-panel/route";
import { canShowPanel, setPanelOpen, setPanelClosed, randomDelay } from "../lib/panel-coordinator";

// ── Session dedup ─────────────────────────────────────────────────────────────

const SESSION_KEY = "mv_feature_panels_shown";

function getShownIds(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]"); } catch { return []; }
}
function markShown(id: string): void {
  const current = getShownIds();
  if (!current.includes(id)) sessionStorage.setItem(SESSION_KEY, JSON.stringify([...current, id]));
}
function pickNext(): FeaturePanel | null {
  const shown = getShownIds();
  // Unseen first, sorted by priority_weight descending so high-priority panels appear first
  const pool = FEATURE_PANELS
    .filter((p) => !shown.includes(p.id))
    .sort((a, b) => b.priority_weight - a.priority_weight);
  if (pool.length === 0) return null;
  // Pick randomly from the top half of the priority-sorted pool for some variety
  const topHalf = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
  return topHalf[Math.floor(Math.random() * topHalf.length)];
}

// ── Diagrams ──────────────────────────────────────────────────────────────────

function Diagram({ type, accent }: { type: DiagramKey; accent: string }) {
  const s = { width: "100%", height: "148px" } as const;

  if (type === "radar-gravity") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="rg-bg" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#rg-bg)" />
      {/* Radar rings */}
      {[55, 42, 29, 16].map((r, i) => (
        <circle key={i} cx="150" cy="74" r={r * 1.8} fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity={0.08 + i * 0.06} />
      ))}
      {/* Cardinal labels */}
      <text x="150" y="10"  textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.3">N</text>
      <text x="150" y="143" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.3">S</text>
      <text x="7"   y="77"  textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.3">W</text>
      <text x="293" y="77"  textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.3">E</text>
      {/* Cooling node — far from center */}
      <circle cx="220" cy="36" r="6" fill="#475569" fillOpacity="0.7" />
      <text x="220" y="28" textAnchor="middle" fill="#475569" fontSize="7" fillOpacity="0.65">Cooling</text>
      {/* Stable node */}
      <circle cx="195" cy="100" r="7" fill={accent} fillOpacity="0.55" />
      <text x="195" y="114" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.65">Stable</text>
      {/* Rising node — mid distance, arrow toward center */}
      <circle cx="186" cy="56" r="9" fill="#f59e0b" fillOpacity="0.65" />
      <text x="186" y="47" textAnchor="middle" fill="#f59e0b" fontSize="7" fillOpacity="0.8">Rising</text>
      <line x1="181" y1="61" x2="162" y2="68" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.7" markerEnd="url(#rg-arr)" />
      <defs><marker id="rg-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <polygon points="0,0 5,2.5 0,5" fill="#f59e0b" fillOpacity="0.7" />
      </marker></defs>
      {/* Accelerating node — near center, pulsing outer ring */}
      <circle cx="150" cy="74" r="13" fill="none" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.25" />
      <circle cx="150" cy="74" r="10" fill="#ef4444" fillOpacity="0.7" />
      <text x="150" y="97" textAnchor="middle" fill="#ef4444" fontSize="7" fillOpacity="0.85">Accelerating</text>
      {/* Center dot */}
      <circle cx="150" cy="74" r="2.5" fill="white" fillOpacity="0.25" />
    </svg>
  );

  if (type === "signal-detection") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="sd-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.07" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="sd-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill={accent} fillOpacity="0.6" />
        </marker>
      </defs>
      <rect width="300" height="148" fill="url(#sd-bg)" />
      {/* 4-step pipeline */}
      {[
        { x: 16,  icon: "🌐", label: "Page",     sublabel: "Crawl" },
        { x: 82,  icon: "📸", label: "Snapshot", sublabel: "Capture" },
        { x: 148, icon: "Δ",  label: "Diff",     sublabel: "Compare" },
        { x: 214, icon: "⚡", label: "Signal",   sublabel: "Classify" },
      ].map(({ x, icon, label, sublabel }, i) => (
        <g key={i}>
          <rect x={x} y="42" width="54" height="54" rx="8" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="1.2" strokeOpacity={0.3 + i * 0.17} />
          <text x={x + 27} y="70" textAnchor="middle" fontSize={icon === "Δ" ? 18 : 16} fill={accent} fillOpacity={0.5 + i * 0.12}>{icon}</text>
          <text x={x + 27} y="83" textAnchor="middle" fontSize="8"  fill="rgba(255,255,255,0.65)">{label}</text>
          <text x={x + 27} y="107" textAnchor="middle" fontSize="7"  fill="rgba(255,255,255,0.28)">{sublabel}</text>
          {i < 3 && <line x1={x + 54} y1="69" x2={x + 65} y2="69" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" markerEnd="url(#sd-arr)" />}
        </g>
      ))}
      {/* Noise filter label */}
      <rect x="116" y="104" width="68" height="16" rx="4" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth="1" />
      <text x="150" y="115" textAnchor="middle" fill="#EF4444" fontSize="7" fillOpacity="0.75">noise filtered here</text>
      <line x1="150" y1="96" x2="150" y2="104" stroke="#EF4444" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2,2" />
    </svg>
  );

  if (type === "movement-detection") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="md-bg" cx="30%" cy="50%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="md-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill={accent} fillOpacity="0.65" />
        </marker>
      </defs>
      <rect width="300" height="148" fill="url(#md-bg)" />
      {/* Individual signals on left */}
      {[
        { cx: 48, cy: 44, label: "pricing" },
        { cx: 62, cy: 74, label: "features" },
        { cx: 44, cy: 102, label: "headline" },
      ].map(({ cx, cy, label }, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="9" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="1.2" strokeOpacity="0.5" />
          <text x={cx} y={cy + 4} textAnchor="middle" fill={accent} fontSize="6" fillOpacity="0.75">⚡</text>
          <text x={cx + 16} y={cy + 4} fill="rgba(255,255,255,0.35)" fontSize="7">{label}</text>
        </g>
      ))}
      {/* Grouping bracket */}
      <path d="M 92 38 Q 104 38 104 74 Q 104 110 92 110" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" />
      {/* Arrow */}
      <line x1="108" y1="74" x2="145" y2="74" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#md-arr)" />
      {/* Label */}
      <text x="126" y="68" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.5">14d window</text>
      <text x="126" y="88" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.5">min 2 signals</text>
      {/* Movement badge */}
      <rect x="154" y="52" width="116" height="44" rx="8" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" />
      <text x="212" y="72" textAnchor="middle" fill={accent} fontSize="8.5" fillOpacity="0.9">enterprise_push</text>
      <text x="212" y="86" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7">confidence: 0.78</text>
      <text x="212" y="106" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="7">movement confirmed</text>
    </svg>
  );

  if (type === "sector-intelligence") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="si-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#si-bg)" />
      {/* Competitor nodes */}
      {[
        { cx: 60,  cy: 40,  label: "Co. A" },
        { cx: 240, cy: 40,  label: "Co. B" },
        { cx: 60,  cy: 108, label: "Co. C" },
        { cx: 240, cy: 108, label: "Co. D" },
      ].map(({ cx, cy, label }, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="16" fill="rgba(255,255,255,0.04)" stroke={accent} strokeWidth="1.5" strokeOpacity={0.4 + i * 0.1} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8">{label}</text>
        </g>
      ))}
      {/* Connection lines */}
      {[
        [60,40,240,40],[60,108,240,108],
        [60,40,60,108],[240,40,240,108],
        [60,40,240,108],[240,40,60,108],
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="0.8" strokeOpacity="0.18" strokeDasharray="3,4" />
      ))}
      {/* Central analysis node */}
      <circle cx="150" cy="74" r="22" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="1.8" strokeOpacity="0.7" />
      <text x="150" y="71" textAnchor="middle" fill={accent} fontSize="7.5" fillOpacity="0.9">Sector</text>
      <text x="150" y="82" textAnchor="middle" fill={accent} fontSize="7.5" fillOpacity="0.9">Analysis</text>
      {/* Spokes */}
      {[[60,40],[240,40],[60,108],[240,108]].map(([x,y],i) => (
        <line key={i} x1={150} y1={74} x2={(x as number + 150) / 2} y2={(y as number + 74) / 2} stroke={accent} strokeWidth="1.2" strokeOpacity="0.35" />
      ))}
      <text x="150" y="134" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7">Monday · 07:00 UTC · 30-day window</text>
    </svg>
  );

  if (type === "weekly-brief") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="wb-bg" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="wb-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill={accent} fillOpacity="0.55" />
        </marker>
      </defs>
      <rect width="300" height="148" fill="url(#wb-bg)" />
      {/* Calendar */}
      <rect x="18" y="24" width="72" height="72" rx="6" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="1.2" strokeOpacity="0.35" />
      <rect x="18" y="24" width="72" height="18" rx="6" fill={accent} fillOpacity="0.18" />
      <text x="54" y="37" textAnchor="middle" fill={accent} fontSize="8" fillOpacity="0.85">Monday</text>
      {/* Calendar grid */}
      {[45,57,69,81].map((y) => [25,37,49,61,73].map((x) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="9" height="9" rx="1.5" fill={x === 25 && y === 45 ? accent : "rgba(255,255,255,0.06)"} fillOpacity={x === 25 && y === 45 ? 0.5 : 1} />
      )))}
      <text x="54" y="108" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="7">10:00 UTC</text>
      {/* Arrow */}
      <line x1="96" y1="60" x2="118" y2="60" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" markerEnd="url(#wb-arr)" />
      {/* Artifact sources */}
      <rect x="122" y="20" width="80" height="82" rx="6" fill="rgba(255,255,255,0.02)" stroke={accent} strokeWidth="1" strokeOpacity="0.28" />
      {[
        ["Sector", "Intelligence"],
        ["Movement", "Narratives"],
        ["Radar", "Narratives"],
      ].map(([l1,l2], i) => (
        <g key={i}>
          <circle cx="132" cy={36 + i * 26} r="4" fill={accent} fillOpacity="0.4" />
          <text x="142" y={33 + i * 26} fill="rgba(255,255,255,0.55)" fontSize="7">{l1}</text>
          <text x="142" y={42 + i * 26} fill="rgba(255,255,255,0.35)" fontSize="6">{l2}</text>
        </g>
      ))}
      {/* Arrow to brief */}
      <line x1="206" y1="60" x2="224" y2="60" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" markerEnd="url(#wb-arr)" />
      {/* Brief document */}
      <rect x="228" y="22" width="54" height="76" rx="5" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" />
      {[35,47,59,71,83].map((y) => (
        <rect key={y} x="235" y={y} width={y === 35 ? 40 : 28 + (y % 3) * 4} height="5" rx="1.5" fill={accent} fillOpacity={y === 35 ? 0.35 : 0.1} />
      ))}
      <text x="255" y="112" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7">GPT-4o</text>
    </svg>
  );

  if (type === "pressure-index") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="pi-bg" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="pi-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#2EE6A6" />
          <stop offset="40%"  stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <rect width="300" height="148" fill="url(#pi-bg)" />
      {/* Gauge track */}
      <rect x="30" y="56" width="240" height="18" rx="9" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Filled portion (7.0 / 10) */}
      <rect x="30" y="56" width="168" height="18" rx="9" fill="url(#pi-grad)" fillOpacity="0.75" />
      {/* Scale ticks */}
      {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
        <g key={n}>
          <line x1={30 + n * 24} y1="74" x2={30 + n * 24} y2="80" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <text x={30 + n * 24} y="89" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="7">{n}</text>
        </g>
      ))}
      {/* Indicator pin at 7.0 */}
      <polygon points="198,54 204,42 192,42" fill={accent} fillOpacity="0.85" />
      <text x="198" y="38" textAnchor="middle" fill={accent} fontSize="9" fontWeight="bold" fillOpacity="0.9">7.0</text>
      {/* Zone labels */}
      <text x="54"  y="104" textAnchor="middle" fill="#2EE6A6" fontSize="7" fillOpacity="0.65">Low</text>
      <text x="150" y="104" textAnchor="middle" fill="#F59E0B" fontSize="7" fillOpacity="0.65">Medium</text>
      <text x="246" y="104" textAnchor="middle" fill="#EF4444" fontSize="7" fillOpacity="0.65">High</text>
      {/* Promotion note */}
      <rect x="74" y="112" width="152" height="18" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="150" y="124" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7">≥ 5.0 promotes pending_review signals</text>
      {/* Decay label */}
      <text x="150" y="143" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5">exponential decay — recent signals weight more</text>
    </svg>
  );

  if (type === "selector-repair") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="sr-bg" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="sr-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill={accent} fillOpacity="0.6" />
        </marker>
      </defs>
      <rect width="300" height="148" fill="url(#sr-bg)" />
      {/* Broken selector */}
      <rect x="14" y="34" width="108" height="38" rx="5" fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.35)" strokeWidth="1.2" />
      <text x="68" y="52" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">.price-table</text>
      <text x="68" y="64" textAnchor="middle" fill="#EF4444" fontSize="7" fillOpacity="0.7">✕ no match</text>
      {/* Process steps */}
      <rect x="14" y="84" width="108" height="46" rx="5" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x="68" y="100" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="7">re-fetch live HTML</text>
      <text x="68" y="112" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="7">GPT-4o-mini proposes</text>
      <text x="68" y="124" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="7">Cheerio validates</text>
      {/* Arrow */}
      <line x1="128" y1="74" x2="168" y2="74" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" markerEnd="url(#sr-arr)" />
      <text x="148" y="68" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.5">Auto-repair</text>
      {/* Fixed selector */}
      <rect x="176" y="34" width="110" height="38" rx="5" fill="rgba(16,185,129,0.07)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" />
      <text x="231" y="52" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">[data-price]</text>
      <text x="231" y="64" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.8">✓ validated</text>
      {/* Operator review note */}
      <rect x="176" y="84" width="110" height="46" rx="5" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="231" y="100" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="7">operator reviews</text>
      <text x="231" y="112" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="7">never auto-applied</text>
      <text x="231" y="124" textAnchor="middle" fill="#F59E0B" fontSize="7" fillOpacity="0.7">⚠ human approval</text>
    </svg>
  );

  if (type === "signal-velocity") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="sv-bg" cx="60%" cy="70%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#sv-bg)" />
      {/* Y axis */}
      <line x1="36" y1="16" x2="36" y2="118" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="36" y1="118" x2="282" y2="118" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Bars — 7 days, accelerating */}
      {[
        { x: 46,  h: 12, label: "Mon" },
        { x: 80,  h: 16, label: "Tue" },
        { x: 114, h: 20, label: "Wed" },
        { x: 148, h: 28, label: "Thu" },
        { x: 182, h: 38, label: "Fri" },
        { x: 216, h: 54, label: "Sat" },
        { x: 250, h: 76, label: "Sun" },
      ].map(({ x, h, label }, i) => (
        <g key={i}>
          <rect x={x} y={118 - h} width="26" height={h} rx="3"
            fill={accent}
            fillOpacity={0.22 + i * 0.10}
            stroke={accent} strokeWidth="1" strokeOpacity={0.3 + i * 0.1}
          />
          <text x={x + 13} y="130" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="6.5">{label}</text>
        </g>
      ))}
      {/* Trend line */}
      <polyline
        points="59,106 93,102 127,98 161,90 195,80 229,64 263,42"
        fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="3,2"
      />
      {/* Velocity badge */}
      <rect x="192" y="18" width="96" height="22" rx="5" fill={accent} fillOpacity="0.14" stroke={accent} strokeWidth="1" strokeOpacity="0.45" />
      <text x="240" y="33" textAnchor="middle" fill={accent} fontSize="8" fillOpacity="0.9">↑ Accelerating</text>
      {/* Y label */}
      <text x="12" y="68" textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="6.5" transform="rotate(-90 12 68)">signals/day</text>
    </svg>
  );

  if (type === "confidence-model") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="cm-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#cm-bg)" />
      {/* Three threshold bands */}
      {[
        { y: 22,  h: 30, color: "#EF4444", range: "< 0.35",      label: "Suppressed",    sublabel: "never created" },
        { y: 60,  h: 30, color: "#F59E0B", range: "0.35 – 0.64", label: "Pending Review", sublabel: "waits for pressure ≥ 5" },
        { y: 98,  h: 30, color: "#2EE6A6", range: "≥ 0.65",      label: "Active",         sublabel: "sent to interpretation" },
      ].map(({ y, h, color, range, label, sublabel }, i) => (
        <g key={i}>
          <rect x="14" y={y} width="272" height={h} rx="5"
            fill={color} fillOpacity="0.07"
            stroke={color} strokeWidth="1.2" strokeOpacity="0.35"
          />
          {/* Score label */}
          <rect x="18" y={y + 5} width="64" height="20" rx="3" fill={color} fillOpacity="0.18" />
          <text x="50" y={y + 18} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace" fillOpacity="0.9">{range}</text>
          {/* Outcome */}
          <text x="98" y={y + 15} fill="rgba(255,255,255,0.7)" fontSize="8.5" fontWeight="600">{label}</text>
          <text x="98" y={y + 26} fill="rgba(255,255,255,0.32)" fontSize="7">{sublabel}</text>
          {/* Status icon */}
          <text x="272" y={y + 18} textAnchor="middle" fill={color} fontSize="11" fillOpacity="0.7">
            {color === "#EF4444" ? "✕" : color === "#F59E0B" ? "⏸" : "✓"}
          </text>
        </g>
      ))}
    </svg>
  );

  if (type === "page-classes") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="pc-bg" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#pc-bg)" />
      {[
        { y: 18,  emoji: "⭐", class: "high_value", pages: "pricing · changelog · newsroom", freq: "Every hour",   color: "#F59E0B", bonus: "+0.08 confidence" },
        { y: 60,  emoji: "●",  class: "standard",   pages: "homepage · features",            freq: "Every 3h",    color: accent,    bonus: "base confidence" },
        { y: 100, emoji: "○",  class: "ambient",    pages: "blog · careers",                 freq: "Every 30min", color: "#64748B", bonus: "activity only" },
      ].map(({ y, emoji, class: cls, pages, freq, color, bonus }) => (
        <g key={cls}>
          <rect x="12" y={y} width="276" height="34" rx="5"
            fill="rgba(255,255,255,0.02)"
            stroke={color} strokeWidth="1.2" strokeOpacity="0.35"
          />
          <text x="32" y={y + 20} textAnchor="middle" fontSize="13" fill={color} fillOpacity="0.8">{emoji}</text>
          <text x="50" y={y + 14} fill={color} fontSize="8.5" fontWeight="600" fillOpacity="0.85">{cls}</text>
          <text x="50" y={y + 25} fill="rgba(255,255,255,0.32)" fontSize="6.5">{pages}</text>
          <rect x="196" y={y + 6} width="56" height="14" rx="3" fill={color} fillOpacity="0.15" />
          <text x="224" y={y + 17} textAnchor="middle" fill={color} fontSize="7" fillOpacity="0.85">{freq}</text>
          <text x="263" y={y + 19} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="6.5">{bonus}</text>
        </g>
      ))}
    </svg>
  );

  if (type === "critical-alert") return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="ca-bg" cx="40%" cy="50%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="ca-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill={accent} fillOpacity="0.65" />
        </marker>
      </defs>
      <rect width="300" height="148" fill="url(#ca-bg)" />
      {/* Five criteria */}
      {[
        { label: "momentum ≥ 7",           detail: "accelerating threshold" },
        { label: "signals_7d ≥ 3",         detail: "confirmed signal density" },
        { label: "confidence ≥ 0.70",      detail: "above pending gate" },
        { label: "movement_type present",  detail: "pattern identified" },
        { label: "last seen < 48h",        detail: "data is fresh" },
      ].map(({ label, detail }, i) => (
        <g key={i}>
          <rect x="14" y={12 + i * 25} width="10" height="10" rx="2"
            fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.2" strokeOpacity="0.6"
          />
          <text x="20" y={12 + i * 25 + 8} textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.85">✓</text>
          <text x="32" y={12 + i * 25 + 8} fill="rgba(255,255,255,0.65)" fontSize="8">{label}</text>
          <text x="160" y={12 + i * 25 + 8} fill="rgba(255,255,255,0.25)" fontSize="6.5">{detail}</text>
        </g>
      ))}
      {/* Arrow */}
      <line x1="200" y1="74" x2="218" y2="74" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" markerEnd="url(#ca-arr)" />
      {/* Alert badge */}
      <rect x="222" y="56" width="64" height="36" rx="7"
        fill={accent} fillOpacity="0.14"
        stroke={accent} strokeWidth="1.8" strokeOpacity="0.7"
      />
      <text x="254" y="73" textAnchor="middle" fill={accent} fontSize="12" fillOpacity="0.9">⚡</text>
      <text x="254" y="83" textAnchor="middle" fill={accent} fontSize="7" fillOpacity="0.7">ALERT</text>
      <text x="254" y="106" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="6.5">all 5 required</text>
    </svg>
  );

  // momentum-states (default)
  return (
    <svg viewBox="0 0 300 148" style={s} aria-hidden>
      <defs>
        <radialGradient id="ms-bg" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="148" fill="url(#ms-bg)" />
      {[
        { x: 18,  color: "#64748B", label: "Cooling",      score: "< 1.5",  node: 7,  icon: "↓" },
        { x: 88,  color: "#2EE6A6", label: "Stable",       score: "1.5–3",  node: 9,  icon: "→" },
        { x: 163, color: "#F59E0B", label: "Rising",        score: "3–5",    node: 12, icon: "↑" },
        { x: 238, color: "#EF4444", label: "Accelerating",  score: "≥ 5",   node: 16, icon: "⚡" },
      ].map(({ x, color, label, score, node, icon }, i) => (
        <g key={i}>
          {/* Echo rings for active states */}
          {i > 0 && <circle cx={x + 27} cy="74" r={node + 10} fill="none" stroke={color} strokeWidth="0.8" strokeOpacity={0.12 + i * 0.08} />}
          {i > 1 && <circle cx={x + 27} cy="74" r={node + 18} fill="none" stroke={color} strokeWidth="0.8" strokeOpacity={0.07 + i * 0.04} />}
          {/* Node */}
          <circle cx={x + 27} cy="74" r={node} fill={color} fillOpacity={0.2 + i * 0.12} stroke={color} strokeWidth="1.5" strokeOpacity={0.4 + i * 0.15} />
          <text x={x + 27} y="78" textAnchor="middle" fill={color} fontSize={9 + i} fillOpacity="0.9">{icon}</text>
          {/* Labels */}
          <text x={x + 27} y="104" textAnchor="middle" fill={color} fontSize="7.5" fillOpacity="0.8">{label}</text>
          <text x={x + 27} y="115" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="6.5">{score}</text>
          {/* Score badge */}
          <rect x={x + 10} y="118" width="34" height="12" rx="3" fill={color} fillOpacity="0.12" />
          <text x={x + 27} y="127" textAnchor="middle" fill={color} fontSize="6" fillOpacity="0.65">score {score}</text>
        </g>
      ))}
      <text x="150" y="142" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5">larger node = higher momentum</text>
    </svg>
  );
}

// ── Category badge config ──────────────────────────────────────────────────────

const CAT: Record<FeaturePanel["category"], { label: string; color: string }> = {
  detection: { label: "Detection",  color: "#3B82F6" },
  analysis:  { label: "Analysis",   color: "#8B5CF6" },
  interface: { label: "Interface",  color: "#2EE6A6" },
  delivery:  { label: "Delivery",   color: "#F59E0B" },
  system:    { label: "System",     color: "#10B981" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ExpandSkeleton() {
  return (
    <div className="space-y-2 mt-3">
      {[100, 88, 92, 75, 82].map((w, i) => (
        <div key={i} className="h-2 rounded animate-pulse"
          style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)" }} />
      ))}
    </div>
  );
}

function StepRow({ step }: { step: FeatureStep }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex flex-col items-center shrink-0" style={{ minHeight: 26 }}>
        <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "rgba(255,255,255,0.25)" }} />
        <div className="w-px flex-1 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div className="pb-2.5 min-w-0">
        <span className="text-[10px] font-bold tracking-wider mr-1.5 text-slate-300">{step.step}</span>
        <span className="text-[11px] text-slate-400 leading-snug">{step.detail}</span>
      </div>
    </div>
  );
}

function rgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FeatureDiscoveryPanel() {
  const [panel,       setPanel]       = useState<FeaturePanel | null>(null);
  const [expanded,    setExpanded]    = useState(false);
  const [content,     setContent]     = useState<FeatureExpandedContent | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [expandError, setExpandError] = useState(false);
  const [ready,       setReady]       = useState(false);

  useEffect(() => { setReady(true); }, []);

  // Try to show a panel, respecting the global panel coordinator
  const tryShow = useCallback(() => {
    if (!canShowPanel()) return;
    const next = pickNext();
    if (!next) return;
    markShown(next.id);
    setPanelOpen();
    setPanel(next);
  }, []);

  // First appearance: 10–15 minutes after mount
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(tryShow, randomDelay(600_000, 900_000));
    return () => clearTimeout(t);
  }, [ready, tryShow]);

  const scheduleNext = useCallback(() => {
    setTimeout(tryShow, randomDelay(600_000, 900_000));
  }, [tryShow]);

  const handleClose = useCallback(() => {
    setPanelClosed();
    setPanel(null);
    setExpanded(false);
    setContent(null);
    setExpandError(false);
    scheduleNext();
  }, [scheduleNext]);

  const handleLearnMore = useCallback(async () => {
    if (!panel) return;
    setExpanded(true);
    if (content) return;
    setLoading(true);
    setExpandError(false);
    try {
      const res = await fetch("/api/expand-feature-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelId: panel.id, prompt: panel.explanation_prompt }),
      });
      if (!res.ok) throw new Error("non-ok");
      setContent(await res.json());
    } catch {
      setExpandError(true);
    } finally {
      setLoading(false);
    }
  }, [panel, content]);

  if (!ready || !panel) return null;

  const cat = CAT[panel.category];

  return (
    <AnimatePresence>
      <motion.div
        key={panel.id}
        drag
        dragMomentum={false}
        dragElastic={0}
        layout
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0,   scale: 1 }}
        exit={{    opacity: 0, y: 18,   scale: 0.96, transition: { duration: 0.20 } }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position:             "fixed",
          bottom:               28,
          right:                28,
          width:                expanded ? 500 : 348,
          maxWidth:             "calc(100vw - 40px)",
          maxHeight:            expanded ? "calc(100vh - 72px)" : "auto",
          zIndex:               55,
          cursor:               "grab",
          userSelect:           "none",
          borderRadius:         14,
          background:           "rgba(4, 8, 12, 0.90)",
          backdropFilter:       "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border:               "1px solid rgba(255,255,255,0.07)",
          boxShadow:            `0 28px 64px rgba(0,0,0,0.72), 0 0 0 1px rgba(${rgb(panel.accent)},0.14), 0 0 44px rgba(${rgb(panel.accent)},0.05)`,
          display:              "flex",
          flexDirection:        "column",
          overflow:             "hidden",
        }}
      >
        {/* Accent line — slightly different gradient from historical panels to signal different purpose */}
        <div style={{ height: 2, flexShrink: 0, background: `linear-gradient(90deg, transparent, ${panel.accent}70, transparent)` }} />

        {/* "How it works" system label */}
        <div
          className="px-4 pt-2 pb-0"
          style={{ flexShrink: 0 }}
        >
          <span
            className="text-[8px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "rgba(255,255,255,0.18)" }}
          >
            How it works
          </span>
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-1 pb-2" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid grid-cols-2 gap-[3px] shrink-0">
              {[0,1,2,3].map((i) => (
                <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
              ))}
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-[2px] rounded-full shrink-0"
              style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}
            >
              {cat.label}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)", cursor: "pointer" }}
            aria-label="Close"
          >
            <svg width="8" height="8" viewBox="0 0 8 8">
              <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="px-4 pb-4"
          style={{ overflowY: expanded ? "auto" : "visible", overflowX: "hidden", flexShrink: 1, minHeight: 0 }}
        >
          <h3 className="text-[14px] font-bold leading-snug mb-1" style={{ color: "rgba(255,255,255,0.92)" }}>
            {panel.short_title}
          </h3>
          <p className="text-[10px] font-semibold mb-3" style={{ color: panel.accent, opacity: 0.72 }}>
            {panel.feature_name}
          </p>

          {/* Diagram — hidden when expanded */}
          {!expanded && (
            <div
              className="rounded-lg overflow-hidden mb-3"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${panel.accent}1a` }}
            >
              <Diagram type={panel.diagram} accent={panel.accent} />
            </div>
          )}

          {/* Key points */}
          <ul className="space-y-2 mb-4">
            {panel.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: panel.accent, opacity: 0.6 }} />
                <span className="text-[11px] text-slate-400 leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>

          {/* Expanded content */}
          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28 }}>
              <div className="h-px mb-4" style={{ background: "rgba(255,255,255,0.05)" }} />

              {loading && <ExpandSkeleton />}
              {expandError && (
                <p className="text-[11px] text-slate-600 italic">Unable to load explanation. Try again shortly.</p>
              )}

              {content && (
                <div className="space-y-5">
                  {/* Overview */}
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: panel.accent }}>
                      How it works
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{content.overview}</p>
                  </div>

                  {/* Steps */}
                  {!!content.how_it_works?.length && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: panel.accent }}>
                        Step by Step
                      </div>
                      {content.how_it_works.map((step, i) => <StepRow key={i} step={step} />)}
                    </div>
                  )}

                  {/* Example */}
                  {content.example && (
                    <div className="rounded-lg p-3" style={{ background: `rgba(${rgb(panel.accent)},0.05)`, border: `1px solid rgba(${rgb(panel.accent)},0.13)` }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: panel.accent }}>
                        Example
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: `rgba(${rgb(panel.accent)},0.78)` }}>
                        {content.example}
                      </p>
                    </div>
                  )}

                  {/* User benefit */}
                  {content.user_benefit && (
                    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-[9px] font-bold uppercase tracking-widest mr-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                        Why this matters
                      </span>
                      <span className="text-[11px] text-slate-300 italic leading-relaxed">{content.user_benefit}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Action row */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {!expanded ? (
              <button
                onClick={handleLearnMore}
                className="w-full py-2 rounded-lg text-[11px] font-semibold transition-all duration-200"
                style={{
                  background: `rgba(${rgb(panel.accent)},0.10)`,
                  color:      panel.accent,
                  border:     `1px solid rgba(${rgb(panel.accent)},0.22)`,
                  cursor:     "pointer",
                }}
              >
                Learn More →
              </button>
            ) : (
              <button
                onClick={() => setExpanded(false)}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                style={{ cursor: "pointer" }}
              >
                ↑ Collapse
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
