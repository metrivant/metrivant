"use client";

/**
 * HistoricalCapsule — Historical Intelligence Learning System
 *
 * Surfaces draggable, illustrated case studies of real competitive
 * intelligence failures. Appears 90 seconds after dashboard load, then
 * every 2.5 minutes after dismissal. Session-deduplicated. One visible
 * at a time. "Learn More" triggers an AI-generated structured expansion.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { INTEL_STORIES } from "../lib/intel-stories";
import type { IntelStory, IllustrationKey } from "../lib/intel-stories";
import type { ExpandedContent, TimelineEvent } from "../app/api/expand-intel-story/route";
import { canShowPanel, setPanelOpen, setPanelClosed, randomDelay } from "../lib/panel-coordinator";

// ── Session dedup ─────────────────────────────────────────────────────────────

const SESSION_KEY = "mv_intel_capsules_shown";

function getShownIds(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]"); } catch { return []; }
}
function markShown(id: string): void {
  const current = getShownIds();
  if (!current.includes(id)) sessionStorage.setItem(SESSION_KEY, JSON.stringify([...current, id]));
}
function pickNext(): IntelStory | null {
  const shown = getShownIds();
  const pool  = INTEL_STORIES.filter((s) => !shown.includes(s.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Illustrations ─────────────────────────────────────────────────────────────

function Illustration({ type, accent }: { type: IllustrationKey; accent: string }) {
  const style = { width: "100%", height: "136px" } as const;

  if (type === "store") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="st-bg" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#st-bg)" />
      <rect x="0" y="108" width="300" height="28" fill="rgba(255,255,255,0.02)" />
      {/* Big store */}
      <rect x="28" y="32" width="112" height="76" rx="3" fill="rgba(255,255,255,0.04)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" />
      <rect x="28" y="32" width="112" height="18" rx="3" fill={accent} fillOpacity="0.18" />
      <rect x="40" y="66" width="24" height="30" rx="2" fill="rgba(255,255,255,0.05)" />
      <rect x="74" y="66" width="24" height="30" rx="2" fill="rgba(255,255,255,0.05)" />
      <rect x="108" y="66" width="24" height="30" rx="2" fill="rgba(255,255,255,0.05)" />
      <rect x="52" y="40" width="44" height="11" rx="3" fill="#EF4444" fillOpacity="0.82" />
      <text x="74" y="49" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="monospace">CLOSED</text>
      {/* Small disruptor */}
      <rect x="198" y="70" width="58" height="38" rx="3" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.75" />
      <rect x="198" y="70" width="58" height="12" rx="2" fill={accent} fillOpacity="0.28" />
      <line x1="148" y1="82" x2="192" y2="72" stroke={accent} strokeWidth="1.5" strokeDasharray="3,3" strokeOpacity="0.65" />
      <polygon points="192,68 199,73 187,76" fill={accent} fillOpacity="0.65" />
      <circle cx="256" cy="18" r="1.5" fill={accent} fillOpacity="0.5" />
      <circle cx="240" cy="9"  r="1"   fill={accent} fillOpacity="0.35" />
      <circle cx="272" cy="13" r="1"   fill={accent} fillOpacity="0.45" />
    </svg>
  );

  if (type === "camera") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="ca-bg" cx="28%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="ca-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill={accent} fillOpacity="0.75" />
        </marker>
      </defs>
      <rect width="300" height="136" fill="url(#ca-bg)" />
      <rect x="18" y="42" width="82" height="54" rx="6" fill="rgba(255,255,255,0.04)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.45" />
      <circle cx="59" cy="69" r="19" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.45" />
      <circle cx="59" cy="69" r="10" fill={accent} fillOpacity="0.12" />
      <circle cx="59" cy="69" r="4"  fill={accent} fillOpacity="0.48" />
      <rect x="18" y="49" width="13" height="12" rx="2" fill={accent} fillOpacity="0.22" />
      <rect x="87" y="49" width="13" height="12" rx="2" fill={accent} fillOpacity="0.22" />
      <line x1="22" y1="45" x2="97" y2="93" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.55" />
      <line x1="97" y1="45" x2="22" y2="93" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.55" />
      <line x1="112" y1="69" x2="160" y2="69" stroke={accent} strokeWidth="1.8" strokeDasharray="4,3" strokeOpacity="0.75" markerEnd="url(#ca-arr)" />
      <rect x="168" y="47" width="72" height="50" rx="5" fill="rgba(255,255,255,0.04)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.75" />
      {[59,69,79,89].map((y) => <g key={y}>
        <rect x="161" y={y} width="7" height="3" rx="1" fill={accent} fillOpacity="0.38" />
        <rect x="240" y={y} width="7" height="3" rx="1" fill={accent} fillOpacity="0.38" />
      </g>)}
      <rect x="183" y="59" width="42" height="28" rx="3" fill={accent} fillOpacity="0.12" />
      <text x="204" y="77" textAnchor="middle" fill={accent} fontSize="10" fontFamily="monospace" fillOpacity="0.85">01</text>
    </svg>
  );

  if (type === "phone") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="ph-bg" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.07" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#ph-bg)" />
      {/* Old phone */}
      <rect x="32" y="22" width="58" height="92" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      {[68,80,92,104].map((y) => [39,50,61,72].map((x) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="8" height="6" rx="1" fill="rgba(255,255,255,0.07)" />
      )))}
      <rect x="40" y="32" width="42" height="26" rx="2" fill="rgba(255,255,255,0.05)" />
      <rect x="71" y="15" width="4" height="12" rx="2" fill="rgba(255,255,255,0.18)" />
      <line x1="35"  y1="25" x2="87"  y2="111" stroke="#EF4444" strokeWidth="1.4" strokeOpacity="0.50" />
      <line x1="87"  y1="25" x2="35"  y2="111" stroke="#EF4444" strokeWidth="1.4" strokeOpacity="0.50" />
      <text x="150" y="74" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="14">→</text>
      {/* Slim smartphone */}
      <rect x="192" y="18" width="68" height="100" rx="10" fill="rgba(255,255,255,0.04)" stroke={accent} strokeWidth="2" strokeOpacity="0.85" />
      <rect x="198" y="30" width="56" height="76" rx="6" fill={accent} fillOpacity="0.10" />
      <circle cx="226" cy="112" r="4" fill="rgba(255,255,255,0.08)" stroke={accent} strokeWidth="1" strokeOpacity="0.45" />
      {[[200,36],[214,36],[228,36],[242,36],[200,50],[214,50],[228,50],[242,50],[200,64],[214,64],[228,64],[242,64]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="10" height="10" rx="2" fill={accent} fillOpacity={0.08 + (i % 4) * 0.04} />
      ))}
      <circle cx="226" cy="68" r="36" fill={accent} fillOpacity="0.035" />
    </svg>
  );

  if (type === "glass") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="gl-bg" cx="38%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#gl-bg)" />
      <circle cx="98" cy="63" r="42" fill="rgba(255,255,255,0.02)" stroke={accent} strokeWidth="2.5" strokeOpacity="0.55" />
      <circle cx="98" cy="63" r="30" fill={accent} fillOpacity="0.05" />
      <line x1="65" y1="92" x2="30" y2="116" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeOpacity="0.65" />
      <text x="98" y="72" textAnchor="middle" fill={accent} fontSize="28" fontFamily="serif" fillOpacity="0.55">?</text>
      <circle cx="228" cy="63" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeDasharray="4,3" />
      <circle cx="228" cy="63" r="19" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" strokeDasharray="4,3" />
      <circle cx="228" cy="63" r="7" fill={accent} fillOpacity="0.18" />
      <circle cx="228" cy="63" r="3" fill={accent} fillOpacity="0.65" />
      <path d="M 148 63 Q 186 43 206 57" stroke={accent} strokeWidth="1.5" fill="none" strokeDasharray="4,3" strokeOpacity="0.48" />
      <polygon points="203,52 210,60 198,60" fill={accent} fillOpacity="0.48" />
    </svg>
  );

  if (type === "deal") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="dl-bg" cx="50%" cy="40%" r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#dl-bg)" />
      <path d="M 58 90 Q 78 74 100 79 L 142 79 Q 158 79 158 90 L 158 100 Q 158 108 142 108 L 78 108 Q 58 108 58 90 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      {[93,106,119,132].map((x) => <rect key={x} x={x} y="69" width="10" height="18" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />)}
      <path d="M 242 90 Q 222 74 200 79 L 158 79 Q 142 79 142 90 L 142 100 Q 142 108 158 108 L 222 108 Q 242 108 242 90 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      {[158,171,184,197].map((x) => <rect key={x} x={x} y="69" width="10" height="18" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />)}
      <circle cx="150" cy="54" r="22" fill={accent} fillOpacity="0.13" stroke={accent} strokeWidth="1.5" strokeOpacity="0.45" />
      <text x="150" y="62" textAnchor="middle" fill={accent} fontSize="20" fontWeight="bold" fillOpacity="0.75">$</text>
      <line x1="58"  y1="34" x2="242" y2="118" stroke="#EF4444" strokeWidth="3" strokeOpacity="0.55" strokeLinecap="round" />
      <line x1="242" y1="34" x2="58"  y2="118" stroke="#EF4444" strokeWidth="3" strokeOpacity="0.55" strokeLinecap="round" />
    </svg>
  );

  if (type === "clock") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="ck-bg" cx="50%" cy="50%" r="54%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#ck-bg)" />
      <circle cx="150" cy="68" r="54" fill="rgba(255,255,255,0.02)" stroke={accent} strokeWidth="2" strokeOpacity="0.48" />
      <circle cx="150" cy="68" r="47" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.18" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        return <line key={i} x1={150 + 40 * Math.cos(a)} y1={68 + 40 * Math.sin(a)} x2={150 + 47 * Math.cos(a)} y2={68 + 47 * Math.sin(a)} stroke={accent} strokeWidth={i % 3 === 0 ? 2 : 1} strokeOpacity="0.38" />;
      })}
      {/* 11:58 — nearly too late */}
      <line x1="150" y1="68" x2="133" y2="24" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.88" />
      <line x1="150" y1="68" x2="117" y2="42" stroke={accent} strokeWidth="4"   strokeLinecap="round" strokeOpacity="0.78" />
      <circle cx="150" cy="68" r="5" fill={accent} fillOpacity="0.78" />
      <circle cx="218" cy="28" r="14" fill="#EF4444" fillOpacity="0.18" stroke="#EF4444" strokeWidth="1.5" strokeOpacity="0.65" />
      <text x="218" y="34" textAnchor="middle" fill="#EF4444" fontSize="16" fillOpacity="0.88">!</text>
    </svg>
  );

  if (type === "map") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="mp-bg" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="mp-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill={accent} fillOpacity="0.65" />
        </marker>
      </defs>
      <rect width="300" height="136" fill="url(#mp-bg)" />
      <rect x="18" y="22" width="102" height="88" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      <path d="M 32 47 Q 58 37 78 53 Q 99 65 118 48" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
      <path d="M 22 68 Q 54 62 70 73 Q 90 80 118 68" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <path d="M 28 90 Q 50 84 74 92 Q 95 98 118 86" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <circle cx="70" cy="63" r="6" fill={accent} fillOpacity="0.28" stroke={accent} strokeWidth="1.5" strokeOpacity="0.45" />
      <line x1="22" y1="25" x2="117" y2="107" stroke="#EF4444" strokeWidth="2" strokeOpacity="0.48" />
      <line x1="117" y1="25" x2="22" y2="107" stroke="#EF4444" strokeWidth="2" strokeOpacity="0.48" />
      <line x1="130" y1="66" x2="170" y2="66" stroke={accent} strokeWidth="1.5" strokeDasharray="4,3" strokeOpacity="0.68" markerEnd="url(#mp-arr)" />
      <path d="M 214 36 Q 214 20 228 20 Q 242 20 242 36 Q 242 53 228 66 Q 214 53 214 36 Z" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="1.5" strokeOpacity="0.68" />
      <circle cx="228" cy="36" r="6" fill={accent} fillOpacity="0.48" />
      <line x1="228" y1="20" x2="228" y2="6"  stroke={accent} strokeWidth="1" strokeOpacity="0.38" strokeDasharray="2,2" />
      <line x1="228" y1="6"  x2="258" y2="2"  stroke={accent} strokeWidth="1" strokeOpacity="0.38" strokeDasharray="2,2" />
      <rect x="256" y="0" width="10" height="6" rx="1" fill={accent} fillOpacity="0.38" />
    </svg>
  );

  if (type === "book") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="bk-bg" cx="38%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#bk-bg)" />
      <rect x="18" y="32" width="92" height="76" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      <rect x="18" y="32" width="10" height="76" rx="2" fill={accent} fillOpacity="0.18" />
      {[44,54,64,74,84,94].map((y) => <line key={y} x1="34" y1={y} x2="106" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
      <text x="64" y="78" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="12" fontFamily="serif">Vol. XIV</text>
      <line x1="21"  y1="35" x2="107" y2="105" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.48" />
      <line x1="107" y1="35" x2="21"  y2="105" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.48" />
      <path d="M 122 68 L 166 68" stroke={accent} strokeWidth="1.5" strokeDasharray="4,3" strokeOpacity="0.65" />
      <polygon points="163,63 171,68 163,73" fill={accent} fillOpacity="0.65" />
      {[
        [184,43],[199,36],[214,41],[228,35],[243,42],[257,38],
        [177,60],[191,56],[206,53],[220,59],[235,54],[250,58],
        [183,77],[197,73],[212,70],[226,76],[241,71],[255,75],
        [188,94],[203,90],[217,87],[232,93],[247,88],
      ].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="3.5" fill={accent} fillOpacity={0.07 + (i % 5) * 0.025} />)}
      <text x="216" y="116" textAnchor="middle" fill={accent} fontSize="8" fillOpacity="0.42" fontFamily="monospace">∞ contributors</text>
    </svg>
  );

  if (type === "server") return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="sv-bg" cx="60%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <marker id="sv-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill={accent} fillOpacity="0.65" />
        </marker>
      </defs>
      <rect width="300" height="136" fill="url(#sv-bg)" />
      <rect x="22" y="18" width="72" height="100" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      {[22,36,50,64,78,92].map((y) => <g key={y}>
        <rect x="26" y={y} width="64" height="10" rx="1" fill="rgba(255,255,255,0.03)" />
        <circle cx="36" cy={y + 5} r="2.5" fill={accent} fillOpacity={y < 64 ? 0.22 : 0.65} />
        <rect x="42" y={y + 3} width="36" height="4" rx="1" fill="rgba(255,255,255,0.04)" />
      </g>)}
      <line x1="25" y1="21"  x2="91" y2="115" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.48" />
      <line x1="91" y1="21"  x2="25" y2="115" stroke="#EF4444" strokeWidth="1.8" strokeOpacity="0.48" />
      <path d="M 104 68 L 148 68" stroke={accent} strokeWidth="1.5" strokeDasharray="4,3" strokeOpacity="0.68" markerEnd="url(#sv-arr)" />
      <path d="M 183 65 Q 183 44 202 44 Q 207 29 228 31 Q 248 24 256 44 Q 276 44 273 65 Z" fill="rgba(255,255,255,0.03)" stroke={accent} strokeWidth="2" strokeOpacity="0.75" />
      {[78,98,118].map((x) => <line key={x} x1={x + 82} y1="80" x2={x + 82} y2="110" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" />)}
      <line x1="188" y1="110" x2="270" y2="110" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" />
    </svg>
  );

  // chart (default)
  return (
    <svg viewBox="0 0 300 136" style={style} aria-hidden>
      <defs>
        <radialGradient id="ch-bg" cx="50%" cy="80%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="300" height="136" fill="url(#ch-bg)" />
      {[38,58,78,98,118].map((y) => <line key={y} x1="28" y1={y} x2="268" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
      <polyline points="28,118 68,98 108,78 143,53 168,38" fill="none" stroke={accent} strokeWidth="2.5" strokeOpacity="0.65" />
      <polyline points="168,38 198,36 220,40 234,90 250,116 268,118" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeOpacity="0.78" />
      <circle cx="198" cy="36" r="5" fill={accent} fillOpacity="0.78" />
      <polygon points="198,16 213,36 183,36" fill="#F59E0B" fillOpacity="0.68" />
      <text x="198" y="32" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">!</text>
      {[113,143].map((x, j) => <g key={x}>
        <circle cx={x} cy={j === 0 ? 78 : 53} r="5" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.55" />
        <line x1={x} y1={j === 0 ? 66 : 41} x2={x} y2={j === 0 ? 56 : 31} stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.48" strokeDasharray="2,2" />
      </g>)}
      <text x="28" y="132" fill={accent} fontSize="8" fillOpacity="0.38" fontFamily="monospace">signals were visible</text>
    </svg>
  );
}

// ── Category badge config ──────────────────────────────────────────────────────

const CAT: Record<IntelStory["category"], { label: string; color: string }> = {
  collapse:   { label: "Collapse",     color: "#EF4444" },
  disruption: { label: "Disruption",   color: "#F59E0B" },
  blindside:  { label: "Blindside",    color: "#8B5CF6" },
  misread:    { label: "Misread",      color: "#06B6D4" },
  pivot:      { label: "Missed Pivot", color: "#2EE6A6" },
};

const TIMELINE_COLORS: Record<TimelineEvent["type"], string> = {
  warning:  "#F59E0B",
  missed:   "#EF4444",
  collapse: "#DC2626",
  lesson:   "#2EE6A6",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex flex-col items-center shrink-0" style={{ minHeight: 28 }}>
        <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: TIMELINE_COLORS[ev.type] }} />
        <div className="w-px flex-1 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div className="pb-3 min-w-0">
        <span className="text-[10px] font-bold tracking-wider mr-1.5" style={{ color: TIMELINE_COLORS[ev.type] }}>
          {ev.year}
        </span>
        <span className="text-[11px] text-slate-400 leading-snug">{ev.event}</span>
      </div>
    </div>
  );
}

