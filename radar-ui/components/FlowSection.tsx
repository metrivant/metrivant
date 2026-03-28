"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useRef } from "react";

type SectorId = "saas" | "fintech" | "cybersecurity" | "defense" | "energy";

const SECTORS = [
  { id: "saas" as SectorId, label: "SaaS & AI", icon: "⚡", color: "#00B4FF" },
  { id: "fintech" as SectorId, label: "Fintech", icon: "💰", color: "#10B981" },
  { id: "cybersecurity" as SectorId, label: "Cybersecurity", icon: "🔒", color: "#8B5CF6" },
  { id: "defense" as SectorId, label: "Defense", icon: "🛡️", color: "#F59E0B" },
  { id: "energy" as SectorId, label: "Energy", icon: "⚡", color: "#EF4444" },
];

const SECTOR_CONFIG = {
  saas: {
    topSignals: ["feature_launch", "price_point_change", "major_release"],
    topPools: ["product", "newsroom", "careers"],
    amplification: "Product velocity",
  },
  fintech: {
    topSignals: ["regulatory_event", "acquisition", "earnings_release"],
    topPools: ["regulatory", "investor", "product"],
    amplification: "Compliance signals",
  },
  cybersecurity: {
    topSignals: ["feature_launch", "regulatory_event", "product_update"],
    topPools: ["product", "newsroom", "regulatory"],
    amplification: "Security features",
  },
  defense: {
    topSignals: ["major_contract_award", "acquisition", "regulatory_event"],
    topPools: ["procurement", "newsroom", "regulatory"],
    amplification: "Contract awards",
  },
  energy: {
    topSignals: ["earnings_release", "major_contract_award", "regulatory_event"],
    topPools: ["investor", "regulatory", "newsroom"],
    amplification: "Material events",
  },
};

const PIPELINE_STAGES = [
  { id: "competitors", label: "Competitors", icon: "◆", amplified: false },
  { id: "pages", label: "Monitored Pages", icon: "◇", amplified: false },
  { id: "snapshots", label: "Snapshots", icon: "□", amplified: false },
  { id: "sections", label: "Sections", icon: "▭", amplified: false },
  { id: "baselines", label: "Baselines", icon: "▬", amplified: false },
  { id: "diffs", label: "Diffs", icon: "≟", amplified: false },
  { id: "signals", label: "Signals", icon: "◉", amplified: true },
  { id: "interpretations", label: "AI Analysis", icon: "◎", amplified: true },
  { id: "movements", label: "Movements", icon: "◈", amplified: true },
  { id: "radar", label: "Intelligence", icon: "⬢", amplified: false },
];

