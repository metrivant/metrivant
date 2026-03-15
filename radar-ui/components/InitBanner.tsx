"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface InitData {
  seeded: number;
  attempted: number;
  failed: number;
  sector: string;
  custom: boolean;
}

export default function InitBanner() {
  const [data, setData]     = useState<InitData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("radar_init");
      if (!raw) return;
      sessionStorage.removeItem("radar_init");
      const parsed = JSON.parse(raw) as InitData;
      setData(parsed);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 12000);
      return () => clearTimeout(timer);
    } catch {
      // sessionStorage unavailable or malformed — silently skip
    }
  }, []);

  if (!data || !visible) return null;

  let line1: string;
  let line2: string;
  let isPartial = false;

  if (data.custom) {
    line1 = "Custom sector active.";
    line2 = "Add rivals from Discover to begin monitoring. Change sector anytime via the Sector control in the header.";
  } else if (data.failed > 0 && data.seeded === 0) {
    line1 = "Onboarding failed.";
    line2 = `All ${data.failed} rivals failed to initialize. Add them manually from Discover or switch sector to retry.`;
    isPartial = true;
  } else if (data.failed > 0) {
    line1 = `${data.seeded} of ${data.attempted} rivals added.`;
    line2 = `${data.failed} failed to onboard and were removed. The radar is now calibrating — first signals within the hour.`;
    isPartial = true;
  } else {
    line1 = `${data.seeded} rivals added.`;
    line2 = "Radar calibrating. The system is establishing baselines — first signals arrive within the hour.";
  }

  return (
    <div
      className="relative z-30 flex items-start justify-between gap-4 border-b border-[#0e2210] bg-[#020a02] px-5 py-3"
      style={{
        borderTopColor: isPartial ? "rgba(245,158,11,0.25)" : "rgba(46,230,166,0.18)",
        borderTopWidth: "1px",
        borderTopStyle: "solid",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div
          className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: isPartial ? "#f59e0b" : "#2EE6A6" }}
        />
        <div>
          <span
            className="text-[12px] font-semibold"
            style={{ color: isPartial ? "#f59e0b" : "#2EE6A6" }}
          >
            {line1}
          </span>
          {" "}
          <span className="text-[12px] text-slate-500">
            {line2}
          </span>
          {data.custom && (
            <>
              {" "}
              <Link
                href="/app/discover"
                className="text-[12px] text-[#2EE6A6] underline-offset-2 hover:underline"
              >
                Go to Discover →
              </Link>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setVisible(false)}
        className="shrink-0 text-[14px] leading-none text-slate-700 transition-colors hover:text-slate-400"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
