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
  { label: "TRACK",      desc: "Register any competitor for continuous monitoring",  icon: "◎" },
  { label: "MONITOR",    desc: "Watch their key pages — pricing, features, changelog", icon: "◉" },
  { label: "CAPTURE",    desc: "Snapshot content and section it for comparison",    icon: "⧫" },
  { label: "DETECT",     desc: "Surface what actually shifted from the baseline",   icon: "△" },
  { label: "CLASSIFY",   desc: "Score confidence and filter noise from signal",     icon: "⬡" },
  { label: "SYNTHESISE", desc: "Cluster signals into strategic movements",          icon: "⟐" },
  { label: "RADAR",      desc: "See everything — live, in one place",               icon: "⊛" },
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

// ── Stage visualization — 3D data-driven animations ──────────────────────────

function StageVisualization({ stage, active }: { stage: number; active: boolean }) {
  const baseStyle: React.CSSProperties = {
    width: "120px",
    height: "80px",
    position: "relative",
    margin: "0 auto",
    opacity: active ? 1 : 0.3,
    transition: "opacity 0.5s ease",
  };

  // TRACK — Target crosshair focusing
  if (stage === 0) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <circle cx="60" cy="40" r="25" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.2" />
          <circle cx="60" cy="40" r="15" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.4">
            {active && <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite" />}
          </circle>
          <line x1="35" y1="40" x2="45" y2="40" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" />
          <line x1="75" y1="40" x2="85" y2="40" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" />
          <line x1="60" y1="15" x2="60" y2="25" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" />
          <line x1="60" y1="55" x2="60" y2="65" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" />
          <circle cx="60" cy="40" r="2" fill={ACCENT}>
            {active && <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />}
          </circle>
        </svg>
      </div>
    );
  }

  // MONITOR — Scanning lines
  if (stage === 1) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <rect x="25" y="15" width="70" height="50" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.25" rx="2" />
          {[0, 1, 2].map((i) => (
            <line key={i} x1="30" y1={25 + i * 15} x2="90" y2={25 + i * 15} stroke={ACCENT} strokeWidth="1" opacity="0.15" />
          ))}
          <line x1="30" y1="30" x2="90" y2="30" stroke={ACCENT} strokeWidth="2" opacity="0.6">
            {active && <animate attributeName="y1" values="25;55;25" dur="3s" repeatCount="indefinite" />}
            {active && <animate attributeName="y2" values="25;55;25" dur="3s" repeatCount="indefinite" />}
          </line>
        </svg>
      </div>
    );
  }

  // CAPTURE — Camera shutter
  if (stage === 2) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <rect x="30" y="20" width="60" height="40" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.3" rx="3" />
          <circle cx="60" cy="40" r="12" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.4" />
          {active && (
            <>
              <line x1="40" y1="40" x2="80" y2="40" stroke={ACCENT} strokeWidth="2" opacity="0.6">
                <animate attributeName="x1" values="40;60;40" dur="2s" repeatCount="indefinite" />
                <animate attributeName="x2" values="80;60;80" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" />
              </line>
              <line x1="60" y1="28" x2="60" y2="52" stroke={ACCENT} strokeWidth="2" opacity="0.6">
                <animate attributeName="y1" values="28;40;28" dur="2s" repeatCount="indefinite" />
                <animate attributeName="y2" values="52;40;52" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" />
              </line>
            </>
          )}
        </svg>
      </div>
    );
  }

  // DETECT — Diff/change indicator
  if (stage === 3) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <rect x="20" y="25" width="35" height="30" fill="rgba(0,180,255,0.05)" stroke={ACCENT} strokeWidth="1" opacity="0.2" />
          <rect x="65" y="25" width="35" height="30" fill="rgba(0,180,255,0.10)" stroke={ACCENT} strokeWidth="1" opacity="0.4" />
          {active && (
            <>
              <line x1="37" y1="30" x2="37" y2="50" stroke="#ef4444" strokeWidth="2" opacity="0.6">
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
              </line>
              <line x1="82" y1="30" x2="82" y2="50" stroke={ACCENT} strokeWidth="2" opacity="0.6">
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" begin="0.5s" />
              </line>
            </>
          )}
        </svg>
      </div>
    );
  }

  // CLASSIFY — Filter/score bars
  if (stage === 4) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          {[0, 1, 2, 3].map((i) => {
            const heights = [35, 25, 45, 15];
            const h = heights[i];
            return (
              <rect
                key={i}
                x={25 + i * 18}
                y={60 - h}
                width="12"
                height={h}
                fill={i >= 2 ? ACCENT : "rgba(100,116,139,0.3)"}
                opacity={active && i >= 2 ? 0.6 : 0.2}
                rx="1"
              >
                {active && i >= 2 && (
                  <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                )}
              </rect>
            );
          })}
        </svg>
      </div>
    );
  }

  // SYNTHESISE — Clustering circles
  if (stage === 5) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <circle cx="45" cy="35" r="8" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.3" />
          <circle cx="60" cy="28" r="8" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.3" />
          <circle cx="75" cy="35" r="8" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.3" />
          <circle cx="60" cy="45" r="25" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity={active ? 0.5 : 0.2}>
            {active && <animate attributeName="r" values="22;26;22" dur="3s" repeatCount="indefinite" />}
          </circle>
          {active && (
            <line x1="45" y1="35" x2="60" y2="40" stroke={ACCENT} strokeWidth="1" opacity="0.4">
              <animate attributeName="opacity" values="0;0.6;0" dur="2s" repeatCount="indefinite" />
            </line>
          )}
        </svg>
      </div>
    );
  }

  // RADAR — Sweep visual (mini version of main radar)
  if (stage === 6) {
    return (
      <div style={baseStyle}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <circle cx="60" cy="40" r="28" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.15" />
          <circle cx="60" cy="40" r="18" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.25" />
          <circle cx="60" cy="40" r="8" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.35" />
          <circle cx="60" cy="40" r="2" fill={ACCENT} opacity="0.8" />
          <line x1="60" y1="40" x2="60" y2="15" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" style={{ transformOrigin: "60px 40px" }}>
            {active && <animateTransform attributeName="transform" type="rotate" from="0 60 40" to="360 60 40" dur="4s" repeatCount="indefinite" />}
          </line>
        </svg>
      </div>
    );
  }

  return null;
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

    // Only start animation when the full section is on screen
    // Section top must be at or above viewport top, and section bottom must be at or below viewport bottom
    const sectionBottom = rect.top + sectionH;
    const fullyVisible = rect.top <= 0 && sectionBottom >= vh;

    if (!fullyVisible) {
      setProgress(0);
      return;
    }

    // Once fully visible, scroll through remaining height
    const scrolled = -rect.top; // How far top has scrolled past viewport top
    const scrollable = sectionH - vh; // Total scrollable distance
    const raw = scrolled / scrollable;
    const clamped = Math.max(0, Math.min(1, raw));
    setProgress(clamped);
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
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
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
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
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

      {/* Active stage description + 3D visualization */}
      <div
        style={{
          textAlign: "center",
          marginTop: 40,
          minHeight: 180,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {progress > 0.02 && (
          <div
            key={activeStage}
            style={{
              animation: "content-reveal 0.3s ease-out both",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
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
                  marginBottom: 16,
                }}
              >
                {STAGES[activeStage].desc}
              </div>
            </div>

            {/* Stage-specific 3D visualization */}
            <StageVisualization stage={activeStage} active={true} />
          </div>
        )}
      </div>
      </div>{/* end sticky */}
    </div>
  );
}
