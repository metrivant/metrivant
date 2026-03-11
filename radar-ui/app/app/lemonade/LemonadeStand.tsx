"use client";

import { memo } from "react";
import type { RadarCompetitor } from "../../../lib/api";
import { getMomentumConfig } from "../../../lib/momentum";

// ── Deterministic helpers ─────────────────────────────────────────────────────

/** djb2 hash — produces a stable number from a string */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** Deterministic base price $29–$199 derived from competitor name */
function deriveBasePrice(name: string): number {
  return 29 + (djb2(name) % 171);
}

/** Stand scale factor based on momentum (larger = more active) */
function getStandScale(momentum: number): number {
  if (momentum >= 5) return 1.15;
  if (momentum >= 3) return 1.05;
  if (momentum >= 1) return 1.0;
  return 0.82;
}

function getAwningFill(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "#5c1111";
    case "product_expansion":      return "#0f2545";
    case "market_reposition":      return "#052c1c";
    case "enterprise_push":        return "#25083f";
    case "ecosystem_expansion":    return "#4a2800";
    default:                       return "#2a1800";
  }
}

function getAwningAccent(movementType: string | null): string {
  switch (movementType) {
    case "pricing_strategy_shift": return "#ff6b6b";
    case "product_expansion":      return "#57a6ff";
    case "market_reposition":      return "#34d399";
    case "enterprise_push":        return "#c084fc";
    case "ecosystem_expansion":    return "#facc15";
    default:                       return "#d97706";
  }
}

