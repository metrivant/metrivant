"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CompetitorSignal } from "../lib/api";
import { formatRelative } from "../lib/format";

type ActivityItem = {
  key: string;
  sourceLabel: string;
  summary: string;
  timestamp: string;
};

function pageTypeToActivityLabel(pageType: string): string {
  switch (pageType) {
    case "blog":                return "Blog update";
    case "release_feed":
    case "changelog":           return "Changelog update";
    case "pricing_plans":
    case "pricing":             return "Pricing update";
    case "features":
    case "feature_page":        return "Feature update";
    case "press":
    case "press_release":       return "Press release";
    case "careers":
    case "hiring":              return "Hiring activity";
    case "github":
    case "releases":            return "GitHub release";
    case "social":              return "Social post";
    default:                    return "Content update";
  }
}

export default function ActivityTimeline({
  signals,
  loading,
}: {
  signals: CompetitorSignal[];
  loading: boolean;
}) {
  const items = useMemo((): ActivityItem[] => {
    if (!signals.length) return [];
    const mapped: ActivityItem[] = signals
      .filter((s) => s.detected_at)
      .map((s) => ({
        key:         s.id,
        sourceLabel: pageTypeToActivityLabel(s.page_type),
        summary:     s.summary ?? "",
        timestamp:   s.detected_at,
      }));
    mapped.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return mapped.slice(0, 5);
  }, [signals]);

  if (loading) {
    return (
      <div className="mt-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600">
          Recent Activity
        </div>
        <div className="space-y-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-[10px] bg-[#060b06]" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          Recent Activity
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{
            background: "rgba(46,230,166,0.05)",
            color:      "rgba(46,230,166,0.40)",
            border:     "1px solid rgba(46,230,166,0.10)",
          }}
        >
          Activity Echo
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: "easeOut", delay: i * 0.05 }}
            className="flex items-center justify-between rounded-[10px] border border-[#0d1a0d] bg-[#040804] px-3.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-slate-400">
                {item.sourceLabel}
              </div>
              {item.summary && (
                <div className="mt-0.5 truncate text-[10px] text-slate-600">
                  {item.summary}
                </div>
              )}
            </div>
            <div className="ml-3 shrink-0 text-[10px] tabular-nums text-slate-600">
              {formatRelative(item.timestamp)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