export default function FlowSection() {
  const [selectedSector, setSelectedSector] = useState<SectorId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  // Always target the section container, not the conditionally-rendered pipeline div
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const sector = SECTORS.find((s) => s.id === selectedSector);
  const config = selectedSector ? SECTOR_CONFIG[selectedSector] : null;

  // Pre-compute all transform values - all hooks MUST be called at top level (Rules of Hooks)
  // Cannot use .map() or any loops - must explicitly call each hook
  const progress0 = useTransform(scrollYProgress, [0 * 0.08, 1 * 0.08], [0, 1]);
  const progress1 = useTransform(scrollYProgress, [1 * 0.08, 2 * 0.08], [0, 1]);
  const progress2 = useTransform(scrollYProgress, [2 * 0.08, 3 * 0.08], [0, 1]);
  const progress3 = useTransform(scrollYProgress, [3 * 0.08, 4 * 0.08], [0, 1]);
  const progress4 = useTransform(scrollYProgress, [4 * 0.08, 5 * 0.08], [0, 1]);
  const progress5 = useTransform(scrollYProgress, [5 * 0.08, 6 * 0.08], [0, 1]);
  const progress6 = useTransform(scrollYProgress, [6 * 0.08, 7 * 0.08], [0, 1]);
  const progress7 = useTransform(scrollYProgress, [7 * 0.08, 8 * 0.08], [0, 1]);
  const progress8 = useTransform(scrollYProgress, [8 * 0.08, 9 * 0.08], [0, 1]);
  const progress9 = useTransform(scrollYProgress, [9 * 0.08, 10 * 0.08], [0, 1]);

  const opacity0 = useTransform(progress0, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity1 = useTransform(progress1, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity2 = useTransform(progress2, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity3 = useTransform(progress3, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity4 = useTransform(progress4, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity5 = useTransform(progress5, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity6 = useTransform(progress6, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity7 = useTransform(progress7, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity8 = useTransform(progress8, [0, 0.5, 1], [0.3, 0.8, 1]);
  const opacity9 = useTransform(progress9, [0, 0.5, 1], [0.3, 0.8, 1]);

  const x0 = useTransform(progress0, [0, 1], [-20, 0]);
  const x1 = useTransform(progress1, [0, 1], [-20, 0]);
  const x2 = useTransform(progress2, [0, 1], [-20, 0]);
  const x3 = useTransform(progress3, [0, 1], [-20, 0]);
  const x4 = useTransform(progress4, [0, 1], [-20, 0]);
  const x5 = useTransform(progress5, [0, 1], [-20, 0]);
  const x6 = useTransform(progress6, [0, 1], [-20, 0]);
  const x7 = useTransform(progress7, [0, 1], [-20, 0]);
  const x8 = useTransform(progress8, [0, 1], [-20, 0]);
  const x9 = useTransform(progress9, [0, 1], [-20, 0]);

  const stageTransforms = [
    { opacity: opacity0, x: x0 },
    { opacity: opacity1, x: x1 },
    { opacity: opacity2, x: x2 },
    { opacity: opacity3, x: x3 },
    { opacity: opacity4, x: x4 },
    { opacity: opacity5, x: x5 },
    { opacity: opacity6, x: x6 },
    { opacity: opacity7, x: x7 },
    { opacity: opacity8, x: x8 },
    { opacity: opacity9, x: x9 },
  ];

  return (
    <section ref={containerRef} className="relative border-t border-[#0d1020] px-6 py-20 md:py-32">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div
            className="mb-2 text-[9px] font-bold uppercase tracking-[0.28em]"
            style={{ color: "rgba(0,180,255,0.50)", fontFamily: "var(--font-orbitron)" }}
          >
            How it works
          </div>
          <h2
            className="text-[22px] font-light tracking-tight text-white md:text-[28px]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Sector-Aware Intelligence Pipeline
          </h2>
          <p className="mt-3 text-[12px] text-slate-500">
            Select your market to see how signals are amplified
          </p>
        </div>

        {/* Sector Selection */}
        <div className="mb-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {SECTORS.map((s, i) => {
              const isSelected = selectedSector === s.id;
              return (
                <motion.button
                  key={s.id}
                  onClick={() => setSelectedSector(s.id)}
                  className="group relative overflow-hidden rounded-lg border px-4 py-6 text-center transition-all"
                  style={{
                    borderColor: isSelected ? s.color : "rgba(0,180,255,0.15)",
                    background: isSelected ? s.color + "10" : "rgba(0,180,255,0.02)",
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(to bottom, ${s.color}20, transparent)` }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}

                  <div className="relative mb-2 text-[28px]">{s.icon}</div>

                  <div
                    className="relative text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: isSelected ? s.color : "rgba(255,255,255,0.60)" }}
                  >
                    {s.label}
                  </div>

                  {isSelected && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: s.color }}
                      layoutId="sector-indicator"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Pipeline Visualization */}
        {selectedSector && (
          <motion.div
            ref={pipelineRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative min-h-[800px]"
          >
            <div className="mb-12 text-center">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
                Pipeline Flow · {sector?.label}
              </div>
              <div className="text-[13px] font-light text-slate-400">
                Amplifying <span style={{ color: sector?.color }}>{config?.amplification}</span>
              </div>
            </div>

            <div className="relative space-y-4">
              {PIPELINE_STAGES.map((stage, i) => {
                const { opacity, x } = stageTransforms[i];
                const connectorBg = stage.amplified ? sector?.color + "40" : "rgba(100,116,139,0.20)";
                const iconBorderColor = stage.amplified ? sector?.color : "rgba(100,116,139,0.25)";
                const iconBg = stage.amplified ? sector?.color + "15" : "rgba(0,0,0,0.50)";
                const iconColor = stage.amplified ? sector?.color : "rgba(100,116,139,0.60)";
                const labelColor = sector?.color + "90";

                return (
                  <div key={stage.id} className="relative">
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div
                        className="absolute left-[18px] top-[44px] h-[52px] w-px"
                        style={{ background: connectorBg }}
                      />
                    )}

                    <motion.div style={{ opacity, x }} className="flex items-start gap-4 py-2">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border font-mono text-[16px]"
                        style={{
                          borderColor: iconBorderColor,
                          background: iconBg,
                          color: iconColor,
                        }}
                      >
                        {stage.icon}
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-between py-1">
                        <div>
                          <div className="font-mono text-[13px] font-medium text-white">
                            {stage.label}
                          </div>
                          {stage.amplified && (
                            <div
                              className="mt-0.5 font-mono text-[9px] tracking-wide"
                              style={{ color: labelColor }}
                            >
                              Sector-weighted
                            </div>
                          )}
                        </div>

                        {stage.amplified && (
                          <motion.div
                            className="flex items-center gap-2"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                          >
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-900">
                              <motion.div
                                className="h-full"
                                style={{ background: sector?.color }}
                                initial={{ width: "0%" }}
                                animate={{ width: "75%" }}
                                transition={{ duration: 0.8, delay: 0.3 }}
                              />
                            </div>
                            <div
                              className="font-mono text-[11px] font-bold tabular-nums"
                              style={{ color: sector?.color }}
                            >
                              2.0×
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-16 grid gap-8 md:grid-cols-2"
            >
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-5">
                <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Top Signals
                </div>
                <div className="space-y-3">
                  {config?.topSignals.map((signal) => (
                    <div
                      key={signal}
                      className="flex items-center justify-between border-l-2 px-4 py-2.5"
                      style={{ borderColor: sector?.color }}
                    >
                      <div className="font-mono text-[11px] text-slate-400">
                        {signal.replace(/_/g, " ")}
                      </div>
                      <div className="font-mono text-[11px] font-bold" style={{ color: sector?.color }}>
                        2.0×
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-5">
                <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
                  Priority Pools
                </div>
                <div className="space-y-3">
                  {config?.topPools.map((pool) => (
                    <div
                      key={pool}
                      className="flex items-center justify-between border-l-2 px-4 py-2.5"
                      style={{ borderColor: sector?.color }}
                    >
                      <div className="font-mono text-[11px] text-slate-400">{pool}</div>
                      <div className="font-mono text-[11px] font-bold" style={{ color: sector?.color }}>
                        8.0×
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="mt-8 border-t border-slate-900 pt-6 text-center">
              <div className="font-mono text-[10px] text-slate-700">
                Pipeline runs deterministically · Sector weighting amplifies{" "}
                <span style={{ color: sector?.color }}>{sector?.label}</span>-critical signals
              </div>
            </div>
          </motion.div>
        )}

        {!selectedSector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
            <div className="mb-4 text-[48px] opacity-20">↑</div>
            <div className="font-mono text-[11px] text-slate-600">
              Select a sector to visualize the pipeline
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