function getMovementLabel(movementType: string | null): string {
  if (!movementType) return "Quiet";
  return movementType
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LemonadeStandProps {
  competitor: RadarCompetitor;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const LemonadeStand = memo(function LemonadeStand({
  competitor,
  isSelected,
  isDimmed,
  onClick,
}: LemonadeStandProps) {
  const momentum        = Number(competitor.momentum_score ?? 0);
  const scale           = getStandScale(momentum);
  const awningFill      = getAwningFill(competitor.latest_movement_type);
  const awningAccent    = getAwningAccent(competitor.latest_movement_type);
  const basePrice       = deriveBasePrice(competitor.competitor_name);
  const hasPricingShift = competitor.latest_movement_type === "pricing_strategy_shift";
  const mCfg            = getMomentumConfig(momentum);
  const signals         = competitor.signals_7d ?? 0;
  const isActive        = competitor.latest_movement_type !== null;

  // Truncate name to fit sign
  const displayName =
    competitor.competitor_name.length > 14
      ? competitor.competitor_name.slice(0, 13) + "…"
      : competitor.competitor_name;

  // Glow intensity proportional to momentum; selected gets extra boost
  const glowOpacity = isSelected
    ? (momentum >= 5 ? 0.55 : 0.38)
    : momentum >= 5 ? 0.38 : momentum >= 3 ? 0.20 : momentum >= 1 ? 0.10 : 0.04;
  const glowHex = Math.round(glowOpacity * 255)
    .toString(16)
    .padStart(2, "0");

  return (
    <div
      className="relative flex cursor-pointer select-none flex-col items-center"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
        transition: "transform 0.35s ease, opacity 0.4s ease",
        // Dimming: inactive stands recede when active ones are present
        opacity: isDimmed ? 0.38 : 1,
        // Active stands get a subtle filter lift
        filter: isActive && !isDimmed
          ? "brightness(1.08)"
          : isDimmed
            ? "brightness(0.7) saturate(0.5)"
            : "none",
      }}
      onClick={onClick}
    >
      {/* Selected ring */}
      {isSelected && (
        <div
          className="pointer-events-none absolute inset-[-4px] z-10 rounded-[14px]"
          style={{
            boxShadow: `0 0 0 1.5px ${awningAccent}, 0 0 32px ${awningAccent}55`,
          }}
        />
      )}

      {/* Ground glow — stronger for active/selected stands */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[90px] w-[150px] -translate-x-1/2"
        style={{
          background: `radial-gradient(ellipse at center bottom, ${awningAccent}${glowHex} 0%, transparent 70%)`,
        }}
      />

      <svg
        width="190"
        height="300"
        viewBox="0 0 190 300"
        fill="none"
        className="relative z-[1]"
        aria-label={competitor.competitor_name}
      >
        {/* ── Sign board ────────────────────────────────────────────────── */}
        <rect
          x="30" y="8" width="130" height="28" rx="5"
          fill="#090e09"
          stroke={awningAccent}
          strokeWidth="0.9"
          strokeOpacity={isActive ? 0.65 : 0.30}
        />
        <text
          x="95" y="26"
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="ui-monospace, monospace"
          fontWeight="700"
          letterSpacing="0.1em"
          fill={isActive ? "white" : "#4a5a4a"}
        >
          {displayName.toUpperCase()}
        </text>

        {/* Support poles */}
        <line x1="34" y1="36" x2="34" y2="50" stroke="#162016" strokeWidth="1.5" />
        <line x1="156" y1="36" x2="156" y2="50" stroke="#162016" strokeWidth="1.5" />

        {/* ── Awning ────────────────────────────────────────────────────── */}
        <path
          d="M 0,68 L 20,50 L 170,50 L 190,68 Z"
          fill={awningFill}
          stroke={awningAccent}
          strokeWidth="0.9"
          strokeOpacity={isActive ? 0.65 : 0.20}
        />
        {/* Scallop edge */}
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M ${i * 38},68 Q ${i * 38 + 19},82 ${(i + 1) * 38},68`}
            fill={awningFill}
            stroke={awningAccent}
            strokeWidth="0.7"
            strokeOpacity="0.4"
          />
        ))}

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <rect x="8" y="68" width="174" height="142" rx="2" fill="#060d06" />

        {/* ── Price panel (left) ────────────────────────────────────────── */}
        <rect
          x="12" y="74" width="72" height="92" rx="3"
          fill="#0a120a"
          stroke={hasPricingShift ? "#ff6b6b" : "#101e10"}
          strokeWidth={hasPricingShift ? "1.2" : "0.8"}
        />
        <text
          x="48" y="91"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.14em"
          fill="#2a472a"
        >
          PRICE
        </text>

        {hasPricingShift ? (
          <>
            {/* Crossed-out old price */}
            <text
              x="48" y="115"
              textAnchor="middle"
              fontSize="13"
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              fill="#ff6b6b44"
            >
              ${basePrice}
            </text>
            <line
              x1="20" y1="113" x2="76" y2="108"
              stroke="#ff6b6b"
              strokeWidth="1.4"
              strokeOpacity="0.65"
            />
            <text
              x="48" y="141"
              textAnchor="middle"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              fill="#ff6b6b"
            >
              ↑ SHIFT
            </text>
          </>
        ) : (
          <text
            x="48" y="133"
            textAnchor="middle"
            fontSize="17"
            fontFamily="ui-monospace, monospace"
            fontWeight="700"
            fill={isActive ? "white" : "#2a3a2a"}
          >
            ${basePrice}
          </text>
        )}

        <text
          x="48" y="157"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="ui-monospace, monospace"
          fill="#2a472a"
        >
          /mo
        </text>

        {/* ── Signals panel (center) ────────────────────────────────────── */}
        <rect
          x="88" y="74" width="60" height="92" rx="3"
          fill="#0a120a"
          stroke={signals > 0 ? "#162416" : "#0e1e0e"}
          strokeWidth="0.8"
        />
        <text
          x="118" y="91"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.14em"
          fill="#2a472a"
        >
          SIGNALS
        </text>
        <text
          x="118" y="127"
          textAnchor="middle"
          fontSize="26"
          fontFamily="ui-monospace, monospace"
          fontWeight="700"
          fill={signals > 0 ? "white" : "#162416"}
        >
          {signals}
        </text>
        <text
          x="118" y="143"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="ui-monospace, monospace"
          fill="#2a472a"
        >
          this week
        </text>
        {/* Signal dots (max 5) */}
        {Array.from({ length: Math.min(signals, 5) }).map((_, i) => (
          <circle
            key={i}
            cx={103 + i * 7}
            cy="157"
            r="2.5"
            fill={awningAccent}
            fillOpacity={signals > 0 ? 0.65 : 0.15}
          />
        ))}

        {/* ── Poster (right) ────────────────────────────────────────────── */}
        <rect
          x="152" y="74" width="26" height="92" rx="3"
          fill="#0a120a"
          stroke="#0e1e0e"
          strokeWidth="0.8"
        />
        <text
          x="165"
          y="152"
          textAnchor="middle"
          fontSize="6.5"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill={isActive ? awningAccent : "#2a3a2a"}
          transform="rotate(-90, 165, 120)"
          letterSpacing="0.07em"
        >
          {getMovementLabel(competitor.latest_movement_type)
            .toUpperCase()
            .slice(0, 16)}
        </text>

        {/* ── Momentum bar ──────────────────────────────────────────────── */}
        <rect
          x="8" y="170" width="174" height="32" rx="2"
          fill="#060e06"
          stroke="#0e1e0e"
          strokeWidth="0.8"
        />
        <circle cx="26" cy="186" r="3.5" fill={mCfg.color} fillOpacity="0.85" />
        <text
          x="37" y="190"
          fontSize="8.5"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill={mCfg.color}
          letterSpacing="0.09em"
        >
          {mCfg.arrow} {mCfg.label.toUpperCase()}
        </text>
        <text
          x="177" y="190"
          textAnchor="end"
          fontSize="8.5"
          fontFamily="ui-monospace, monospace"
          fill="#2a472a"
        >
          {momentum.toFixed(1)}
        </text>

        {/* ── Counter ───────────────────────────────────────────────────── */}
        <rect
          x="0" y="210" width="190" height="20" rx="0"
          fill="#0d180d"
          stroke="#162416"
          strokeWidth="0.8"
        />
        {[18, 46, 74, 102, 130, 158].map((cx) => (
          <circle key={cx} cx={cx} cy="220" r="2" fill="#6b3700" fillOpacity="0.45" />
        ))}

        {/* ── Legs ──────────────────────────────────────────────────────── */}
        <rect x="22" y="230" width="11" height="60" rx="2" fill="#090e09" />
        <rect x="157" y="230" width="11" height="60" rx="2" fill="#090e09" />
        {/* Cross brace */}
        <line x1="27" y1="248" x2="163" y2="276" stroke="#0e1e0e" strokeWidth="1.4" />
        <line x1="163" y1="248" x2="27" y2="276" stroke="#0e1e0e" strokeWidth="1.4" />
      </svg>
    </div>
  );
});

export default LemonadeStand;
