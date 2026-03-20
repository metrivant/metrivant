"use client";

/**
 * PipelineExperience — Scroll-triggered SVG pipeline narrative
 *
 * Pure SVG. No Three.js. Customer-facing copy.
 * A data packet travels the pipeline as the section scrolls into view.
 * At RADAR, a mini radar pulses — connecting process to product.
 */

import { useRef, useState, useEffect, useCallback } from "react";

// ── Pipeline stages — customer-facing ────────────────────────────────────────

const STAGES = [
  { label: "TRACK",     desc: "Register any competitor for continuous monitoring" },
  { label: "MONITOR",   desc: "Watch their pages for every change, every day" },
  { label: "CAPTURE",   desc: "Snapshot content, section by section" },
  { label: "DETECT",    desc: "Surface what actually shifted" },
  { label: "CLASSIFY",  desc: "Score confidence. Filter noise." },
  { label: "SYNTHESISE", desc: "Cluster signals into strategic movements" },
  { label: "RADAR",     desc: "See it all — live, in one place" },
] as const;

const N = STAGES.length;
const GREEN = "#00B4FF";

// ── Mini radar SVG (rendered at the RADAR node when packet arrives) ──────────

function MiniRadar({ active }: { active: boolean }) {
  return (
    <g>
      {/* Rings */}
      {[16, 11, 6].map((r, i) => (
        <circle
          key={r}
          cx={0} cy={0} r={r}
          fill="none"
          stroke={GREEN}
          strokeWidth={0.6}
          opacity={active ? 0.3 + i * 0.1 : 0.08}
          style={{ transition: "opacity 0.6s ease" }}
        />
      ))}
      {/* Center dot */}
      <circle
        cx={0} cy={0} r={2}
        fill={GREEN}
        opacity={active ? 0.9 : 0.15}
        style={{ transition: "opacity 0.6s ease" }}
      >
        {active && (
          <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Sweep arm */}
      <line
        x1={0} y1={0} x2={0} y2={-15}
        stroke={GREEN}
        strokeWidth={0.8}
        opacity={active ? 0.6 : 0}
        style={{ transition: "opacity 0.6s ease", transformOrigin: "0 0" }}
      >
        {active && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0" to="360"
            dur="4s"
            repeatCount="indefinite"
          />
        )}
      </line>
      {/* Expanding pulse ring on arrival */}
      {active && (
        <circle
          cx={0} cy={0} r={4}
          fill="none"
          stroke={GREEN}
          strokeWidth={0.8}
        >
          <animate attributeName="r" values="4;22" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelineExperience() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0–1 scroll progress

  const handleScroll = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Start when section top hits bottom of viewport, end when section bottom hits top
    const start = rect.top - vh;
    const end = rect.bottom;
    const range = end - start;
    if (range <= 0) return;
    const raw = 1 - (rect.top - vh * 0.15) / (range * 0.65);
    setProgress(Math.max(0, Math.min(1, raw)));
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Derive active stage from progress
  const activeStage = Math.min(N - 1, Math.floor(progress * N));
  const packetProgress = progress; // 0–1 across full pipeline
  const radarActive = progress >= 0.92;

  // SVG layout
  const VB_W = 900;
  const VB_H = 200;
  const PAD_X = 65;
  const PIPE_Y = 80;
  const NODE_R = 12;
  const nodeXs = Array.from({ length: N }, (_, i) =>
    PAD_X + (i / (N - 1)) * (VB_W - PAD_X * 2)
  );

  // Packet position
  const packetX = PAD_X + packetProgress * (VB_W - PAD_X * 2);

  return (
    <div
      ref={sectionRef}
      style={{
        width: "100%",
        background: "#000002",
        overflow: "hidden",
        padding: "48px 0 56px",
      }}
    >
      {/* Section label */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.28em",
            color: "rgba(0,180,255,0.40)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          How it works
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.02em",
          }}
        >
          From page change to strategic intelligence
        </div>
      </div>

      {/* Pipeline SVG */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: "100%", maxWidth: 960, display: "block", margin: "0 auto" }}
        aria-hidden="true"
      >
        <defs>
          {/* Packet glow */}
          <radialGradient id="packet-glow">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.6" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </radialGradient>
          {/* Pipe gradient for lit segments */}
          <linearGradient id="pipe-lit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.5" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* ── Pipe segments ── */}
        {Array.from({ length: N - 1 }, (_, i) => {
          const x1 = nodeXs[i] + NODE_R + 4;
          const x2 = nodeXs[i + 1] - NODE_R - 4;
          const lit = i < activeStage;
          return (
            <rect
              key={`pipe-${i}`}
              x={x1}
              y={PIPE_Y - 2}
              width={x2 - x1}
              height={4}
              rx={2}
              fill={lit ? "url(#pipe-lit)" : "rgba(0,180,255,0.06)"}
              style={{ transition: "fill 0.5s ease" }}
            />
          );
        })}

        {/* ── Nodes ── */}
        {nodeXs.map((cx, i) => {
          const isActive = i === activeStage;
          const isPast = i < activeStage;
          const isRadar = i === N - 1;

          return (
            <g key={`node-${i}`}>
              {/* Outer glow for active/past nodes */}
              {(isActive || isPast) && (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? NODE_R + 12 : NODE_R + 6}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth={isActive ? 1 : 0.5}
                  opacity={isActive ? 0.18 : 0.06}
                  style={{ transition: "all 0.5s ease" }}
                />
              )}

              {/* Node circle */}
              {isRadar && radarActive ? (
                <g transform={`translate(${cx},${PIPE_Y})`}>
                  <MiniRadar active={radarActive} />
                </g>
              ) : (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? NODE_R + 2 : NODE_R}
                  fill={
                    isActive
                      ? "rgba(0,180,255,0.15)"
                      : isPast
                      ? "rgba(0,180,255,0.08)"
                      : "rgba(0,180,255,0.02)"
                  }
                  stroke={
                    isActive
                      ? GREEN
                      : isPast
                      ? "rgba(0,180,255,0.35)"
                      : "rgba(0,180,255,0.10)"
                  }
                  strokeWidth={isActive ? 1.5 : 1}
                  style={{ transition: "all 0.4s ease" }}
                />
              )}

              {/* Inner dot */}
              {!(isRadar && radarActive) && (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? 3.5 : isPast ? 2.5 : 1.5}
                  fill={isActive || isPast ? GREEN : "rgba(0,180,255,0.15)"}
                  opacity={isActive ? 0.9 : isPast ? 0.6 : 0.3}
                  style={{ transition: "all 0.4s ease" }}
                />
              )}

              {/* Stage label */}
              <text
                x={cx}
                y={PIPE_Y - NODE_R - 14}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={isActive ? 700 : 600}
                letterSpacing="1.5"
                fontFamily="monospace"
                fill={
                  isActive ? GREEN
                  : isPast ? "rgba(0,180,255,0.40)"
                  : "rgba(100,116,139,0.28)"
                }
                style={{ transition: "fill 0.4s ease" }}
              >
                {STAGES[i].label}
              </text>

              {/* Description — below node */}
              <text
                x={cx}
                y={PIPE_Y + NODE_R + 22}
                textAnchor="middle"
                fontSize={8}
                fontFamily="system-ui, -apple-system, sans-serif"
                fill={
                  isActive ? "rgba(255,255,255,0.55)"
                  : isPast ? "rgba(255,255,255,0.22)"
                  : "rgba(255,255,255,0.08)"
                }
                style={{ transition: "fill 0.5s ease" }}
              >
                {STAGES[i].desc}
              </text>
            </g>
          );
        })}

        {/* ── Data packet — travels the pipeline ── */}
        {progress > 0.01 && progress < 0.98 && (
          <g>
            {/* Glow */}
            <circle
              cx={packetX} cy={PIPE_Y}
              r={18}
              fill="url(#packet-glow)"
            />
            {/* Core */}
            <circle
              cx={packetX} cy={PIPE_Y}
              r={4}
              fill={GREEN}
              opacity={0.95}
            />
            {/* Trailing glow line */}
            <line
              x1={Math.max(PAD_X, packetX - 40)}
              y1={PIPE_Y}
              x2={packetX}
              y2={PIPE_Y}
              stroke={GREEN}
              strokeWidth={2}
              opacity={0.12}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* ── Arrival burst at RADAR ── */}
        {radarActive && (
          <circle
            cx={nodeXs[N - 1]} cy={PIPE_Y}
            r={4}
            fill="none"
            stroke={GREEN}
            strokeWidth={1.2}
          >
            <animate attributeName="r" values="4;35" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0" dur="3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {/* Active stage callout — below the SVG */}
      <div
        style={{
          textAlign: "center",
          marginTop: 28,
          minHeight: 40,
        }}
      >
        {progress > 0.02 && (
          <div
            key={activeStage}
            style={{
              animation: "content-reveal 0.3s ease-out both",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                letterSpacing: "0.18em",
                color: radarActive ? GREEN : "rgba(255,255,255,0.70)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {radarActive ? "Intelligence, live" : `Step ${activeStage + 1} — ${STAGES[activeStage].label}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
