"use client";

import Link from "next/link";
import { capture } from "../lib/posthog";

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  // "starter" is a legacy key — treated identically to "analyst".
  analyst: { label: "Analyst", color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "#1e2e22" },
  starter: { label: "Analyst", color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "#1e2e22" },
  pro:     { label: "Pro",     color: "#2EE6A6", bg: "rgba(46,230,166,0.06)",  border: "rgba(46,230,166,0.22)" },
};

type Props = {
  plan:                string;
  // Days remaining in trial. Non-null only when status === "trial".
  trialDaysRemaining?: number | null;
};

export default function PlanBadge({ plan, trialDaysRemaining }: Props) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.analyst;
  const isUpgradable = plan === "analyst" || plan === "starter";

  const isTrial = trialDaysRemaining != null;

  // Trial label: "1 day left" / "2 days left" / "Trial"
  const trialLabel = isTrial
    ? trialDaysRemaining === 0
      ? "Ends today"
      : trialDaysRemaining === 1
        ? "1 day left"
        : `${trialDaysRemaining}d left`
    : null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/app/billing"
        onClick={() => capture("billing_opened", { source: "plan_badge" })}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-opacity hover:opacity-75"
        style={{ backgroundColor: cfg.bg, borderColor: isTrial ? "rgba(251,191,36,0.28)" : cfg.border, color: isTrial ? "#f59e0b" : cfg.color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: isTrial ? "#f59e0b" : cfg.color,
            boxShadow: `0 0 4px ${isTrial ? "#f59e0b" : cfg.color}88`,
          }}
        />
        {isTrial ? (
          <>Trial{trialLabel ? <span className="ml-1 opacity-75">· {trialLabel}</span> : null}</>
        ) : (
          cfg.label
        )}
      </Link>

      {isUpgradable && (
        <Link
          href="/app/billing"
          onClick={() => capture("upgrade_clicked", { source: "header" })}
          className="rounded-full border border-[#2EE6A6]/20 bg-[#2EE6A6]/5 px-3 py-1.5 text-[11px] font-semibold text-[#2EE6A6]/80 transition-opacity hover:text-[#2EE6A6] hover:opacity-90"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
