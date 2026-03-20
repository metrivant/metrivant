"use client";

import type { GravityNode } from "./gravityMath";
import {
  NODE_RADIUS_ZERO,
  NODE_RADIUS_MIN,
  NODE_RADIUS_MAX,
  SELECTED_RING_OFFSET,
} from "./gravityConstants";

type Props = {
  node:       GravityNode;
  selected:   boolean;
  onSelect:   (node: GravityNode) => void;
  divRef:     (el: HTMLDivElement | null) => void;
};

export default function GravityNodeMarker({ node, selected, onSelect, divRef }: Props) {
  const isZero  = node.mass_score_raw <= 0;
  const visual  = node.mass_score_visual; // 0–1

  // Radius: zero-mass uses fixed NODE_RADIUS_ZERO; active scales linearly
  const radius = isZero
    ? NODE_RADIUS_ZERO
    : NODE_RADIUS_MIN + (NODE_RADIUS_MAX - NODE_RADIUS_MIN) * visual;

  // Outline color — reflects signal quality state
  // Priority: movement (neon green) > recent signals (amber) > pressure (cold blue) > zero (ghost)
  const outlineColor = isZero
    ? "rgba(255,255,255,0.12)"
    : node.movement_count > 0
      ? `rgba(0,180,255,${(0.45 + visual * 0.40).toFixed(2)})`
      : node.signal_count_7d > 0
        ? `rgba(245,158,11,${(0.40 + visual * 0.40).toFixed(2)})`
        : node.pressure_index > 0
          ? `rgba(100,160,220,${(0.35 + visual * 0.35).toFixed(2)})`
          : "rgba(255,255,255,0.12)";

  // Glow color matches outline signal state (RGB only, for use in boxShadow)
  const glowRGB = isZero
    ? "255,255,255"
    : node.movement_count > 0
      ? "46,230,166"
      : node.signal_count_7d > 0
        ? "245,158,11"
        : node.pressure_index > 0
          ? "100,160,220"
          : "255,255,255";

  // Neon glow scaled by visual mass — faint for low-mass, strong for high-mass
  const glowOuter = isZero ? 0 : Math.round(4 + visual * 20);
  const glowInner = isZero ? 0 : Math.round(1 + visual * 7);
  const glowAlpha = isZero ? 0 : 0.18 + visual * 0.55;

  const ringRadius = radius + SELECTED_RING_OFFSET;
  const totalSize  = (ringRadius + 2) * 2; // enough room for ring

  // Label opacity: direct scale (not derived from parent opacity)
  const labelOpacity = isZero ? 0.20 : 0.50 + visual * 0.35;

  return (
    <div
      ref={divRef}
      style={{
        position:       "absolute",
        left:           0,
        top:            0,
        // Transform applied externally each frame to avoid React re-renders
        transform:      "translate(-50%, -50%)",
        pointerEvents:  "none",
        zIndex:         selected ? 30 : 20,
        // Disable default browser tap highlight
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Clickable outer hit area */}
      <div
        style={{
          position:       "absolute",
          left:           "50%",
          top:            "50%",
          transform:      "translate(-50%, -50%)",
          width:          totalSize,
          height:         totalSize,
          borderRadius:   "50%",
          pointerEvents:  "auto",
          cursor:         "pointer",
        }}
        onClick={() => onSelect(node)}
        aria-label={`Select ${node.name}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect(node)}
      />

      {/* Selection ring */}
      {selected && (
        <div
          style={{
            position:     "absolute",
            left:         "50%",
            top:          "50%",
            transform:    "translate(-50%, -50%)",
            width:        ringRadius * 2,
            height:       ringRadius * 2,
            borderRadius: "50%",
            border:       "1px solid rgba(255,255,255,0.30)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Node circle — white core, colored outline, neon glow scaled by mass */}
      <div
        style={{
          position:     "absolute",
          left:         "50%",
          top:          "50%",
          transform:    "translate(-50%, -50%)",
          width:        radius * 2,
          height:       radius * 2,
          borderRadius: "50%",
          background:   isZero ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.90)",
          border:       `1.5px solid ${outlineColor}`,
          boxShadow:    glowOuter > 0
            ? `0 0 ${glowOuter}px ${glowInner}px rgba(${glowRGB},${glowAlpha.toFixed(2)})`
            : "none",
          pointerEvents: "none",
        }}
      />

      {/* Label — always visible, not just on hover */}
      <div
        style={{
          position:     "absolute",
          left:         "50%",
          top:          `calc(50% + ${radius + 7}px)`,
          transform:    "translateX(-50%)",
          whiteSpace:   "nowrap",
          fontFamily:   "ui-monospace, SFMono-Regular, monospace",
          fontSize:     "9px",
          fontWeight:   600,
          letterSpacing: "0.08em",
          color:        `rgba(255,255,255,${labelOpacity.toFixed(2)})`,
          textTransform: "uppercase",
          pointerEvents: "none",
          textShadow:   "0 1px 4px rgba(0,0,0,0.70)",
          maxWidth:     "80px",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          textAlign:    "center",
        }}
      >
        {node.name}
      </div>
    </div>
  );
}
