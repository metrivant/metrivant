"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { CompetitorSignal } from "../lib/api";
import { formatRelative } from "../lib/format";
import { createClient } from "../lib/supabase/client";

type ActivityItem = {
  key: string;
  sourceLabel: string;
  summary: string;
  timestamp: string;
  isAmbient: boolean;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  source_headline: string | null;
  detected_at: string;
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

function eventTypeToLabel(eventType: string): string {
  switch (eventType) {
    case "press_mention":    return "Press mention";
    case "announcement":     return "Announcement";
    case "hiring_activity":  return "Hiring activity";
    case "product_update":   return "Product update";
    case "messaging_update": return "Messaging change";
    case "content_update":   return "Content update";
    case "blog_post":        return "Blog post";
    case "page_change":      return "Content change";
    default:                 return "Activity";
  }
}

export default function ActivityTimeline({
  signals,
  loading,
  competitorId,
}: {
  signals: CompetitorSignal[];
  loading: boolean;
  competitorId?: string;
}) {
  const [ambientEvents, setAmbientEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!competitorId) {
      setAmbientEvents([]);
      return;
    }
    const supabase = createClient();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    supabase
      .from("activity_events")
      .select("id, event_type, source_headline, detected_at")
      .eq("competitor_id", competitorId)
      .gte("detected_at", since30d)
      .order("detected_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setAmbientEvents((data ?? []) as ActivityEvent[]);
      })
      .catch(() => { /* non-fatal — ambient events are supplemental */ });

    return () => { setAmbientEvents([]); };
  }, [competitorId]);

  const items = useMemo((): ActivityItem[] => {
    const result: ActivityItem[] = [];

    // Interpreted signals — primary intelligence
    for (const s of signals) {
      if (!s.detected_at) continue;
      result.push({
        key:         s.id,
        sourceLabel: pageTypeToActivityLabel(s.page_type),
        summary:     s.summary ?? "",
        timestamp:   s.detected_at,
        isAmbient:   false,
      });
    }

    // Ambient events — supplemental, only fill in when signals don't cover the window
    const signalTimestamps = new Set(result.map((r) => r.timestamp));
    for (const e of ambientEvents) {
      // Skip if we already have a signal at roughly the same time (within 1h)
      const eMs = new Date(e.detected_at).getTime();
      const isDuplicate = [...signalTimestamps].some(
        (ts) => Math.abs(new Date(ts).getTime() - eMs) < 60 * 60 * 1000
      );
      if (isDuplicate) continue;
      result.push({
        key:         `ae:${e.id}`,
        sourceLabel: eventTypeToLabel(e.event_type),
        summary:     e.source_headline ?? "",
        timestamp:   e.detected_at,
        isAmbient:   true,
      });
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return result.slice(0, 5);
  }, [signals, ambientEvents]);

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
              <div className="flex items-center gap-1.5">
                <div
                  className="text-[11px] font-medium"
                  style={{ color: item.isAmbient ? "rgba(148,163,184,0.55)" : "rgba(148,163,184,0.85)" }}
                >
                  {item.sourceLabel}
                </div>
                {item.isAmbient && (
                  <span
                    className="rounded-full px-1.5 py-[1px] text-[8px] uppercase tracking-[0.10em]"
                    style={{
                      background: "rgba(100,116,139,0.08)",
                      color: "rgba(100,116,139,0.45)",
                      border: "1px solid rgba(100,116,139,0.12)",
                    }}
                  >
                    ambient
                  </span>
                )}
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
