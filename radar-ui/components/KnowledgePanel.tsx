"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KNOWLEDGE_SLIDES,
  type KnowledgeSlide,
  type VisualKey,
} from "../lib/knowledge-panels";
import {
  canShowPanel,
  setPanelOpen,
  setPanelClosed,
  nextCycleDelay,
} from "../lib/panel-coordinator";

// ── Session / localStorage helpers ────────────────────────────────────────────

const SESSION_KEY = "mv_knowledge_shown";   // array of seen slide IDs (session)
const COUNT_KEY   = "mv_knowledge_count";   // total slides seen ever (localStorage)

function getShownIds(): string[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function markShown(id: string): void {
  try {
    const ids = getShownIds();
    if (!ids.includes(id)) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids, id]));
    }
  } catch { /* non-fatal */ }
}

function getGlobalCount(): number {
  try {
    return Math.min(9999, parseInt(localStorage.getItem(COUNT_KEY) ?? "0", 10));
  } catch { return 0; }
}

function incrementGlobalCount(): number {
  try {
    const next = Math.min(9999, getGlobalCount() + 1);
    localStorage.setItem(COUNT_KEY, String(next));
    return next;
  } catch { return 0; }
}

function pickNext(): KnowledgeSlide | null {
  const shown = new Set(getShownIds());
  const unseen = KNOWLEDGE_SLIDES.filter((s) => !shown.has(s.id));
  const pool = unseen.length > 0 ? unseen : KNOWLEDGE_SLIDES;
  // Sort by priority desc, take top half, pick randomly from it
  const sorted = [...pool].sort((a, b) => b.priority - a.priority);
  const topHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  return topHalf[Math.floor(Math.random() * topHalf.length)] ?? null;
}

// ── Badge colors ───────────────────────────────────────────────────────────────

function badgeColor(type: KnowledgeSlide["type"]): string {
  if (type === "history") return "#F59E0B";
  if (type === "feature") return "#2EE6A6";
  return "#8B5CF6";
}

// ── SVG Illustrations ─────────────────────────────────────────────────────────

