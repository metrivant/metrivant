"use client";

import { memo } from "react";
import type { RadarCompetitor } from "../../../lib/api";

// ── Pixel-art movement palette ─────────────────────────────────────────────────

const MOVEMENT_COLORS: Record<string, string> = {
  pricing_strategy_shift: "#ff3333",
  product_expansion: "#3399ff",
  market_reposition: "#33ff88",
  enterprise_push: "#cc44ff",
  ecosystem_expansion: "#ffcc00",
};

const MOVEMENT_LABELS: Record<string, string> = {
  pricing_strategy_shift: "PRICE WAR",
  product_expansion: "NEW MENU",
  market_reposition: "REBRAND",
  enterprise_push: "GOING BIG",
  ecosystem_expansion: "EXPANDING",
};

function getColor(type: string | null): string {
  return type ? (MOVEMENT_COLORS[type] ?? "#8888aa") : "#445566";
}

function getLabel(type: string | null): string {
  return type ? (MOVEMENT_LABELS[type] ?? type.replace(/_/g, " ").toUpperCase()) : "WATCHING";
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  competitor: RadarCompetitor;
  isSelected: boolean;
  isDimmed: boolean;
  isNew: boolean;
  rank: number;
  onClick: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

const LemonadeStand = memo(function LemonadeStand({
  competitor,
  isSelected,
  isDimmed,
  isNew,
  rank,
  onClick,
}: Props) {
  const momentum = Number(competitor.momentum_score ?? 0);
  const signals  = competitor.signals_7d ?? 0;
  const accent   = getColor(competitor.latest_movement_type);
  const label    = getLabel(competitor.latest_movement_type);
  const isActive = competitor.latest_movement_type !== null;

  const displayName =
    competitor.competitor_name.length > 11
      ? competitor.competitor_name.slice(0, 10) + "…"
      : competitor.competitor_name;

  // Taller stand = more momentum
  const bodyHeight = 120 + Math.min(momentum * 6, 48);

  const heatArrow =
    momentum >= 5 ? "▲▲" :
    momentum >= 3 ? "▲"  :
    momentum >= 1 ? "▸"  : "·";

  return (
    <div
      onClick={onClick}
      className="relative flex cursor-pointer select-none flex-col items-center"
      style={{
        opacity: isDimmed ? 0.35 : 1,
        transform: isSelected ? "translateY(-10px)" : isDimmed ? "scale(0.90)" : "none",
        transition: "opacity 0.25s, transform 0.25s",
        filter: isDimmed ? "saturate(0.3)" : "none",
      }}
    >

      {/* ── New Kid banner ──────────────────────────────────────────────── */}
      {isNew && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ffcc00",
            color: "#000",
            fontFamily: "ui-monospace, monospace",
            fontSize: "8px",
            fontWeight: "bold",
            padding: "2px 7px",
            letterSpacing: "0.18em",
            whiteSpace: "nowrap",
            boxShadow: "2px 2px 0 #000",
            zIndex: 20,
          }}
        >
          ★ NEW KID
        </div>
      )}

      {/* ── Rank badge ──────────────────────────────────────────────────── */}
      <div
        style={{
          alignSelf: "flex-start",
          marginBottom: 3,
          background: "#000",
          color: accent,
          fontFamily: "ui-monospace, monospace",
          fontSize: "8px",
          fontWeight: "bold",
          padding: "1px 5px",
          border: `1px solid ${accent}66`,
          letterSpacing: "0.1em",
        }}
      >
        #{rank}
      </div>

      {/* ── Stand wrapper ───────────────────────────────────────────────── */}
      <div
        style={{
          width: 136,
          border: `2px solid ${isSelected ? accent : isActive ? accent + "77" : "#22334455"}`,
          background: "#09091a",
          display: "flex",
          flexDirection: "column",
          boxShadow: isSelected
            ? `0 0 0 2px ${accent}55, 5px 5px 0 #000`
            : "4px 4px 0 #000",
          transition: "box-shadow 0.2s, border-color 0.2s",
        }}
      >
        {/* Awning */}
        <div
          style={{
            height: 26,
            background: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "2px solid #000",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Diagonal stripes */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent 0px, transparent 5px,
                rgba(0,0,0,0.18) 5px, rgba(0,0,0,0.18) 7px
              )`,
            }}
          />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "8px",
              fontWeight: "bold",
              color: "#000",
              letterSpacing: "0.16em",
              position: "relative",
              zIndex: 1,
            }}
          >
            {label}
          </span>
        </div>

        {/* Sign */}
        <div
          style={{
            margin: "5px 5px 4px",
            background: "#11111f",
            border: `1px solid ${isActive ? accent + "55" : "#1e2e3e"}`,
            padding: "4px 6px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              fontWeight: "bold",
              color: isActive ? "#eef" : "#445566",
              letterSpacing: "0.07em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName.toUpperCase()}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 4,
            margin: "0 5px",
            height: bodyHeight,
          }}
        >
          {/* Signals panel */}
          <div
            style={{
              flex: 1,
              background: "#0c0c1c",
              border: `1px solid ${signals > 0 ? accent + "33" : "#1a2233"}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 4px",
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "7px",
                color: "#334455",
                letterSpacing: "0.14em",
                marginBottom: 4,
              }}
            >
              SIGNALS
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "28px",
                fontWeight: "bold",
                color: signals > 0 ? accent : "#1e2e3e",
                lineHeight: 1,
              }}
            >
              {signals}
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "7px",
                color: "#334455",
                marginTop: 3,
                letterSpacing: "0.1em",
              }}
            >
              7 DAYS
            </div>
            {/* Pixel dots */}
            <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    background: i < Math.min(signals, 5) ? accent : "#1a2233",
                    boxShadow: i < Math.min(signals, 5) ? `0 0 3px ${accent}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Heat panel */}
          <div
            style={{
              width: 36,
              background: "#0c0c1c",
              border: `1px solid ${momentum > 0 ? accent + "33" : "#1a2233"}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "7px",
                color: "#334455",
                letterSpacing: "0.1em",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}
            >
              HEAT
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "14px",
                fontWeight: "bold",
                color: momentum > 0 ? accent : "#223344",
                lineHeight: 1,
              }}
            >
              {heatArrow}
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "8px",
                color: momentum > 0 ? accent + "bb" : "#223344",
                lineHeight: 1,
              }}
            >
              {momentum.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Counter bar */}
        <div
          style={{
            height: 10,
            background: "#060612",
            borderTop: "1px solid #1a2233",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            flexShrink: 0,
            marginTop: 5,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ width: 3, height: 3, background: "#1a2233" }} />
          ))}
        </div>
      </div>

      {/* Legs */}
      <div style={{ display: "flex", justifyContent: "space-between", width: 112, flexShrink: 0 }}>
        <div
          style={{
            width: 10,
            height: 22,
            background: "#07071a",
            border: "1px solid #1a2233",
            boxShadow: "2px 2px 0 #000",
          }}
        />
        <div
          style={{
            width: 10,
            height: 22,
            background: "#07071a",
            border: "1px solid #1a2233",
            boxShadow: "2px 2px 0 #000",
          }}
        />
      </div>

    </div>
  );
});

export default LemonadeStand;
