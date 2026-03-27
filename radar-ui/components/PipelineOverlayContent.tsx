"use client";

import { motion } from "framer-motion";

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
                className="relative pl-20 md:pl-28"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
              >
                {/* Node */}
                <div className="absolute left-0 top-2 flex h-16 w-16 items-center justify-center md:left-0 md:h-24 md:w-24">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(0,180,255,0.15) 0%, transparent 70%)",
                      filter: "blur(12px)",
                    }}
                  />
                  <div
                    className="relative flex h-12 w-12 items-center justify-center rounded-full border md:h-16 md:w-16"
                    style={{
                      borderColor: "rgba(0,180,255,0.35)",
                      background:
                        "linear-gradient(135deg, rgba(0,180,255,0.10) 0%, rgba(0,180,255,0.05) 100%)",
                      boxShadow: "0 0 20px rgba(0,180,255,0.12)",
                    }}
                  >
                    <span
                      className="text-[18px] font-bold md:text-[22px]"
                      style={{ color: "rgba(0,180,255,0.80)" }}
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
