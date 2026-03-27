"use client";

import { motion } from "framer-motion";

// Stage-specific animated icons
function StageIcon({ stage }: { stage: number }) {
  const iconProps = {
    width: "48",
    height: "48",
    viewBox: "0 0 48 48",
    fill: "none",
  };

  // TRACK - Target crosshair
  if (stage === 0) {
    return (
      <svg {...iconProps}>
        <motion.circle
          cx="24" cy="24" r="18"
          stroke="#00B4FF" strokeWidth="1"
          opacity="0.25"
          animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <circle cx="24" cy="24" r="12" stroke="#00B4FF" strokeWidth="1.2" opacity="0.35" />
        <circle cx="24" cy="24" r="6" stroke="#00B4FF" strokeWidth="1.5" opacity="0.55" />
        <motion.circle
          cx="24" cy="24" r="3"
          fill="#00B4FF"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <line x1="24" y1="6" x2="24" y2="14" stroke="#00B4FF" strokeWidth="1.5" opacity="0.45" />
        <line x1="24" y1="34" x2="24" y2="42" stroke="#00B4FF" strokeWidth="1.5" opacity="0.45" />
        <line x1="6" y1="24" x2="14" y2="24" stroke="#00B4FF" strokeWidth="1.5" opacity="0.45" />
        <line x1="34" y1="24" x2="42" y2="24" stroke="#00B4FF" strokeWidth="1.5" opacity="0.45" />
      </svg>
    );
  }

  // MONITOR - Radar sweep
  if (stage === 1) {
    return (
      <svg {...iconProps}>
        <circle cx="24" cy="24" r="18" stroke="#00B4FF" strokeWidth="1" opacity="0.20" />
        <circle cx="24" cy="24" r="12" stroke="#00B4FF" strokeWidth="0.8" opacity="0.25" />
        <circle cx="24" cy="24" r="6" stroke="#00B4FF" strokeWidth="0.8" opacity="0.30" />
        <motion.g
          style={{ transformOrigin: "24px 24px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <path d="M24 24 L18 8 A18 18 0 0 1 38 14 Z" fill="#00B4FF" fillOpacity="0.15" />
          <line x1="24" y1="24" x2="38" y2="14" stroke="#00B4FF" strokeWidth="1.5" opacity="0.70" />
        </motion.g>
        <circle cx="24" cy="24" r="2" fill="#00B4FF" opacity="0.90" />
        <motion.circle
          cx="32" cy="16" r="1.5"
          fill="#00B4FF"
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>
    );
  }

  // CAPTURE - Camera snapshot
  if (stage === 2) {
    return (
      <svg {...iconProps}>
        <rect x="10" y="14" width="28" height="20" rx="3" stroke="#00B4FF" strokeWidth="1.2" opacity="0.40" />
        <circle cx="24" cy="24" r="6" stroke="#00B4FF" strokeWidth="1.5" opacity="0.55" />
        <motion.circle
          cx="24" cy="24" r="3"
          fill="#00B4FF"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <rect x="28" y="16" width="6" height="3" rx="1" fill="#00B4FF" opacity="0.30" />
        <motion.rect
          x="10" y="14" width="28" height="20" rx="3"
          stroke="#00B4FF" strokeWidth="2"
          fill="none"
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </svg>
    );
  }

  // BASELINE - Reference line with anchor
  if (stage === 3) {
    return (
      <svg {...iconProps}>
        <line x1="8" y1="24" x2="40" y2="24" stroke="#00B4FF" strokeWidth="1.5" opacity="0.35" strokeDasharray="2 2" />
        <motion.line
          x1="8" y1="24" x2="40" y2="24"
          stroke="#00B4FF" strokeWidth="2"
          animate={{ strokeDashoffset: [0, -20] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          strokeDasharray="4 4"
          opacity="0.60"
        />
        <circle cx="12" cy="24" r="3" fill="#00B4FF" opacity="0.50" />
        <circle cx="36" cy="24" r="3" fill="#00B4FF" opacity="0.50" />
        <motion.circle
          cx="24" cy="24" r="4"
          stroke="#00B4FF" strokeWidth="1.5"
          fill="none"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.3, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <circle cx="24" cy="24" r="2" fill="#00B4FF" opacity="0.80" />
      </svg>
    );
  }

  // DETECT - Diff comparison
  if (stage === 4) {
    return (
      <svg {...iconProps}>
        <rect x="8" y="12" width="14" height="24" rx="2" stroke="#00B4FF" strokeWidth="1" opacity="0.30" />
        <rect x="26" y="12" width="14" height="24" rx="2" stroke="#00B4FF" strokeWidth="1" opacity="0.30" />
        <line x1="12" y1="18" x2="18" y2="18" stroke="#00B4FF" strokeWidth="1" opacity="0.40" />
        <line x1="12" y1="22" x2="18" y2="22" stroke="#00B4FF" strokeWidth="1" opacity="0.40" />
        <motion.line
          x1="30" y1="18" x2="36" y2="18"
          stroke="#00B4FF" strokeWidth="1.5"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.line
          x1="30" y1="22" x2="36" y2="22"
          stroke="#00B4FF" strokeWidth="1.5"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        />
        <motion.path
          d="M22 20 L26 20"
          stroke="#00B4FF" strokeWidth="1.5"
          animate={{ x: [0, 2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <path d="M26 20 L24 18 L24 22 Z" fill="#00B4FF" opacity="0.70" />
      </svg>
    );
  }

  // CLASSIFY - Scoring meter
  if (stage === 5) {
    return (
      <svg {...iconProps}>
        <path
          d="M8 32 Q24 8 40 32"
          stroke="#00B4FF" strokeWidth="1.5"
          fill="none"
          opacity="0.25"
        />
        <motion.path
          d="M8 32 Q24 8 40 32"
          stroke="#00B4FF" strokeWidth="2"
          fill="none"
          strokeDasharray="60"
          animate={{ strokeDashoffset: [60, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          opacity="0.60"
        />
        <motion.circle
          cx="24" cy="12" r="4"
          fill="#00B4FF"
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.circle
          cx="24" cy="12" r="6"
          stroke="#00B4FF" strokeWidth="1"
          fill="none"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <text x="24" y="16" textAnchor="middle" fontSize="8" fill="#00B4FF" opacity="0.80">0.85</text>
      </svg>
    );
  }

  // INTERPRET - Analysis brain/insight
  if (stage === 6) {
    return (
      <svg {...iconProps}>
        <circle cx="24" cy="20" r="10" stroke="#00B4FF" strokeWidth="1.2" opacity="0.35" />
        <path
          d="M18 20 Q20 16 24 16 Q28 16 30 20"
          stroke="#00B4FF" strokeWidth="1"
          fill="none"
          opacity="0.40"
        />
        <path
          d="M18 24 Q20 22 24 22 Q28 22 30 24"
          stroke="#00B4FF" strokeWidth="1"
          fill="none"
          opacity="0.40"
        />
        <motion.circle
          cx="24" cy="20" r="2"
          fill="#00B4FF"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.path
          d="M24 30 L24 36 M20 34 L24 30 L28 34"
          stroke="#00B4FF" strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ y: [0, -2, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      </svg>
    );
  }

  // RADAR - Live dashboard
  if (stage === 7) {
    return (
      <svg {...iconProps}>
        <circle cx="24" cy="24" r="16" stroke="#00B4FF" strokeWidth="1" opacity="0.25" />
        <circle cx="24" cy="24" r="10" stroke="#00B4FF" strokeWidth="1" opacity="0.30" />
        <circle cx="24" cy="24" r="4" stroke="#00B4FF" strokeWidth="1" opacity="0.40" />
        <motion.g
          style={{ transformOrigin: "24px 24px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <line x1="24" y1="24" x2="24" y2="8" stroke="#00B4FF" strokeWidth="1.5" opacity="0.70" />
        </motion.g>
        <circle cx="24" cy="24" r="2" fill="#00B4FF" opacity="0.90" />
        <motion.circle
          cx="30" cy="18" r="2"
          fill="#00B4FF"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.circle
          cx="18" cy="28" r="1.5"
          fill="#00B4FF"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <motion.circle
          cx="32" cy="30" r="1.5"
          fill="#00B4FF"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
      </svg>
    );
  }

  return null;
}

const STAGES = [
  {
    label: "TRACK",
    title: "Add Competitors",
    description: "Choose any competitor in your market. Add them to your watchlist in seconds.",
    detail: "Instant setup · No configuration required",
  },
  {
    label: "MONITOR",
    title: "Continuous Monitoring",
    description: "Metrivant watches their pricing pages, features, blog posts, and announcements 24/7.",
    detail: "Automated surveillance · Always current",
  },
  {
    label: "CAPTURE",
    title: "Record Changes",
    description: "Every page is captured and organized into sections for precise comparison over time.",
    detail: "Timestamped snapshots · Version history",
  },
  {
    label: "BASELINE",
    title: "Establish Normal",
    description: "The system learns what's normal for each competitor to filter out noise and focus on real changes.",
    detail: "Smart filtering · Reduces false alerts",
  },
  {
    label: "DETECT",
    title: "Spot Differences",
    description: "Changes are detected automatically — pricing shifts, new features, messaging updates.",
    detail: "Real-time detection · Evidence-backed",
  },
  {
    label: "CLASSIFY",
    title: "Score Importance",
    description: "Each change gets a confidence score and urgency rating so you focus on what matters.",
    detail: "Confidence scoring · Noise filtering",
  },
  {
    label: "INTERPRET",
    title: "Understand Why",
    description: "Analysis explains what changed, why it's significant, and what you should consider doing.",
    detail: "Strategic context · Recommended actions",
  },
  {
    label: "RADAR",
    title: "See Everything",
    description: "All competitor activity in one live radar view. Sorted by momentum. Updated in real-time.",
    detail: "Live dashboard · Instant visibility",
  },
];

export default function PipelineOverlayContent() {
  return (
    <div className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-4xl">
        {/* Intro */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3
            className="mb-4 text-[18px] font-bold uppercase tracking-[0.12em] text-white md:text-[20px]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            How Metrivant Works
          </h3>
          <p
            className="mx-auto max-w-2xl text-[14px] font-light leading-relaxed md:text-[15px]"
            style={{ color: "rgba(255,255,255,0.60)", letterSpacing: "0.01em" }}
          >
            From the moment you add a competitor to seeing strategic intelligence on your radar.
            Eight stages working automatically in the background.
          </p>
        </motion.div>

        {/* Pipeline Flow Visualization */}
        <div className="relative mb-16">
          {/* Vertical connection line */}
          <div
            className="absolute left-8 top-0 h-full w-px md:left-12"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,180,255,0.25) 0%, rgba(0,180,255,0.15) 50%, rgba(0,180,255,0.25) 100%)",
            }}
          />

          {/* Animated pulse along line */}
          <motion.div
            className="absolute left-8 w-px md:left-12"
            style={{
              background: "rgba(0,180,255,0.60)",
              filter: "blur(2px)",
              height: "40px",
            }}
            animate={{
              top: ["0%", "100%"],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Stages */}
          <div className="space-y-12">
            {STAGES.map((stage, index) => (
              <motion.div
                key={index}
                className="relative pl-24 md:pl-32"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
              >
                {/* Visual Icon + Node */}
                <div className="absolute left-0 top-0 flex flex-col items-center gap-2">
                  {/* Animated stage icon */}
                  <div className="flex h-16 w-16 items-center justify-center md:h-20 md:w-20">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(0,180,255,0.18) 0%, transparent 70%)",
                        filter: "blur(16px)",
                      }}
                    />
                    <div className="relative">
                      <StageIcon stage={index} />
                    </div>
                  </div>

                  {/* Number badge */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{
                      borderColor: "rgba(0,180,255,0.30)",
                      background: "rgba(0,180,255,0.08)",
                    }}
                  >
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: "rgba(0,180,255,0.70)" }}
                    >
                      {index + 1}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div>
                  {/* Label */}
                  <div
                    className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.20em]"
                    style={{
                      color: "rgba(0,180,255,0.60)",
                      fontFamily: "var(--font-orbitron)",
                    }}
                  >
                    {stage.label}
                  </div>

                  {/* Title */}
                  <h4
                    className="mb-2 text-[16px] font-bold text-white md:text-[18px]"
                    style={{ fontFamily: "var(--font-orbitron)", letterSpacing: "0.02em" }}
                  >
                    {stage.title}
                  </h4>

                  {/* Description */}
                  <p
                    className="mb-3 text-[13px] font-light leading-relaxed md:text-[14px]"
                    style={{ color: "rgba(255,255,255,0.65)", letterSpacing: "0.01em" }}
                  >
                    {stage.description}
                  </p>

                  {/* Detail */}
                  <div
                    className="text-[12px] font-medium md:text-[13px]"
                    style={{
                      color: "rgba(0,180,255,0.50)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {stage.detail}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <motion.div
          className="border-t border-[#0d1020] pt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p
            className="text-[12px] font-light leading-relaxed"
            style={{ color: "rgba(148,163,184,0.50)", letterSpacing: "0.01em" }}
          >
            Every signal traces back to a real change on a competitor's website.
            <br />
            Nothing is inferred. Everything is evidence-backed.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
