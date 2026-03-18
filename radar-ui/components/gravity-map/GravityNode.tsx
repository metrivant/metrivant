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

  // Opacity: zero-mass dim, active scales 0.30–0.70
  const opacity = isZero ? 0.15 : 0.30 + visual * 0.40;

  // Glow radius (soft drop-shadow) for high-mass active nodes
  const glowSize = isZero ? 0 : Math.round(visual * 10);

  const ringRadius = radius + SELECTED_RING_OFFSET;
  const totalSize  = (ringRadius + 2) * 2; // enough room for ring

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

      {/* Node circle */}
      <div
        style={{
          position:     "absolute",
          left:         "50%",
          top:          "50%",
          transform:    "translate(-50%, -50%)",
          width:        radius * 2,
          height:       radius * 2,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.92)",
          border:       "1px solid rgba(255,255,255,0.60)",
          opacity,
          boxShadow:    glowSize > 0
            ? `0 0 ${glowSize}px ${Math.round(glowSize * 0.6)}px rgba(180,220,255,0.18)`
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
          color:        isZero
            ? "rgba(255,255,255,0.20)"
            : `rgba(255,255,255,${Math.max(0.30, opacity - 0.05).toFixed(2)})`,
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