function SlideVisual({ visual, accent }: { visual: VisualKey; accent: string }) {
  const svgProps = {
    viewBox: "0 0 300 152" as const,
    style: { width: "100%", height: "152px" } as React.CSSProperties,
    "aria-hidden": true as const,
  };

  if (visual === "store") {
    return (
      <svg {...svgProps}>
        <rect x="20" y="30" width="110" height="80" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="20" y1="30" x2="130" y2="110" stroke="#EF4444" strokeWidth="2" />
        <line x1="130" y1="30" x2="20" y2="110" stroke="#EF4444" strokeWidth="2" />
        <rect x="155" y="60" width="50" height="36" rx="3" fill="none" stroke={accent} strokeWidth="1.5" />
        <path d="M205 78 L230 78 M222 71 L230 78 L222 85" stroke={accent} strokeWidth="1.5" fill="none" />
        <line x1="155" y1="115" x2="130" y2="115" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
        <line x1="155" y1="115" x2="260" y2="115" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3" />
        <text x="70" y="127" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">incumbent</text>
        <text x="198" y="127" textAnchor="middle" fill={accent} fontSize="9" fontFamily="monospace" opacity="0.7">disruptor</text>
      </svg>
    );
  }

  if (visual === "chart") {
    return (
      <svg {...svgProps}>
        <polyline points="20,120 60,90 100,70 130,50 150,35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <polyline points="150,35 165,60 180,90 200,115 220,130" fill="none" stroke="#EF4444" strokeWidth="1.5" />
        <polyline points="150,35 170,28 200,22 240,18" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="5 3" />
        <circle cx="150" cy="35" r="3" fill={accent} />
        <text x="148" y="26" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">peak</text>
        <text x="200" y="13" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.7">disruptor</text>
        <text x="215" y="140" textAnchor="middle" fill="#EF4444" fontSize="8" fontFamily="monospace" opacity="0.7">incumbent</text>
      </svg>
    );
  }

  if (visual === "camera") {
    return (
      <svg {...svgProps}>
        <rect x="25" y="45" width="90" height="65" rx="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx="70" cy="77" r="18" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <rect x="55" y="37" width="30" height="12" rx="3" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <line x1="25" y1="45" x2="115" y2="110" stroke="#EF4444" strokeWidth="2" />
        <line x1="115" y1="45" x2="25" y2="110" stroke="#EF4444" strokeWidth="2" />
        <path d="M150 68 L175 68 M167 61 L175 68 L167 75" stroke={accent} strokeWidth="1.5" fill="none" />
        <rect x="185" y="55" width="60" height="44" rx="5" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <circle cx="215" cy="77" r="12" fill="none" stroke={accent} strokeWidth="1" opacity="0.5" />
        <text x="70" y="128" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">1975</text>
        <text x="215" y="128" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">2003</text>
      </svg>
    );
  }

  if (visual === "phone") {
    return (
      <svg {...svgProps}>
        <rect x="30" y="30" width="55" height="92" rx="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <rect x="38" y="42" width="39" height="28" rx="2" fill="rgba(255,255,255,0.04)" />
        <line x1="30" y1="30" x2="85" y2="122" stroke="#EF4444" strokeWidth="2" />
        <line x1="85" y1="30" x2="30" y2="122" stroke="#EF4444" strokeWidth="2" />
        <path d="M118 76 L143 76 M135 69 L143 76 L135 83" stroke={accent} strokeWidth="1.5" fill="none" />
        <rect x="155" y="38" width="44" height="76" rx="7" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.8" />
        <rect x="163" y="48" width="28" height="48" rx="2" fill="rgba(46,230,166,0.06)" />
        <circle cx="177" cy="105" r="5" fill="none" stroke={accent} strokeWidth="1" opacity="0.5" />
      </svg>
    );
  }

  if (visual === "glass") {
    return (
      <svg {...svgProps}>
        <circle cx="90" cy="70" r="32" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        <line x1="114" y1="94" x2="135" y2="115" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="90" cy="70" r="5" fill={accent} opacity="0.6" />
        <circle cx="170" cy="40" r="4" fill="rgba(255,255,255,0.3)" />
        <circle cx="200" cy="65" r="4" fill="rgba(255,255,255,0.25)" />
        <circle cx="210" cy="100" r="4" fill="rgba(255,255,255,0.25)" />
        <circle cx="185" cy="120" r="4" fill="rgba(255,255,255,0.2)" />
        <circle cx="155" cy="110" r="4" fill="rgba(255,255,255,0.2)" />
        <line x1="117" y1="55" x2="168" y2="42" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="120" y1="70" x2="196" y2="66" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="116" y1="85" x2="207" y2="99" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <text x="90" y="122" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">source</text>
        <text x="185" y="135" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">market</text>
      </svg>
    );
  }

  if (visual === "deal") {
    return (
      <svg {...svgProps}>
        <ellipse cx="90" cy="76" rx="38" ry="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <ellipse cx="210" cy="76" rx="38" ry="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <path d="M128 76 L172 76" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 3" />
        <circle cx="150" cy="62" r="6" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" />
        <circle cx="150" cy="76" r="6" fill="none" stroke="rgba(245,158,11,0.4)" strokeWidth="1.5" />
        <circle cx="150" cy="90" r="6" fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth="1.5" />
        <line x1="68" y1="54" x2="232" y2="98" stroke="#EF4444" strokeWidth="2" opacity="0.8" />
        <line x1="232" y1="54" x2="68" y2="98" stroke="#EF4444" strokeWidth="2" opacity="0.8" />
        <text x="90" y="114" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">partner</text>
        <text x="210" y="114" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">partner</text>
      </svg>
    );
  }

  if (visual === "clock") {
    return (
      <svg {...svgProps}>
        <circle cx="130" cy="76" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <circle cx="130" cy="76" r="3" fill={accent} opacity="0.7" />
        <line x1="130" y1="76" x2="130" y2="38" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
        <line x1="130" y1="76" x2="162" y2="76" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M130 28 L126 36 L134 36 Z" fill={accent} opacity="0.6" />
        <polygon points="215,45 205,68 225,68" fill="#F59E0B" opacity="0.7" />
        <line x1="215" y1="56" x2="215" y2="62" stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" />
        <circle cx="215" cy="65" r="1.5" fill="rgba(0,0,0,0.8)" />
        <text x="130" y="138" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">11:58</text>
      </svg>
    );
  }

  if (visual === "server") {
    return (
      <svg {...svgProps}>
        <rect x="20" y="30" width="80" height="16" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <rect x="20" y="52" width="80" height="16" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <rect x="20" y="74" width="80" height="16" rx="3" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.2" />
        <line x1="20" y1="30" x2="100" y2="90" stroke="#EF4444" strokeWidth="1.5" />
        <line x1="100" y1="30" x2="20" y2="90" stroke="#EF4444" strokeWidth="1.5" />
        <path d="M128 60 L158 60 M150 53 L158 60 L150 67" stroke={accent} strokeWidth="1.5" fill="none" />
        <path d="M170 50 Q200 32 230 50 Q248 60 230 76 Q200 88 170 76 Q152 66 170 50 Z" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <circle cx="200" cy="63" r="3" fill={accent} opacity="0.4" />
        <text x="60" y="108" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">on-prem</text>
        <text x="200" y="108" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">cloud</text>
      </svg>
    );
  }

  if (visual === "map") {
    return (
      <svg {...svgProps}>
        <path d="M30 35 L75 30 L100 40 L75 50 L30 45 Z" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <path d="M75 30 L75 50" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path d="M30 45 L30 35" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <path d="M45 28 L65 22 L90 30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="20" y1="30" x2="115" y2="65" stroke="#EF4444" strokeWidth="1.5" />
        <line x1="115" y1="30" x2="20" y2="65" stroke="#EF4444" strokeWidth="1.5" />
        <path d="M148 55 L173 55 M165 48 L173 55 L165 62" stroke={accent} strokeWidth="1.5" fill="none" />
        <line x1="210" y1="40" x2="210" y2="90" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        <circle cx="210" cy="40" r="8" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <circle cx="210" cy="40" r="3" fill={accent} opacity="0.6" />
        <path d="M202 46 Q210 58 218 46" fill={accent} opacity="0.15" />
        <text x="68" y="80" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">paper map</text>
        <text x="210" y="108" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">live map</text>
      </svg>
    );
  }

  if (visual === "book") {
    return (
      <svg {...svgProps}>
        <rect x="25" y="35" width="70" height="85" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="60" y1="35" x2="60" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="35" y1="55" x2="85" y2="55" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="35" y1="68" x2="85" y2="68" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="35" y1="81" x2="85" y2="81" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="25" y1="35" x2="95" y2="120" stroke="#EF4444" strokeWidth="2" />
        <line x1="95" y1="35" x2="25" y2="120" stroke="#EF4444" strokeWidth="2" />
        <path d="M130 77 Q155 55 180 77 Q155 99 130 77 Z" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.5" />
        <path d="M180 77 Q205 55 230 77 Q205 99 180 77 Z" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.5" />
        <circle cx="145" cy="67" r="2.5" fill={accent} opacity="0.5" />
        <circle cx="200" cy="87" r="2" fill={accent} opacity="0.4" />
        <circle cx="175" cy="95" r="1.5" fill={accent} opacity="0.3" />
        <circle cx="220" cy="62" r="1.5" fill={accent} opacity="0.3" />
      </svg>
    );
  }

  // ── Feature visuals ──────────────────────────────────────────────────────────

  if (visual === "radar-gravity") {
    return (
      <svg {...svgProps}>
        <circle cx="150" cy="76" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="150" cy="76" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="150" cy="76" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="150" cy="76" r="10" fill="none" stroke="rgba(46,230,166,0.15)" strokeWidth="1" />
        {/* Cooling — far, slate */}
        <circle cx="94" cy="34" r="4" fill="#64748b" opacity="0.7" />
        <text x="94" y="27" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Cooling</text>
        {/* Stable — mid, green */}
        <circle cx="196" cy="42" r="5.5" fill="#2EE6A6" opacity="0.7" />
        <text x="196" y="35" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Stable</text>
        {/* Rising — inner-mid, amber */}
        <circle cx="116" cy="96" r="7" fill="#F59E0B" opacity="0.7" />
        <text x="116" y="116" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Rising</text>
        {/* Accelerating — center, red */}
        <circle cx="170" cy="68" r="9" fill="#EF4444" opacity="0.8" />
        <text x="170" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Accel.</text>
      </svg>
    );
  }

  if (visual === "signal-detection") {
    return (
      <svg {...svgProps}>
        <rect x="10" y="56" width="52" height="30" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <text x="36" y="75" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">Page</text>
        <path d="M62 71 L78 71 M72 65 L78 71 L72 77" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" />
        <rect x="80" y="56" width="52" height="30" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <text x="106" y="75" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">Snap</text>
        <path d="M132 71 L148 71 M142 65 L148 71 L142 77" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" />
        <rect x="150" y="56" width="52" height="30" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <text x="176" y="75" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">Diff</text>
        <path d="M202 71 L218 71 M212 65 L218 71 L212 77" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <rect x="220" y="56" width="60" height="30" rx="4" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <text x="250" y="75" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.9">Signal</text>
        <text x="150" y="108" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">3 gates before creation</text>
      </svg>
    );
  }

  if (visual === "movement-detection") {
    return (
      <svg {...svgProps}>
        <circle cx="45" cy="50" r="5" fill={accent} opacity="0.6" />
        <circle cx="45" cy="76" r="5" fill={accent} opacity="0.5" />
        <circle cx="45" cy="102" r="5" fill={accent} opacity="0.4" />
        <text x="45" y="42" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="monospace">signal</text>
        <text x="45" y="68" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="monospace">signal</text>
        <text x="45" y="94" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="monospace">signal</text>
        <path d="M56 50 Q80 50 80 76 Q80 102 56 102" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <path d="M90 76 L120 76 M112 69 L120 76 L112 83" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <rect x="132" y="56" width="100" height="40" rx="5" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <text x="182" y="80" textAnchor="middle" fill={accent} fontSize="9" fontFamily="monospace" opacity="0.9">Movement</text>
        <text x="150" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">min 2 signals · 14-day window</text>
      </svg>
    );
  }

  if (visual === "sector-intelligence") {
    return (
      <svg {...svgProps}>
        <circle cx="150" cy="76" r="20" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6" />
        <text x="150" y="80" textAnchor="middle" fill={accent} fontSize="7" fontFamily="monospace" opacity="0.8">Analysis</text>
        <circle cx="50" cy="36" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <circle cx="250" cy="36" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <circle cx="50" cy="116" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <circle cx="250" cy="116" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
        <line x1="62" y1="44" x2="132" y2="66" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="238" y1="44" x2="168" y2="66" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="62" y1="108" x2="132" y2="86" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="238" y1="108" x2="168" y2="86" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="50" y="40" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Co.A</text>
        <text x="250" y="40" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Co.B</text>
        <text x="50" y="120" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Co.C</text>
        <text x="250" y="120" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Co.D</text>
      </svg>
    );
  }

  if (visual === "weekly-brief") {
    return (
      <svg {...svgProps}>
        <rect x="20" y="30" width="70" height="80" rx="5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <line x1="20" y1="46" x2="90" y2="46" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="55" y="42" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.7">MON</text>
        <text x="55" y="68" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="20" fontFamily="monospace">7</text>
        <path d="M118 76 L148 76 M140 69 L148 76 L140 83" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <rect x="160" y="38" width="100" height="76" rx="4" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
        <line x1="170" y1="52" x2="248" y2="52" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="170" y1="62" x2="240" y2="62" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="170" y1="72" x2="245" y2="72" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="170" y1="82" x2="235" y2="82" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="170" y1="92" x2="242" y2="92" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <text x="209" y="128" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">10:00 UTC every Monday</text>
      </svg>
    );
  }

  if (visual === "pressure-index") {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="pi-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2EE6A6" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        <rect x="30" y="68" width="220" height="16" rx="8" fill="url(#pi-grad)" opacity="0.35" />
        <rect x="30" y="68" width="220" height="16" rx="8" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="30" y="62" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">0.0</text>
        <text x="140" y="62" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">5.0</text>
        <text x="250" y="62" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">10.0</text>
        {/* Pointer at 7.0 = 30 + (7/10)*220 = 184 */}
        <polygon points="184,64 180,68 188,68" fill={accent} opacity="0.9" />
        <line x1="184" y1="84" x2="184" y2="96" stroke={accent} strokeWidth="1.5" opacity="0.6" strokeDasharray="3 2" />
        <text x="184" y="106" textAnchor="middle" fill={accent} fontSize="8.5" fontFamily="monospace" opacity="0.9">7.0</text>
        <text x="150" y="130" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">pending_review → active at 5.0</text>
      </svg>
    );
  }

  if (visual === "selector-repair") {
    return (
      <svg {...svgProps}>
        <rect x="15" y="46" width="110" height="52" rx="4" fill="none" stroke="#EF4444" strokeWidth="1.5" opacity="0.7" />
        <text x="70" y="68" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">.pricing-block</text>
        <text x="70" y="82" textAnchor="middle" fill="#EF4444" fontSize="9" fontFamily="monospace" opacity="0.7">✕ broken</text>
        <path d="M135 72 L160 72 M152 65 L160 72 L152 79" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <rect x="170" y="46" width="110" height="52" rx="4" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
        <text x="225" y="68" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">.price-table</text>
        <text x="225" y="82" textAnchor="middle" fill={accent} fontSize="9" fontFamily="monospace" opacity="0.7">✓ repaired</text>
        <text x="150" y="118" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">operator review · never auto-applied</text>
      </svg>
    );
  }

  if (visual === "signal-velocity") {
    return (
      <svg {...svgProps}>
        <line x1="30" y1="120" x2="30" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="30" y1="120" x2="270" y2="120" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        {[0,1,2,3,4,5,6].map((i) => {
          const h = [15, 20, 22, 35, 50, 72, 88][i];
          const x = 42 + i * 32;
          return <rect key={i} x={x} y={120 - h} width="20" height={h} rx="2" fill={accent} opacity={0.2 + i * 0.1} />;
        })}
        <polyline points="52,105 84,100 116,98 148,85 180,70 212,48 244,32" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.8" />
        <text x="150" y="138" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">signal burst = velocity spike</text>
      </svg>
    );
  }

  if (visual === "confidence-model") {
    return (
      <svg {...svgProps}>
        <rect x="20" y="36" width="260" height="18" rx="3" fill="rgba(100,116,139,0.15)" />
        <rect x="20" y="36" width="91" height="18" rx="3" fill="#EF4444" opacity="0.25" />
        <text x="65" y="49" textAnchor="middle" fill="rgba(239,68,68,0.7)" fontSize="7.5" fontFamily="monospace">suppressed  &lt;0.35</text>

        <rect x="20" y="62" width="260" height="18" rx="3" fill="rgba(100,116,139,0.15)" />
        <rect x="20" y="62" width="169" height="18" rx="3" fill="#F59E0B" opacity="0.2" />
        <text x="110" y="75" textAnchor="middle" fill="rgba(245,158,11,0.7)" fontSize="7.5" fontFamily="monospace">pending_review  0.35–0.64</text>

        <rect x="20" y="88" width="260" height="18" rx="3" fill="rgba(100,116,139,0.15)" />
        <rect x="20" y="88" width="260" height="18" rx="3" fill={accent} opacity="0.18" />
        <text x="150" y="101" textAnchor="middle" fill={accent} fontSize="7.5" fontFamily="monospace" opacity="0.85">active  ≥0.65</text>

        <text x="150" y="126" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">confidence gates · 4-factor composite</text>
      </svg>
    );
  }

  if (visual === "page-classes") {
    return (
      <svg {...svgProps}>
        <rect x="20" y="30" width="260" height="26" rx="4" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
        <text x="80" y="47" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.9">high_value</text>
        <text x="210" y="47" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.7">every 1h  +0.08 conf</text>

        <rect x="20" y="62" width="260" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
        <text x="80" y="79" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">standard</text>
        <text x="210" y="79" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">every 3h</text>

        <rect x="20" y="94" width="260" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        <text x="80" y="111" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">ambient</text>
        <text x="210" y="111" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">every 30min  activity</text>

        <text x="150" y="138" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">pricing · changelog · newsroom = high_value</text>
      </svg>
    );
  }

  if (visual === "critical-alert") {
    return (
      <svg {...svgProps}>
        {[
          "momentum ≥ 7",
          "signals_7d ≥ 3",
          "confidence ≥ 0.70",
          "movement type",
          "last seen &lt;48h",
        ].map((label, i) => (
          <g key={i}>
            <rect x="20" y={22 + i * 20} width="8" height="8" rx="2" fill={accent} opacity="0.7" />
            <line x1="21" y1={23 + i * 20 + 4} x2="26" y2={23 + i * 20 + 4} stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" />
            <line x1="24" y1={23 + i * 20 + 1} x2="24" y2={23 + i * 20 + 7} stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" />
            <text x="36" y={32 + i * 20} fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="monospace">{label}</text>
          </g>
        ))}
        <rect x="200" y="48" width="78" height="56" rx="5" fill="none" stroke="#EF4444" strokeWidth="2" opacity="0.7" />
        <circle cx="200" cy="48" r="16" fill="none" stroke="#EF4444" strokeWidth="1.5" opacity="0.3" />
        <circle cx="200" cy="48" r="10" fill="none" stroke="#EF4444" strokeWidth="1" opacity="0.2" />
        <text x="239" y="80" textAnchor="middle" fill="#EF4444" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.9">ALERT</text>
      </svg>
    );
  }

  if (visual === "momentum-states") {
    return (
      <svg {...svgProps}>
        <circle cx="38" cy="76" r="10" fill="#64748b" opacity="0.75" />
        <text x="38" y="96" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Cooling</text>
        <text x="38" y="105" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" fontFamily="monospace">&lt;1.5</text>

        <circle cx="100" cy="76" r="14" fill="#2EE6A6" opacity="0.7" />
        <text x="100" y="100" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Stable</text>
        <text x="100" y="109" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" fontFamily="monospace">1.5–3</text>

        <circle cx="175" cy="76" r="18" fill="#F59E0B" opacity="0.7" />
        <text x="175" y="104" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Rising</text>
        <text x="175" y="113" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" fontFamily="monospace">3–5</text>

        <circle cx="255" cy="76" r="22" fill="#EF4444" opacity="0.75" />
        <text x="255" y="108" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Accel.</text>
        <text x="255" y="117" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" fontFamily="monospace">≥5</text>
      </svg>
    );
  }

  // ── Science visuals ──────────────────────────────────────────────────────────

  if (visual === "brain") {
    return (
      <svg {...svgProps}>
        <path d="M90 76 Q90 44 120 40 Q140 36 150 50 Q160 36 180 40 Q210 44 210 76 Q210 100 190 108 Q170 116 150 110 Q130 116 110 108 Q90 100 90 76 Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <path d="M150 50 L150 110" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <path d="M120 56 Q130 65 120 76" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <path d="M180 56 Q170 65 180 76" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <path d="M225 50 L240 40 M240 40 L245 50 M240 40 L250 42" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <circle cx="80" cy="90" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="80" y1="80" x2="80" y2="74" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="76" y1="84" x2="72" y2="80" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <text x="80" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">40ms</text>
        <text x="240" y="66" textAnchor="middle" fill={accent} fontSize="7" fontFamily="monospace" opacity="0.7">fire</text>
      </svg>
    );
  }

  if (visual === "asymmetry") {
    return (
      <svg {...svgProps}>
        <line x1="150" y1="30" x2="150" y2="120" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx="150" cy="76" r="4" fill="rgba(255,255,255,0.2)" />
        {/* Heavy side (left) — down */}
        <line x1="150" y1="76" x2="65" y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x="30" y="100" width="70" height="20" rx="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
        <circle cx="45" cy="82" r="3" fill={accent} opacity="0.5" />
        <circle cx="55" cy="78" r="3" fill={accent} opacity="0.4" />
        <circle cx="65" cy="74" r="3" fill={accent} opacity="0.3" />
        <text x="65" y="130" textAnchor="middle" fill={accent} fontSize="7.5" fontFamily="monospace" opacity="0.7">informed</text>
        {/* Light side (right) — up */}
        <line x1="150" y1="76" x2="235" y2="52" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <rect x="200" y="32" width="70" height="20" rx="3" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
        <text x="235" y="62" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7.5" fontFamily="monospace">uninformed</text>
      </svg>
    );
  }

  if (visual === "loss-aversion") {
    return (
      <svg {...svgProps}>
        <line x1="40" y1="120" x2="40" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="40" y1="76" x2="270" y2="76" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <rect x="70" y="56" width="50" height="20" rx="3" fill="#2EE6A6" opacity="0.4" />
        <text x="95" y="48" textAnchor="middle" fill="rgba(46,230,166,0.6)" fontSize="8" fontFamily="monospace">+1</text>
        <rect x="170" y="26" width="50" height="50" rx="3" fill="#EF4444" opacity="0.4" />
        <text x="195" y="19" textAnchor="middle" fill="rgba(239,68,68,0.7)" fontSize="8" fontFamily="monospace">-2.5×</text>
        <text x="95" y="140" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">gain</text>
        <text x="195" y="140" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">loss</text>
        <text x="150" y="150" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">Kahneman · prospect theory</text>
      </svg>
    );
  }

  if (visual === "availability") {
    return (
      <svg {...svgProps}>
        <defs>
          <radialGradient id="av-spotlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx="150" cy="76" r="70" fill="url(#av-spotlight)" />
        <circle cx="150" cy="76" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="135" cy="68" r="6" fill={accent} opacity="0.5" />
        <circle cx="155" cy="80" r="6" fill={accent} opacity="0.4" />
        <circle cx="145" cy="62" r="5" fill={accent} opacity="0.35" />
        <text x="150" y="118" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="monospace">known threats</text>
        <circle cx="52" cy="50" r="5" fill="rgba(255,255,255,0.06)" />
        <circle cx="240" cy="42" r="5" fill="rgba(255,255,255,0.05)" />
        <circle cx="68" cy="108" r="5" fill="rgba(255,255,255,0.05)" />
        <circle cx="228" cy="110" r="5" fill="rgba(255,255,255,0.04)" />
        <text x="52" y="44" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="7" fontFamily="monospace">?</text>
        <text x="240" y="36" textAnchor="middle" fill="rgba(255,255,255,0.10)" fontSize="7" fontFamily="monospace">?</text>
      </svg>
    );
  }

  if (visual === "pattern") {
    return (
      <svg {...svgProps}>
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => {
            const x = 25 + col * 34;
            const y = 28 + row * 22;
            const inCluster = row >= 1 && row <= 3 && col >= 2 && col <= 4;
            return (
              <circle
                key={`${row}-${col}`}
                cx={x} cy={y} r={inCluster ? 3.5 : 2.5}
                fill={inCluster ? accent : "rgba(255,255,255,0.2)"}
                opacity={inCluster ? 0.7 : 0.3}
              />
            );
          })
        )}
        <circle cx="128" cy="76" r="30" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" strokeDasharray="5 3" />
        <text x="150" y="128" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">cluster emerges before conscious detection</text>
      </svg>
    );
  }

  if (visual === "vigilance") {
    return (
      <svg {...svgProps}>
        {/* Flock feeding */}
        {[60, 90, 110, 140, 170, 200, 230].map((x, i) => (
          <ellipse key={i} cx={x} cy={100} rx="6" ry="4" fill="rgba(255,255,255,0.15)" transform={`rotate(-10 ${x} 100)`} />
        ))}
        {/* Lookout standing tall */}
        <ellipse cx="150" cy="58" rx="7" ry="5" fill={accent} opacity="0.6" />
        <line x1="150" y1="63" x2="150" y2="82" stroke={accent} strokeWidth="2" opacity="0.5" />
        <line x1="150" y1="72" x2="144" y2="78" stroke={accent} strokeWidth="1.5" opacity="0.4" />
        <line x1="150" y1="72" x2="156" y2="78" stroke={accent} strokeWidth="1.5" opacity="0.4" />
        <line x1="150" y1="82" x2="145" y2="95" stroke={accent} strokeWidth="1.5" opacity="0.4" />
        <line x1="150" y1="82" x2="155" y2="95" stroke={accent} strokeWidth="1.5" opacity="0.4" />
        <path d="M135 52 Q150 42 165 52" fill="none" stroke={accent} strokeWidth="1" opacity="0.3" strokeDasharray="3 2" />
        <text x="150" y="130" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">always-on vigilance · distributed cost</text>
      </svg>
    );
  }

  if (visual === "sensemaking") {
    return (
      <svg {...svgProps}>
        <circle cx="150" cy="76" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        <path d="M150 32 A44 44 0 0 1 194 76" fill="none" stroke={accent} strokeWidth="2" opacity="0.6" markerEnd="url(#sm-arrow)" />
        <path d="M194 76 A44 44 0 0 1 150 120" fill="none" stroke={accent} strokeWidth="2" opacity="0.5" />
        <path d="M150 120 A44 44 0 0 1 106 76" fill="none" stroke={accent} strokeWidth="2" opacity="0.4" />
        <path d="M106 76 A44 44 0 0 1 150 32" fill="none" stroke={accent} strokeWidth="2" opacity="0.3" />
        <text x="150" y="22" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">Act</text>
        <text x="208" y="79" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">Observe</text>
        <text x="150" y="140" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">Interpret</text>
        <text x="42" y="79" textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">Act</text>
        <text x="150" y="80" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">Weick</text>
      </svg>
    );
  }

  if (visual === "confirmation") {
    return (
      <svg {...svgProps}>
        <circle cx="100" cy="68" r="28" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        <line x1="118" y1="86" x2="138" y2="106" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="88" cy="60" r="4" fill={accent} opacity="0.7" />
        <circle cx="105" cy="55" r="3" fill={accent} opacity="0.5" />
        <circle cx="95" cy="75" r="3" fill={accent} opacity="0.5" />
        <circle cx="112" cy="70" r="2.5" fill={accent} opacity="0.4" />
        <circle cx="82" cy="50" r="3" fill="rgba(255,255,255,0.1)" />
        <circle cx="120" cy="58" r="3" fill="rgba(255,255,255,0.1)" />
        <circle cx="78" cy="78" r="3" fill="rgba(255,255,255,0.1)" />
        <rect x="158" y="50" width="100" height="52" rx="4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path d="M168 66 Q188 58 208 66 Q188 74 168 66 Z" fill={accent} opacity="0.15" />
        <circle cx="172" cy="66" r="2.5" fill={accent} opacity="0.4" />
        <circle cx="188" cy="62" r="2.5" fill={accent} opacity="0.4" />
        <circle cx="204" cy="66" r="2.5" fill={accent} opacity="0.3" />
        <circle cx="175" cy="80" r="2.5" fill="rgba(255,255,255,0.08)" />
        <circle cx="200" cy="84" r="2.5" fill="rgba(255,255,255,0.08)" />
        <text x="208" y="120" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">only sees matches</text>
      </svg>
    );
  }

  if (visual === "dopamine") {
    return (
      <svg {...svgProps}>
        <line x1="25" y1="100" x2="275" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {[0,1,2,3,4].map((i) => {
          const x = 40 + i * 48;
          return (
            <g key={i}>
              <line x1={x} y1="100" x2={x} y2="48" stroke={accent} strokeWidth="1.5" opacity="0.3 + i*0.1" />
              <circle cx={x} cy="48" r="4" fill={accent} opacity={0.4 + i * 0.08} />
            </g>
          );
        })}
        <polyline
          points="40,95 88,88 136,82 184,76 232,70"
          fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6"
        />
        <text x="40" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Mon</text>
        <text x="88" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Mon</text>
        <text x="136" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Mon</text>
        <text x="184" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Mon</text>
        <text x="232" y="116" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Mon</text>
        <text x="150" y="138" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">cadence builds anticipation</text>
      </svg>
    );
  }

  if (visual === "planning-fallacy") {
    return (
      <svg {...svgProps}>
        <text x="25" y="52" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">My plan</text>
        <rect x="80" y="42" width="90" height="16" rx="3" fill="#2EE6A6" opacity="0.35" />
        <text x="125" y="54" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">optimistic</text>

        <text x="25" y="82" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">Reality</text>
        <rect x="80" y="72" width="168" height="16" rx="3" fill="#EF4444" opacity="0.3" />
        <text x="164" y="84" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">actual duration</text>

        <line x1="170" y1="58" x2="170" y2="72" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x="195" y="66" fill="rgba(245,158,11,0.6)" fontSize="7.5" fontFamily="monospace">gap</text>

        <text x="25" y="112" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">Competitor</text>
        <rect x="100" y="102" width="130" height="16" rx="3" fill="#F59E0B" opacity="0.3" />
        <text x="165" y="114" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="monospace">actual velocity</text>

        <text x="150" y="138" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">Kahneman & Tversky · 1979</text>
      </svg>
    );
  }

  if (visual === "working-memory") {
    return (
      <svg {...svgProps}>
        {/* 4 large working memory chunks */}
        {[60, 105, 150, 195].map((x, i) => (
          <circle key={i} cx={x} cy="60" r="16" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        ))}
        <text x="60" y="64" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">1</text>
        <text x="105" y="64" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">2</text>
        <text x="150" y="64" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">3</text>
        <text x="195" y="64" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.6">4</text>
        <text x="127" y="90" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7.5" fontFamily="monospace">4 chunks · working memory</text>
        {/* 20 tiny competitor dots surrounding */}
        {Array.from({ length: 20 }, (_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const r = 52;
          const cx = 127 + r * Math.cos(angle);
          const cy = 60 + r * Math.sin(angle) * 0.55 + 40;
          return <circle key={i} cx={cx} cy={cy} r="3" fill="rgba(255,255,255,0.15)" />;
        })}
        <text x="127" y="138" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">20+ competitors · structural overflow</text>
      </svg>
    );
  }

  if (visual === "exposure") {
    return (
      <svg {...svgProps}>
        <circle cx="80" cy="70" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <circle cx="80" cy="62" r="8" fill="rgba(255,255,255,0.12)" />
        <path d="M68 80 Q80 88 92 80" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <path d="M80 42 L80 28 M74 34 L80 28 L86 34" stroke="#2EE6A6" strokeWidth="1.5" fill="none" opacity="0.7" />
        <text x="80" y="114" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="monospace">familiar · overweighted</text>

        <rect x="185" y="46" width="56" height="48" rx="5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        <line x1="197" y1="58" x2="229" y2="58" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="197" y1="68" x2="229" y2="68" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="197" y1="78" x2="222" y2="78" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <text x="213" y="108" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="18" fontFamily="monospace">?</text>
        <text x="213" y="126" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">novel · underweighted</text>

        <text x="150" y="148" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">Zajonc · 1968</text>
      </svg>
    );
  }

  // Fallback
  return (
    <svg {...svgProps}>
      <circle cx="150" cy="76" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
      <circle cx="150" cy="76" r="4" fill={accent} opacity="0.5" />
    </svg>
  );
}

