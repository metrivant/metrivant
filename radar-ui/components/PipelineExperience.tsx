"use client";

/**
 * PipelineExperience — Scroll-triggered SVG pipeline narrative
 *
 * Pure SVG. No Three.js. Customer-facing copy.
 * A data packet travels the pipeline as the section scrolls into view.
 * At RADAR, a mini radar pulses — connecting process to product.
 *
 * The section has generous height (min-height: 80vh) to give the scroll
 * animation room to breathe. The SVG is sticky within the section so
 * it stays centred while the user scrolls through.
 */

import { useRef, useState, useEffect, useCallback } from "react";

// ── Pipeline stages — customer-facing ────────────────────────────────────────

const STAGES = [
  { label: "TRACK",      desc: "Register any competitor for continuous monitoring" },
  { label: "MONITOR",    desc: "Watch their key pages — pricing, features, changelog" },
  { label: "CAPTURE",    desc: "Snapshot content and section it for comparison" },
  { label: "DETECT",     desc: "Surface what actually shifted from the baseline" },
  { label: "CLASSIFY",   desc: "Score confidence and filter noise from signal" },
  { label: "SYNTHESISE", desc: "Cluster signals into strategic movements" },
  { label: "RADAR",      desc: "See everything — live, in one place" },
] as const;

const N = STAGES.length;
const ACCENT = "#00B4FF";

// ── Mini radar SVG (rendered at the RADAR node when packet arrives) ──────────

