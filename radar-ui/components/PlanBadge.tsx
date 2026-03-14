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
      ? "Ends today"
      : trialDaysRemaining === 1
        ? "1d left"
        : `${trialDaysRemaining}d left`
    : null;

  // ── Pro — gold dot + "Pro" ────────────────────────────────────────────────
  if (isPro) {
    return (
      <Link
        href="/app/billing"
        onClick={() => capture("billing_opened", { source: "plan_badge" })}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-75"
        style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.05)", color: "#f59e0b" }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 5px #f59e0baa" }} />
        Pro
      </Link>
    );
  }

  // ── Trial — single pill: "Trial · Xd · Upgrade →" ────────────────────────
  if (isTrial) {
    return (
      <Link
        href="/app/billing"
        onClick={() => { capture("billing_opened", { source: "plan_badge" }); capture("upgrade_clicked", { source: "header" }); }}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.06)", color: "#f59e0b" }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 4px #f59e0baa" }} />
        Trial
        {trialLabel && <span style={{ opacity: 0.70 }}>· {trialLabel}</span>}
        <span className="ml-0.5 border-l pl-1.5" style={{ borderColor: "rgba(245,158,11,0.25)", color: "rgba(46,230,166,0.90)" }}>
          Upgrade →
        </span>
      </Link>
    );
  }

  // ── Analyst — single pill: "Analyst · Upgrade →" ─────────────────────────
  if (isUpgradable) {
    return (
      <Link
        href="/app/billing"
        onClick={() => { capture("billing_opened", { source: "plan_badge" }); capture("upgrade_clicked", { source: "header" }); }}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{ borderColor: "rgba(46,230,166,0.18)", background: "rgba(46,230,166,0.04)", color: "rgba(148,163,184,0.80)" }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(148,163,184,0.50)" }} />
        Analyst
        <span className="ml-0.5 border-l pl-1.5" style={{ borderColor: "rgba(46,230,166,0.18)", color: "rgba(46,230,166,0.85)" }}>
          Upgrade →
        </span>
      </Link>
    );
  }

  return null;
}
