"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SubState } from "../lib/subscription";

type Props = {
  subState:   SubState;
  createdAt:  string;
  trialExpiredAt: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });
}

export default function ManageSubscriptionPanel({ subState, createdAt, trialExpiredAt }: Props) {
  const [open,       setOpen]       = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const { plan, status, currentPeriodEnd, stripeCustomerId } = subState;

  const isPro              = plan === "pro";
  const hasActiveSub       = status === "active" || status === "canceled_active" || status === "past_due";
  const canManageBilling   = !!stripeCustomerId;

  let statusLabel: string;
  let statusColor: string;
  if (status === "active") {
    statusLabel = isPro ? "Pro — Active" : "Analyst — Active";
    statusColor = "#2EE6A6";
  } else if (status === "canceled_active") {
    statusLabel = "Canceled — access until period end";
    statusColor = "#f59e0b";
  } else if (status === "past_due") {
    statusLabel = "Payment failed";
    statusColor = "#ef4444";
  } else if (status === "trial") {
    statusLabel = "Trial Active";
    statusColor = "#f59e0b";
  } else {
    statusLabel = "Trial Expired";
    statusColor = "#ef4444";
  }

  function close() {
    setOpen(false);
    setShowCancel(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#1a3020] bg-[#070d07] px-4 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-[#2a4a30] hover:text-slate-200"
      >
        Manage Subscription
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[200] bg-black/75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={close}
            />

            {/* Panel */}
            <motion.div
              className="fixed left-1/2 top-1/2 z-[201] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#1a3020] bg-[#060e06] p-7"
              style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.90), 0 0 0 1px rgba(46,230,166,0.05)" }}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {/* Accent line */}
              <div
                className="absolute inset-x-0 top-0 h-[1px] rounded-t-[20px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.32), transparent)" }}
              />

              {/* Close */}
              <button
                onClick={close}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition-colors hover:text-slate-400"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Title */}
              <div className="mb-5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
                Subscription Status
              </div>

              {/* Status indicator */}
              <div className="mb-5 flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}55` }}
                />
                <span className="text-[16px] font-semibold text-white">{statusLabel}</span>
              </div>

              {/* Details */}
              <div className="mb-6 space-y-3 border-t border-[#0e1e0e] pt-5">
                <div className="flex justify-between">
                  <span className="text-[12px] text-slate-600">Current plan</span>
                  <span className="text-[12px] font-medium text-slate-300">
                    {isPro ? "Pro — $19/mo" : "Analyst — $9/mo"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px] text-slate-600">Member since</span>
                  <span className="text-[12px] font-medium text-slate-300">{fmt(createdAt)}</span>
                </div>
                {!hasActiveSub && (
                  <div className="flex justify-between">
                    <span className="text-[12px] text-slate-600">
                      {status === "trial" ? "Trial expires" : "Trial expired"}
                    </span>
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: status === "trial" ? "#f59e0b" : "#ef4444" }}
                    >
                      {fmt(trialExpiredAt)}
                    </span>
                  </div>
                )}
                {hasActiveSub && currentPeriodEnd && (
                  <div className="flex justify-between">
                    <span className="text-[12px] text-slate-600">
                      {status === "canceled_active" ? "Access until" : "Next renewal"}
                    </span>
                    <span className="text-[12px] font-medium text-slate-300">
                      {fmt(currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              {!hasActiveSub && (
                <form action="/api/stripe/checkout" method="POST" className="mb-3">
                  <input type="hidden" name="plan" value="pro" />
                  <button
                    type="submit"
                    className="block w-full rounded-full bg-[#2EE6A6] py-2.5 text-center text-[13px] font-bold text-black transition-opacity hover:opacity-90"
                  >
                    Upgrade to Pro
                  </button>
                </form>
              )}

              {canManageBilling && (
                <form action="/api/stripe/portal" method="POST" className="mb-3">
                  <button
                    type="submit"
                    className="block w-full rounded-full border border-[#1a3020] py-2.5 text-center text-[13px] font-medium text-slate-400 transition-colors hover:border-[#2a4a30] hover:text-slate-200"
                  >
                    Open billing portal →
                  </button>
                </form>
              )}

              {/* Cancel — for paying users: open portal; for others: email */}
              {!showCancel ? (
                <button
                  onClick={() => setShowCancel(true)}
                  className="block w-full text-center text-[11px] text-slate-600 transition-colors hover:text-slate-400"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="rounded-[12px] border border-[#1e1010] bg-[#030803] p-4">
                  <div
                    className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(239,68,68,0.65)" }}
                  >
                    Cancel Subscription
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                    No refunds. Access continues until end of billing period.
                  </p>
                  {canManageBilling ? (
                    <form action="/api/stripe/portal" method="POST">
                      <button
                        type="submit"
                        className="block w-full rounded-full border border-[#2a1010] py-2 text-center text-[11px] text-slate-500 transition-colors hover:border-red-900/40 hover:text-red-400"
                      >
                        Manage cancellation in billing portal
                      </button>
                    </form>
                  ) : (
                    <a
                      href="mailto:billing@metrivant.com?subject=Cancel%20Subscription"
                      className="block rounded-full border border-[#2a1010] py-2 text-center text-[11px] text-slate-500 transition-colors hover:border-red-900/40 hover:text-red-400"
                    >
                      Email billing@metrivant.com to cancel
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