function ExpandSkeleton() {
  return (
    <div className="space-y-2 mt-3">
      {[100, 85, 92, 72, 88].map((w, i) => (
        <div key={i} className="h-2 rounded animate-pulse"
          style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)" }} />
      ))}
    </div>
  );
}

// ── Hex to r,g,b ──────────────────────────────────────────────────────────────

function rgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoricalCapsule() {
  const [story,       setStory]       = useState<IntelStory | null>(null);
  const [expanded,    setExpanded]    = useState(false);
  const [content,     setContent]     = useState<ExpandedContent | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [expandError, setExpandError] = useState(false);
  const [ready,       setReady]       = useState(false);

  // Only run client-side to avoid SSR mismatch with sessionStorage
  useEffect(() => { setReady(true); }, []);

  // First panel after 6–10 minutes
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      if (!canShowPanel()) return;
      const next = pickNext();
      if (next) { markShown(next.id); setStory(next); setPanelOpen(); }
    }, randomDelay(360_000, 600_000));
    return () => clearTimeout(t);
  }, [ready]);

  const scheduleNext = useCallback(() => {
    setTimeout(() => {
      if (!canShowPanel()) return;
      const next = pickNext();
      if (next) { markShown(next.id); setStory(next); setPanelOpen(); }
    }, randomDelay(360_000, 600_000));
  }, []);

  const handleClose = useCallback(() => {
    setPanelClosed();
    setStory(null);
    setExpanded(false);
    setContent(null);
    setExpandError(false);
    scheduleNext();
  }, [scheduleNext]);

  const handleLearnMore = useCallback(async () => {
    if (!story) return;
    setExpanded(true);
    if (content) return;
    setLoading(true);
    setExpandError(false);
    try {
      const res = await fetch("/api/expand-intel-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id, prompt: story.ai_expansion_prompt }),
      });
      if (!res.ok) throw new Error("non-ok");
      setContent(await res.json());
    } catch {
      setExpandError(true);
    } finally {
      setLoading(false);
    }
  }, [story, content]);

  if (!ready || !story) return null;

  const cat = CAT[story.category];

  return (
    <AnimatePresence>
      <motion.div
        key={story.id}
        drag
        dragMomentum={false}
        dragElastic={0}
        layout
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0,   scale: 1 }}
        exit={{    opacity: 0, y: 18,   scale: 0.96, transition: { duration: 0.20 } }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position:           "fixed",
          bottom:             28,
          right:              28,
          width:              expanded ? 500 : 348,
          maxWidth:           "calc(100vw - 40px)",
          maxHeight:          expanded ? "calc(100vh - 72px)" : "auto",
          zIndex:             55,
          cursor:             "grab",
          userSelect:         "none",
          borderRadius:       14,
          background:         "rgba(5, 9, 7, 0.90)",
          backdropFilter:     "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border:             "1px solid rgba(255,255,255,0.07)",
          boxShadow:          `0 28px 64px rgba(0,0,0,0.72), 0 0 0 1px rgba(${rgb(story.accent)},0.14), 0 0 44px rgba(${rgb(story.accent)},0.05)`,
          display:            "flex",
          flexDirection:      "column",
          overflow:           "hidden",
        }}
      >
        {/* Accent line */}
        <div style={{ height: 2, flexShrink: 0, background: `linear-gradient(90deg, transparent, ${story.accent}80, transparent)` }} />

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Drag grip */}
            <div className="grid grid-cols-2 gap-[3px] shrink-0">
              {[0,1,2,3].map((i) => (
                <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.16)" }} />
              ))}
            </div>
            {/* Category */}
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-[2px] rounded-full shrink-0"
              style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}
            >
              {cat.label}
            </span>
            <span className="text-[9px] text-slate-600 font-mono shrink-0">{story.era}</span>
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
          <h3 className="text-[14px] font-bold leading-snug mb-1.5" style={{ color: "rgba(255,255,255,0.90)" }}>
            {story.title}
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{story.short_hook}</p>

          {/* Illustration — hidden when expanded */}
          {!expanded && (
            <div
              className="rounded-lg overflow-hidden mb-3"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${story.accent}1e` }}
            >
              <Illustration type={story.illustration} accent={story.accent} />
            </div>
          )}

          {/* Key points */}
          <ul className="space-y-2 mb-4">
            {story.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: story.accent, opacity: 0.65 }} />
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
                <p className="text-[11px] text-slate-600 italic">Unable to load expansion. Try again shortly.</p>
              )}

              {content && (
                <div className="space-y-5">
                  {/* Overview */}
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: story.accent }}>Overview</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{content.overview}</p>
                  </div>

                  {/* Timeline */}
                  {!!content.timeline?.length && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: story.accent }}>Timeline</div>
                      {content.timeline.map((ev, i) => <TimelineRow key={i} ev={ev} />)}
                    </div>
                  )}

                  {/* Missed signals */}
                  {!!content.missed_signals?.length && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#EF4444" }}>Signals That Were Ignored</div>
                      <ul className="space-y-1.5">
                        {content.missed_signals.map((sig, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-[1px] text-[10px] text-red-500 shrink-0 leading-4">✕</span>
                            <span className="text-[11px] text-slate-400 leading-relaxed">{sig}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metrivant connection */}
                  {content.metrivant_would_detect && (
                    <div className="rounded-lg p-3" style={{ background: "rgba(46,230,166,0.05)", border: "1px solid rgba(46,230,166,0.13)" }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#2EE6A6" }}>
                        How Metrivant Would Have Detected This
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(46,230,166,0.72)" }}>
                        {content.metrivant_would_detect}
                      </p>
                    </div>
                  )}

                  {/* Takeaway */}
                  {content.takeaway && (
                    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-[9px] font-bold uppercase tracking-widest mr-2" style={{ color: "rgba(255,255,255,0.30)" }}>Lesson</span>
                      <span className="text-[11px] text-slate-300 italic leading-relaxed">{content.takeaway}</span>
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
                  background: `rgba(${rgb(story.accent)},0.10)`,
                  color:      story.accent,
                  border:     `1px solid rgba(${rgb(story.accent)},0.22)`,
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
