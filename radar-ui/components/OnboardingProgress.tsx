"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type OnboardingStatus = {
  stage: "seeding" | "onboarding" | "monitoring" | "ready";
  tracked: number;
  onboarded: number;
  pages_created: number;
  snapshots_captured: number;
  baselines_built: number;
  signals_detected: number;
  oldest_competitor_age_minutes: number | null;
};

export default function OnboardingProgress() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/onboarding-status");
        if (!res.ok) {
          if (mounted) setError(true);
          return;
        }
        const data = await res.json() as OnboardingStatus;
        if (mounted) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      }
    }

    // Fetch immediately
    void fetchStatus();

    // Poll every 10 seconds
    intervalId = setInterval(() => {
      void fetchStatus();
    }, 10000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Fallback: no data yet or error
  if (error || !status) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
          Calibrating
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
          Pipeline running · establishing baselines · first signals within the hour
        </p>
      </div>
    );
  }

  // Calculate progress percentages
  const pagesProgress = status.pages_created > 0 ? 100 : 0;
  const snapshotsProgress = status.snapshots_captured > 0
    ? Math.min(100, (status.snapshots_captured / Math.max(1, status.pages_created)) * 100)
    : 0;
  const baselinesProgress = status.baselines_built > 0
    ? Math.min(100, (status.baselines_built / Math.max(1, status.pages_created)) * 15)
    : 0;
  const signalsProgress = status.signals_detected > 0 ? 100 : 0;

  // Estimate time to first signal based on age
  const ageMinutes = status.oldest_competitor_age_minutes ?? 0;
  const estimatedMinutes = Math.max(0, 60 - ageMinutes); // Rough estimate: 60 min total
  const estimatedText =
    estimatedMinutes < 5
      ? "arriving soon"
      : estimatedMinutes < 30
      ? `est. ${Math.round(estimatedMinutes / 5) * 5} min`
      : "est. 30-60 min";

  const stages = [
    {
      label: "Monitoring",
      count: status.pages_created,
      total: status.pages_created,
      progress: pagesProgress,
      active: pagesProgress > 0,
    },
    {
      label: "Capturing",
      count: status.snapshots_captured,
      total: status.pages_created,
      progress: snapshotsProgress,
      active: snapshotsProgress > 0,
    },
    {
      label: "Baselining",
      count: status.baselines_built,
      total: null, // No fixed total for baselines
      progress: baselinesProgress,
      active: baselinesProgress > 0,
    },
    {
      label: "Detecting",
      count: status.signals_detected,
      total: null,
      progress: signalsProgress,
      active: signalsProgress > 0,
    },
  ];

  return (
    <motion.div
      className="flex flex-col items-center py-8 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600 mb-4">
        Pipeline Active
      </div>

      <div className="w-full max-w-md space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative">
            {/* Stage label */}
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span
                className="font-medium uppercase tracking-[0.12em]"
                style={{
                  color: stage.active ? "rgba(0,180,255,0.70)" : "rgba(100,116,139,0.50)",
                }}
              >
                {stage.label}
              </span>
              <span className="text-slate-600">
                {stage.total !== null
                  ? `${stage.count}/${stage.total}`
                  : stage.count > 0
                  ? `${stage.count}`
                  : "—"}
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="relative h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(0,180,255,0.08)" }}
            >
              <AnimatePresence>
                {stage.progress > 0 && (
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: "rgba(0,180,255,0.60)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.progress}%` }}
                    exit={{ width: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Estimated time */}
      <p className="mt-6 text-[12px] leading-relaxed text-slate-600">
        First signal {estimatedText}
      </p>
    </motion.div>
  );
}
