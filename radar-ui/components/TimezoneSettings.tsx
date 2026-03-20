"use client";

import { useState, useEffect } from "react";

const TIMEZONE_OPTIONS = [
  { label: "UTC",   value: "UTC" },
  { label: "ET",    value: "America/New_York" },
  { label: "CT",    value: "America/Chicago" },
  { label: "MT",    value: "America/Denver" },
  { label: "PT",    value: "America/Los_Angeles" },
  { label: "GMT",   value: "Europe/London" },
  { label: "CET",   value: "Europe/Paris" },
  { label: "IST",   value: "Asia/Kolkata" },
  { label: "SGT",   value: "Asia/Singapore" },
  { label: "JST",   value: "Asia/Tokyo" },
  { label: "AEST",  value: "Australia/Sydney" },
];

const STORAGE_KEY = "mv_tz";

export default function TimezoneSettings() {
  const [tz, setTz]         = useState("UTC");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTz(saved);
      } else {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const match = TIMEZONE_OPTIONS.find((o) => o.value === browserTz);
        if (match) {
          setTz(match.value);
          localStorage.setItem(STORAGE_KEY, match.value);
        }
      }
    } catch {}
  }, []);

  function selectTz(value: string) {
    setTz(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  }

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {TIMEZONE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => selectTz(opt.value)}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition-colors ${
            tz === opt.value
              ? "border-[#00B4FF]/30 bg-[#0a0a1a] text-[#00B4FF]"
              : "border-[#0d1020] text-slate-600 hover:border-[#1a2030] hover:text-slate-400"
          }`}
        >
          <span className="font-medium tracking-[0.08em]">{opt.label}</span>
          {tz === opt.value && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#00B4FF]" />
          )}
        </button>
      ))}
    </div>
  );
}
