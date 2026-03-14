"use client";

import Link from "next/link";
import { capture } from "../lib/posthog";

type Props = {
  plan: string;
  trialDaysRemaining?: number | null;
};

export default function PlanBadge({ plan, trialDaysRemaining }: Props) {
  const isPro        = plan === "pro";
  const isUpgradable = plan === "analyst" || plan === "starter";
  const isTrial      = trialDaysRemaining != null;

  const trialLabel = isTrial
    ? trialDaysRemaining === 0
      ? "ends today"
      : trialDaysRemaining === 1
        ? "1d left"
        : `${trialDaysRemaining}d left`
    : null;

  // ── Pro ───────────────────────────────────────────────────────────────────
  if (isPro) {
    return (
      <Link
        href="/app/billing"
        onClick={() => capture("billing_opened", { source: "plan_badge" })}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%)",
          border: "1px solid rgba(245,158,11,0.28)",
          color: "#f59e0b",
          boxShadow: "0 0 16px rgba(245,158,11,0.06)",
        }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "#f59e0b", boxShadow: "0 0 5px rgba(245,158,11,0.80)" }}
        />
        <span className="tracking-[0.08em]">PRO</span>
      </Link>
    );
  }

  // ── Trial ─────────────────────────────────────────────────────────────────
  if (isTrial) {
    return (
      <Link
        href="/app/billing"
        onClick={() => {
          capture("billing_opened", { source: "plan_badge" });
          capture("upgrade_clicked", { source: "header" });
        }}
        className="group flex items-center gap-0 overflow-hidden rounded-full text-[11px] font-semibold transition-opacity hover:opacity-85"
        style={{
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(245,158,11,0.28)",
        }}
      >
        {/* Trial label */}
        <span
          className="flex items-center gap-1.5 px-3 py-1.5"
          style={{ color: "rgba(245,158,11,0.75)" }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse"
            style={{ background: "#f59e0b", boxShadow: "0 0 4px rgba(245,158,11,0.70)" }}
          />
          Trial
          {trialLabel && (
            <span className="text-[10px] font-normal" style={{ color: "rgba(245,158,11,0.50)" }}>
              · {trialLabel}
            </span>
          )}
        </span>
        {/* Upgrade CTA */}
        <span
          className="flex items-center gap-1 px-3 py-1.5 transition-colors group-hover:bg-[rgba(46,230,166,0.08)]"
          style={{
            borderLeft: "1px solid rgba(245,158,11,0.20)",
            color: "rgba(46,230,166,0.90)",
          }}
        >
          Upgrade
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1.5 6.5L6.5 1.5M6.5 1.5H3M6.5 1.5V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    );
  }

  // ── Analyst ───────────────────────────────────────────────────────────────
  if (isUpgradable) {
    return (
      <Link
        href="/app/billing"
        onClick={() => {
          capture("billing_opened", { source: "plan_badge" });
          capture("upgrade_clicked", { source: "header" });
        }}
        className="group flex items-center gap-0 overflow-hidden rounded-full text-[11px] font-semibold transition-opacity hover:opacity-85"
        style={{
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(46,230,166,0.16)",
        }}
      >
        {/* Plan label */}
        <span
          className="flex items-center gap-1.5 px-3 py-1.5"
          style={{ color: "rgba(148,163,184,0.70)" }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "rgba(100,116,139,0.50)" }}
          />
          Analyst
        </span>
        {/* Upgrade CTA */}
        <span
          className="flex items-center gap-1 px-3 py-1.5 transition-colors group-hover:bg-[rgba(46,230,166,0.07)]"
          style={{
            borderLeft: "1px solid rgba(46,230,166,0.12)",
            color: "rgba(46,230,166,0.80)",
          }}
        >
          Pro
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M4 6V2M2 4l2-2 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    );
  }

  return null;
}