// ── KnowledgePanel ─────────────────────────────────────────────────────────────

export default function KnowledgePanel() {
  const [slide, setSlide] = useState<KnowledgeSlide | null>(null);
  const [ready, setReady] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const [entryNumber, setEntryNumber] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR guard — wait for client mount before reading sessionStorage
  useEffect(() => {
    setReady(true);
    setSeenCount(getShownIds().length);
    setEntryNumber(getGlobalCount() + 1);
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = nextCycleDelay();
    timerRef.current = setTimeout(() => {
      if (!canShowPanel()) {
        timerRef.current = setTimeout(() => scheduleNext(), 15_000);
        return;
      }
      const next = pickNext();
      if (next) {
        const num = incrementGlobalCount();
        setEntryNumber(num);
        markShown(next.id);
        setSeenCount(getShownIds().length);
        setPanelOpen();
        setSlide(next);
      }
    }, delay);
  }, []);

  useEffect(() => {
    if (!ready) return;
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ready, scheduleNext]);

  const handleClose = useCallback(() => {
    setPanelClosed();
    setSlide(null);
    scheduleNext();
  }, [scheduleNext]);

  // ESC handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && slide) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, handleClose]);

  if (!ready) return null;

  const accentColor = slide?.accent ?? "#2EE6A6";
  const typeColor = slide ? badgeColor(slide.type) : "#2EE6A6";
  const totalSlides = KNOWLEDGE_SLIDES.length;
  const progressPct = Math.min(100, (seenCount / totalSlides) * 100);

  return (
    <AnimatePresence>
      {slide && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0}
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18 } }}
          transition={{ duration: 0.40, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            width: "320px",
            zIndex: 55,
            background: "rgba(4, 8, 5, 0.96)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: `1px solid rgba(255,255,255,0.07)`,
            borderRadius: "12px",
            boxShadow: `0 0 0 1px ${accentColor}18, 0 24px 64px rgba(0,0,0,0.85), 0 0 32px ${accentColor}0c`,
            overflow: "hidden",
            cursor: "grab",
            userSelect: "none",
          }}
          className="xl:w-[360px]"
        >
          {/* Accent line at very top */}
          <div
            style={{
              height: "2px",
              background: `linear-gradient(90deg, transparent 0%, ${accentColor}60 30%, ${accentColor}99 50%, ${accentColor}60 70%, transparent 100%)`,
            }}
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px 8px",
            }}
          >
            {/* Drag grip */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", opacity: 0.25, flexShrink: 0 }}>
              {[0, 1].map((row) => (
                <div key={row} style={{ display: "flex", gap: "3px" }}>
                  {[0, 1, 2].map((col) => (
                    <div
                      key={col}
                      style={{ width: "3px", height: "3px", borderRadius: "50%", background: "white" }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Type badge */}
            <span
              style={{
                fontSize: "9px",
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: typeColor,
                background: `${typeColor}14`,
                border: `1px solid ${typeColor}30`,
                borderRadius: "4px",
                padding: "2px 6px",
                flexShrink: 0,
              }}
            >
              {slide.badge}
            </span>

            {/* Era / domain */}
            <span
              style={{
                fontSize: "9px",
                fontFamily: "monospace",
                color: "rgba(148,163,184,0.5)",
                letterSpacing: "0.06em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {slide.era}
            </span>

            <div style={{ flex: 1 }} />

            {/* Entry counter */}
            <span
              style={{
                fontSize: "9px",
                fontFamily: "monospace",
                color: "rgba(148,163,184,0.35)",
                letterSpacing: "0.06em",
                flexShrink: 0,
              }}
            >
              Entry {entryNumber}
            </span>

            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "4px",
                border: "none",
                background: "transparent",
                color: "rgba(148,163,184,0.4)",
                cursor: "pointer",
                flexShrink: 0,
                fontSize: "14px",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(148,163,184,0.4)")}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: "0 14px 10px" }}>
            <div
              style={{
                height: "3px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: accentColor,
                  borderRadius: "2px",
                  opacity: 0.6,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* SVG Illustration */}
          <div
            style={{
              margin: "0 14px",
              borderRadius: "8px",
              overflow: "hidden",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <SlideVisual visual={slide.visual} accent={accentColor} />
          </div>

          <div style={{ padding: "12px 14px 14px" }}>
            {/* Title */}
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "white",
                lineHeight: 1.3,
                marginBottom: "8px",
                letterSpacing: "-0.01em",
              }}
            >
              {slide.title}
            </div>

            {/* Hook */}
            <p
              style={{
                fontSize: "11px",
                color: "rgba(148,163,184,0.8)",
                lineHeight: 1.6,
                marginBottom: "10px",
              }}
            >
              {slide.hook}
            </p>

            {/* Divider */}
            <div
              style={{
                height: "1px",
                background: "rgba(255,255,255,0.05)",
                marginBottom: "10px",
              }}
            />

            {/* Bullet points */}
            <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "10px" }}>
              {slide.points.map((point, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: accentColor,
                      opacity: 0.7,
                      flexShrink: 0,
                      marginTop: "5px",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: "rgba(148,163,184,0.65)",
                      lineHeight: 1.55,
                    }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div
              style={{
                height: "1px",
                background: "rgba(255,255,255,0.05)",
                marginBottom: "10px",
              }}
            />

            {/* CTA */}
            <p
              style={{
                fontSize: "11px",
                fontStyle: "italic",
                color: accentColor,
                opacity: 0.75,
                lineHeight: 1.5,
              }}
            >
              {slide.cta}
            </p>

            {/* Footer */}
            <div
              style={{
                marginTop: "10px",
                fontSize: "9px",
                color: "rgba(148,163,184,0.2)",
                fontFamily: "monospace",
                letterSpacing: "0.06em",
                textAlign: "center",
              }}
            >
              Drag to move · ESC to close
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
