"use client";

import { motion } from "framer-motion";

const STAGES = [
  {
    label: "TRACK",
    title: "Competitor Registration",
    description: "Register any competitor for continuous monitoring across your market sector.",
    technical: "competitors table → monitored_pages initialization",
  },
  {
    label: "MONITOR",
    title: "Page Surveillance",
    description: "Automated fetching of key pages — pricing, features, changelog, newsroom, careers.",
    technical: "Cron-based snapshot creation per page_class (ambient/standard/high_value)",
  },
  {
    label: "CAPTURE",
    title: "Content Extraction",
    description: "Page content is segmented into logical sections for granular comparison.",
    technical: "snapshots → page_sections (CSS selector-based extraction)",
  },
  {
    label: "BASELINE",
    title: "Reference Anchoring",
    description: "Establish stable baseline state for each section to reduce noise from transient changes.",
    technical: "section_baselines (insert-only anchor, never overwritten)",
  },
  {
    label: "DETECT",
    title: "Change Detection",
    description: "Compute differences between current content and baseline to surface actual shifts.",
    technical: "section_diffs (batch-loaded, no N+1 queries)",
  },
  {
    label: "CLASSIFY",
    title: "Signal Classification",
    description: "Assign signal type, confidence score (0-1), urgency (1-5). Filter noise from signal.",
    technical: "signals (confidence-gated, signal_hash deduped, relevance pre-classification)",
  },
  {
    label: "INTERPRET",
    title: "Intelligence Analysis",
    description: "GPT-4o validates and interprets signals, providing strategic context and implications.",
    technical: "interpretations + strategic_movements (AI-grounded narrative synthesis)",
  },
  {
    label: "RADAR",
    title: "Live Intelligence Feed",
    description: "Aggregated view of all competitor movements, momentum scores, and strategic patterns.",
    technical: "radar_feed view → UI (top 50 by momentum, real-time subscription)",
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
            Deterministic Pipeline Architecture
          </h3>
          <p
            className="mx-auto max-w-2xl text-[14px] font-light leading-relaxed md:text-[15px]"
            style={{ color: "rgba(255,255,255,0.60)", letterSpacing: "0.01em" }}
          >
            Eight sequential stages transform competitor page changes into strategic intelligence.
            Every output is evidence-grounded. No inference without observation.
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

                  {/* Technical detail */}
                  <div
                    className="inline-block rounded border px-3 py-1.5"
                    style={{
                      borderColor: "rgba(0,180,255,0.15)",
                      background: "rgba(0,180,255,0.03)",
                    }}
                  >
                    <code
                      className="text-[11px] md:text-[12px]"
                      style={{
                        color: "rgba(0,180,255,0.55)",
                        fontFamily: "var(--font-geist-mono)",
                      }}
                    >
                      {stage.technical}
                    </code>
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
            Supabase is the state machine. Vercel runtime stages are stateless execution layers.
            <br />
            Every stage has defined inputs, transformation, and outputs. No speculation without evidence.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
