"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type TestResult = {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  ms: number;
};

type TestSection = {
  section: string;
  tests: TestResult[];
};

type TestResponse = {
  ok: boolean;
  timestamp: string;
  duration_ms: number;
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    skip: number;
  };
  sections: TestSection[];
};

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pass: "#2EE6A6",
  fail: "#ef4444",
  warn: "#f59e0b",
  skip: "#64748b",
};

const STATUS_ICONS: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  warn: "!",
  skip: "—",
};

function sectionSummary(tests: TestResult[]): { color: string; label: string } {
  const fails = tests.filter(t => t.status === "fail").length;
  const warns = tests.filter(t => t.status === "warn").length;
  if (fails > 0) return { color: "#ef4444", label: `${fails} fail` };
  if (warns > 0) return { color: "#f59e0b", label: `${warns} warn` };
  return { color: "#2EE6A6", label: "all pass" };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SystemTests() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  async function runTests() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/system-tests", {
        headers: { Authorization: `Bearer ${window.__CRON_SECRET ?? ""}` },
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`HTTP ${res.status}: ${text}`);
        return;
      }
      const data: TestResponse = await res.json();
      setResult(data);
      // Auto-expand sections with failures
      const failedSections = new Set(
        data.sections
          .filter(s => s.tests.some(t => t.status === "fail" || t.status === "warn"))
          .map(s => s.section)
      );
      setExpandedSections(failedSections);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function expandAll() {
    if (result) setExpandedSections(new Set(result.sections.map(s => s.section)));
  }
  function collapseAll() {
    setExpandedSections(new Set());
  }

  return (
    <div>
      {/* ── Run button ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={runTests}
          disabled={loading}
          className="group relative flex items-center gap-3 rounded-[12px] border px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-all duration-300"
          style={{
            borderColor: loading ? "rgba(0,180,255,0.35)" : "#0e1e0e",
            background: loading
              ? "linear-gradient(135deg, rgba(0,180,255,0.08) 0%, rgba(2,8,2,0.95) 60%)"
              : "rgba(2,8,2,0.80)",
            color: loading ? "#00B4FF" : "rgba(148,163,184,0.6)",
            boxShadow: loading ? "0 0 20px rgba(0,180,255,0.12)" : "none",
          }}
        >
          {loading ? (
            <>
              <span
                className="h-2 w-2 animate-pulse rounded-full"
                style={{ backgroundColor: "#00B4FF", boxShadow: "0 0 8px #00B4FF" }}
              />
              Running tests...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 2L12 7L3 12V2Z" fill="currentColor" fillOpacity="0.6" />
              </svg>
              Run System Tests
            </>
          )}
        </button>

        {result && (
          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                color: result.ok ? "#2EE6A6" : "#ef4444",
                background: result.ok ? "rgba(46,230,166,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${result.ok ? "rgba(46,230,166,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: result.ok ? "#2EE6A6" : "#ef4444",
                  boxShadow: `0 0 5px ${result.ok ? "#2EE6A6" : "#ef4444"}`,
                }}
              />
              {result.ok ? "All Pass" : `${result.summary.fail} Failed`}
            </span>
            <span className="font-mono text-[10px] text-slate-700">
              {result.summary.pass}✓ {result.summary.warn}! {result.summary.fail}✗ {result.summary.skip}— · {(result.duration_ms / 1000).toFixed(1)}s
            </span>
            <button
              onClick={expandAll}
              className="font-mono text-[10px] text-slate-600 transition-colors hover:text-slate-400"
            >
              expand all
            </button>
            <button
              onClick={collapseAll}
              className="font-mono text-[10px] text-slate-600 transition-colors hover:text-slate-400"
            >
              collapse
            </button>
          </div>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 rounded-[12px] border border-red-500/20 bg-[#020208] px-4 py-3">
          <span className="font-mono text-[11px] text-red-400">{error}</span>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {result && (
        <div className="mt-6 flex flex-col gap-3">
          {result.sections.map(section => {
            const { color, label } = sectionSummary(section.tests);
            const expanded = expandedSections.has(section.section);
            const passCount = section.tests.filter(t => t.status === "pass").length;

            return (
              <div key={section.section} className="rounded-[14px] border border-[#0d1020] bg-[#020208]">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.section)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#03030c]"
                >
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    className="shrink-0 transition-transform duration-200"
                    style={{ transform: expanded ? "rotate(90deg)" : "rotate(0)" }}
                    aria-hidden
                  >
                    <path d="M3 1L8 5L3 9" stroke="rgba(148,163,184,0.4)" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-semibold tracking-[0.02em] text-white" style={{ fontFamily: "var(--font-orbitron)" }}>
                    {section.section}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="font-mono text-[10px] text-slate-700">
                      {passCount}/{section.tests.length}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        color,
                        backgroundColor: `${color}15`,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {label}
                    </span>
                  </span>
                </button>

                {/* Test rows */}
                {expanded && (
                  <div className="border-t border-[#0d1020] px-4 py-2">
                    {section.tests.map((test, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 border-b border-[#0d1020] py-1.5 last:border-b-0"
                      >
                        <span
                          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold"
                          style={{
                            color: STATUS_COLORS[test.status],
                            backgroundColor: `${STATUS_COLORS[test.status]}12`,
                          }}
                        >
                          {STATUS_ICONS[test.status]}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">
                          {test.name}
                        </span>
                        <span className="shrink-0 text-right font-mono text-[10px] text-slate-600" title={test.detail}>
                          {test.detail.length > 50 ? test.detail.slice(0, 50) + "…" : test.detail}
                        </span>
                        <span className="w-[40px] shrink-0 text-right font-mono text-[9px] tabular-nums text-slate-800">
                          {test.ms}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Global type for injected secret ──────────────────────────────────────────
declare global {
  interface Window {
    __CRON_SECRET?: string;
  }
}
