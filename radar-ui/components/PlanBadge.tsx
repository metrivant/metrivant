"use client";

import Link from "next/link";
import { capture } from "../lib/posthog";

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  // "starter" is a legacy key — treated identically to "analyst".
  analyst: { label: "Analyst", color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "#1e2e22" },
  starter: { label: "Analyst", color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "#1e2e22" },
  pro:     { label: "Pro",     color: "#2EE6A6", bg: "rgba(46,230,166,0.06)",  border: "rgba(46,230,166,0.22)" },
};

export default function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.analyst;
  const isUpgradable = plan === "analyst" || plan === "starter";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/app/billing"
        onClick={() => capture("billing_opened", { source: "plan_badge" })}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-opacity hover:opacity-75"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: cfg.color, boxShadow: `0 0 4px ${cfg.color}88` }}
        />
        {cfg.label}
      </Link>

      {isUpgradable && (
        <Link
          href="/pricing"
          onClick={() => capture("upgrade_clicked", { source: "header" })}
          className="rounded-full border border-[#2EE6A6]/20 bg-[#2EE6A6]/5 px-3 py-1.5 text-[11px] font-semibold text-[#2EE6A6]/80 transition-opacity hover:text-[#2EE6A6] hover:opacity-90"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