function MiniRadar({ active }: { active: boolean }) {
  return (
    <g>
      {[16, 11, 6].map((r, i) => (
        <circle
          key={r}
          cx={0} cy={0} r={r}
          fill="none"
          stroke={ACCENT}
          strokeWidth={0.6}
          opacity={active ? 0.3 + i * 0.1 : 0.08}
          style={{ transition: "opacity 0.6s ease" }}
        />
      ))}
      <circle
        cx={0} cy={0} r={2}
        fill={ACCENT}
        opacity={active ? 0.9 : 0.15}
        style={{ transition: "opacity 0.6s ease" }}
      >
        {active && (
          <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
      <line
        x1={0} y1={0} x2={0} y2={-15}
        stroke={ACCENT}
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
      {active && (
        <circle cx={0} cy={0} r={4} fill="none" stroke={ACCENT} strokeWidth={0.8}>
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
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const sectionH = el.offsetHeight;
    // scrolled: 0 when section top enters viewport bottom, sectionH when section bottom exits viewport top
    const scrolled = vh - rect.top;
    // Map 0..sectionH → 0..1, representing how far through the section the user has scrolled
    const raw = scrolled / sectionH;
    const clamped = Math.max(0, Math.min(1, raw));
    // Delay start: wait until 20% scrolled, then map linearly across the remaining 80%
    const THRESHOLD = 0.20;
    const remapped = clamped <= THRESHOLD ? 0 : (clamped - THRESHOLD) / (1 - THRESHOLD);
    setProgress(Math.min(1, remapped));
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Derive active stage from progress
  const activeStage = Math.min(N - 1, Math.floor(progress * N));
  const radarActive = progress >= 0.92;

  // SVG layout — labels above nodes only, no description text in SVG
  const VB_W = 900;
  const VB_H = 120;
  const PAD_X = 65;
  const PIPE_Y = 60;
  const NODE_R = 12;
  const nodeXs = Array.from({ length: N }, (_, i) =>
    PAD_X + (i / (N - 1)) * (VB_W - PAD_X * 2)
  );

  // Packet position
  const packetX = PAD_X + progress * (VB_W - PAD_X * 2);

  return (
    <div
      ref={sectionRef}
      style={{
        width: "100%",
        background: "#000002",
        // Tall section: user scrolls through this height while sticky content stays visible
        height: "200vh",
        position: "relative",
      }}
    >
      {/* Sticky container — stays centered in viewport while section scrolls */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 0",
        }}
      >
      {/* Section header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.28em",
            color: "rgba(0,180,255,0.40)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          How it works
        </div>
        <div
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.02em",
          }}
        >
          From change to strategic intelligence
        </div>
      </div>

      {/* Pipeline SVG — nodes + pipes + packet only */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: "100%", maxWidth: 900, display: "block", margin: "0 auto", padding: "0 20px" }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="packet-glow">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pipe-lit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Pipe segments */}
        {Array.from({ length: N - 1 }, (_, i) => {
          const x1 = nodeXs[i] + NODE_R + 4;
          const x2 = nodeXs[i + 1] - NODE_R - 4;
          const lit = i < activeStage;
          return (
            <rect
              key={`pipe-${i}`}
              x={x1} y={PIPE_Y - 2}
              width={x2 - x1} height={4} rx={2}
              fill={lit ? "url(#pipe-lit)" : "rgba(0,180,255,0.06)"}
              style={{ transition: "fill 0.5s ease" }}
            />
          );
        })}

        {/* Nodes */}
        {nodeXs.map((cx, i) => {
          const isActive = i === activeStage;
          const isPast = i < activeStage;
          const isRadar = i === N - 1;
          return (
            <g key={`node-${i}`}>
              {(isActive || isPast) && (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? NODE_R + 12 : NODE_R + 6}
                  fill="none" stroke={ACCENT}
                  strokeWidth={isActive ? 1 : 0.5}
                  opacity={isActive ? 0.18 : 0.06}
                  style={{ transition: "all 0.5s ease" }}
                />
              )}
              {isRadar && radarActive ? (
                <g transform={`translate(${cx},${PIPE_Y})`}>
                  <MiniRadar active={radarActive} />
                </g>
              ) : (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? NODE_R + 2 : NODE_R}
                  fill={isActive ? "rgba(0,180,255,0.15)" : isPast ? "rgba(0,180,255,0.08)" : "rgba(0,180,255,0.02)"}
                  stroke={isActive ? ACCENT : isPast ? "rgba(0,180,255,0.35)" : "rgba(0,180,255,0.10)"}
                  strokeWidth={isActive ? 1.5 : 1}
                  style={{ transition: "all 0.4s ease" }}
                />
              )}
              {!(isRadar && radarActive) && (
                <circle
                  cx={cx} cy={PIPE_Y}
                  r={isActive ? 3.5 : isPast ? 2.5 : 1.5}
                  fill={isActive || isPast ? ACCENT : "rgba(0,180,255,0.15)"}
                  opacity={isActive ? 0.9 : isPast ? 0.6 : 0.3}
                  style={{ transition: "all 0.4s ease" }}
                />
              )}
              {/* Label above node */}
              <text
                x={cx} y={PIPE_Y - NODE_R - 16}
                textAnchor="middle"
                fontSize={9}
                fontWeight={isActive ? 700 : 600}
                letterSpacing="1.8"
                fontFamily="monospace"
                fill={isActive ? ACCENT : isPast ? "rgba(0,180,255,0.40)" : "rgba(100,116,139,0.28)"}
                style={{ transition: "fill 0.4s ease" }}
              >
                {STAGES[i].label}
              </text>
            </g>
          );
        })}

        {/* Data packet */}
        {progress > 0.01 && progress < 0.98 && (
          <g>
            <circle cx={packetX} cy={PIPE_Y} r={18} fill="url(#packet-glow)" />
            <circle cx={packetX} cy={PIPE_Y} r={4} fill={ACCENT} opacity={0.95} />
            <line
              x1={Math.max(PAD_X, packetX - 50)} y1={PIPE_Y}
              x2={packetX} y2={PIPE_Y}
              stroke={ACCENT} strokeWidth={2} opacity={0.10} strokeLinecap="round"
            />
          </g>
        )}

        {/* Arrival burst */}
        {radarActive && (
          <circle cx={nodeXs[N - 1]} cy={PIPE_Y} r={4} fill="none" stroke={ACCENT} strokeWidth={1.2}>
            <animate attributeName="r" values="4;35" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0" dur="3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {/* Active stage description — single line below SVG, well-spaced */}
      <div
        style={{
          textAlign: "center",
          marginTop: 40,
          minHeight: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {progress > 0.02 && (
          <div
            key={activeStage}
            style={{ animation: "content-reveal 0.3s ease-out both" }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: "0.20em",
                color: radarActive ? ACCENT : "rgba(255,255,255,0.75)",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {radarActive ? "Intelligence, live" : `Step ${activeStage + 1} — ${STAGES[activeStage].label}`}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.40)",
                letterSpacing: "0.01em",
                maxWidth: 400,
              }}
            >
              {STAGES[activeStage].desc}
            </div>
          </div>
        )}
      </div>
      </div>{/* end sticky */}
    </div>
  );
}
