"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { capture } from "../lib/posthog";

// Shows after TRIGGER_DELAY_MS of continuous dashboard use — Analyst plan only.
// Dismissed state persists for the entire browser session via sessionStorage.
// Never shown to Pro users.
const TRIGGER_DELAY_MS = 60_000; // 60 seconds
const SESSION_KEY = "upgrade_prompt_dismissed";

export default function UpgradePrompt({ plan }: { plan: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (plan !== "analyst" && plan !== "starter") return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") return;

    const timer = setTimeout(() => {
      setVisible(true);
      capture("upgrade_prompt_seen", { plan, trigger: "time_60s" });
    }, TRIGGER_DELAY_MS);

    return () => clearTimeout(timer);
  // Run once — plan never changes within a session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    setVisible(false);
  }

  function handleUpgradeClick() {
    capture("upgrade_clicked", { source: "timed_prompt", plan });
    handleDismiss();
  }

  if (plan !== "analyst" && plan !== "starter") return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50 w-[280px]"
          role="dialog"
          aria-label="Upgrade to Metrivant Pro"
        >
          <div
            className="relative overflow-hidden rounded-[18px] border border-[#1a3020] p-5"
            style={{
              background: "rgba(2,8,2,0.98)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.05)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(46,230,166,0.40), transparent)",
              }}
            />

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full text-slate-700 transition-colors hover:text-slate-400"
              aria-label="Dismiss"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>

            {/* Content */}
            <div className="mb-4 pr-5">
              <div
                className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.28em]"
                style={{ color: "rgba(46,230,166,0.65)" }}
              >
                Metrivant Pro
              </div>
              <div className="text-[15px] font-semibold leading-snug text-white">
                Monitor 25 competitors in real time
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                Upgrade for live signal alerts, 90-day history, and strategic
                movement analysis.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                onClick={handleUpgradeClick}
                className="flex-1 rounded-full bg-[#2EE6A6] py-2 text-center text-[12px] font-bold text-black transition-opacity hover:opacity-90"
              >
                See plans
              </Link>
              <button
                onClick={handleDismiss}
                className="rounded-full border border-[#1e3020] px-3 py-2 text-[12px] text-slate-600 transition-colors hover:text-slate-400"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
