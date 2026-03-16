"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  COMPETITOR_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_SECTOR,
  type CatalogEntry,
  type CatalogCategory,
} from "../../../lib/catalog";
import { getSectorConfig, getSectorLabel } from "../../../lib/sectors";

// ── Catalog browse sectors (alphabetical) ────────────────────────────────────
// This dropdown filters the catalog for browsing only.
// It does NOT switch the org's sector — use the SectorSwitcher in the app header for that.

const BROWSE_SECTOR_OPTIONS = [
  { value: "ai-infrastructure", label: "AI Infrastructure" },
  { value: "consumer-tech",     label: "Consumer Tech" },
  { value: "custom",            label: "Custom" },
  { value: "cybersecurity",     label: "Cybersecurity" },
  { value: "defense",           label: "Defense" },
  { value: "devtools",          label: "DevTools" },
  { value: "energy",            label: "Energy" },
  { value: "fintech",           label: "Fintech" },
  { value: "healthcare",        label: "Healthcare" },
  { value: "saas",              label: "Software" },
] as const;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 18;

// Colors per category (SaaS + Defense + Energy)
const CATEGORY_BG: Partial<Record<CatalogCategory, string>> = {
  // SaaS
  "project-management": "rgba(46,230,166,0.10)",
  "developer-tools":    "rgba(96,165,250,0.10)",
  analytics:            "rgba(167,139,250,0.10)",
  crm:                  "rgba(251,191,36,0.10)",
  "ai-tools":           "rgba(244,114,182,0.10)",
  "design-tools":       "rgba(251,146,60,0.10)",
  // Defense
  "defense-primes":     "rgba(59,130,246,0.10)",
  aerospace:            "rgba(99,102,241,0.10)",
  "cyber-intel":        "rgba(34,197,94,0.10)",
  "defense-services":   "rgba(148,163,184,0.10)",
  // Energy
  "oil-gas":            "rgba(234,179,8,0.10)",
  renewables:           "rgba(34,197,94,0.10)",
  "energy-services":    "rgba(249,115,22,0.10)",
  "energy-tech":        "rgba(20,184,166,0.10)",
};

const CATEGORY_COLOR: Partial<Record<CatalogCategory, string>> = {
  // SaaS
  "project-management": "#2EE6A6",
  "developer-tools":    "#60A5FA",
  analytics:            "#A78BFA",
  crm:                  "#FBB824",
  "ai-tools":           "#F472B6",
  "design-tools":       "#FB923C",
  // Defense
  "defense-primes":     "#3B82F6",
  aerospace:            "#6366F1",
  "cyber-intel":        "#22C55E",
  "defense-services":   "#94A3B8",
  // Energy
  "oil-gas":            "#EAB308",
  renewables:           "#22C55E",
  "energy-services":    "#F97316",
  "energy-tech":        "#14B8A6",
};

function getCategoryBg(cat: CatalogCategory): string {
  return CATEGORY_BG[cat] ?? "rgba(100,116,139,0.10)";
}

function getCategoryColor(cat: CatalogCategory): string {
  return CATEGORY_COLOR[cat] ?? "#94A3B8";
}

// ── Company logo with letter fallback ─────────────────────────────────────────

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const hue = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (failed) {
    return (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-bold"
        style={{
          background: `hsl(${hue}, 35%, 18%)`,
          color: `hsl(${hue}, 60%, 68%)`,
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={name}
      width={28}
      height={28}
      className="rounded-[6px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// ── Category intelligence teasers ─────────────────────────────────────────────

const CATEGORY_TEASER: Partial<Record<CatalogCategory, string>> = {
  "project-management": "Pricing, roadmap & positioning signals",
  "developer-tools":    "API changes, pricing & feature launches",
  "analytics":          "Pricing shifts & product expansion",
  "crm":                "Enterprise push & deal structure moves",
  "ai-tools":           "Model updates, pricing & capability launches",
  "design-tools":       "Plan restructuring & feature expansion",
  "defense-primes":     "Contract positioning & capability signals",
  "aerospace":          "Program expansion & partnership signals",
  "cyber-intel":        "Threat posture & product repositioning",
  "defense-services":   "Service expansion & market positioning",
  "oil-gas":            "Pricing, capacity & market positioning",
  "renewables":         "Expansion signals & partnership moves",
  "energy-services":    "Service expansion & contract signals",
  "energy-tech":        "Product launches & market positioning",
};

// ── Category pill ─────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CatalogCategory }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em]"
      style={{
        background: getCategoryBg(category),
        color: getCategoryColor(category),
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiscoverClient({
  initialTracked,
  initialSector = "saas",
}: {
  initialTracked: string[];
  initialSector?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CatalogCategory | null>(null);
  // tracked = set of domains where competitor_id IS NOT NULL (no ghosts)
  const [tracked, setTracked] = useState<Set<string>>(new Set(initialTracked));
  const [loadingDomain, setLoadingDomain] = useState<string | null>(null);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [trackError, setTrackError] = useState<string | null>(null);

  // ── Browse-sector state ──────────────────────────────────────────────────
  // This controls which catalog is shown for browsing only.
  // It does NOT switch the org's sector — that is done via SectorSwitcher in the header.
  // Default: show the catalog matching the org's current sector; fall back to "saas".
  const CATALOG_SECTORS = new Set(["saas", "defense", "energy"]);
  const defaultBrowse = CATALOG_SECTORS.has(initialSector) ? initialSector : "saas";
  const [browseSector, setBrowseSector] = useState(defaultBrowse);
  const [browseSectorOpen, setBrowseSectorOpen] = useState(false);
  const browseSectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (browseSectorRef.current && !browseSectorRef.current.contains(e.target as Node)) {
        setBrowseSectorOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleBrowseSectorSelect(value: string) {
    if (value === browseSector) { setBrowseSectorOpen(false); return; }
    // Only saas/defense/energy have catalog entries — extended sectors fall back to saas
    const catalogValue = CATALOG_SECTORS.has(value) ? value : "saas";
    setBrowseSector(value);
    setBrowseSectorOpen(false);
    setActiveCategory(null);
    setQuery("");
    setPage(1);
    // If the effective catalog sector didn't change (both map to saas), no visual update needed
    void catalogValue; // used implicitly via catalogSector below
  }

  // The actual catalog sector used for filtering entries
  const catalogSector = CATALOG_SECTORS.has(browseSector) ? browseSector : "saas";

  // All categories for this catalog sector
  const sectorConfig = getSectorConfig(catalogSector);
  const sectorCategories = sectorConfig.catalogCategories as CatalogCategory[];

  // Sector-filtered base catalog (falls back to saas for extended sectors)
  const sectorCatalog = useMemo(
    () => COMPETITOR_CATALOG.filter((e) => CATEGORY_SECTOR[e.category] === catalogSector),
    [catalogSector]
  );

  // Detect domain input (e.g. "notion.so") vs. text search
  const isDomainQuery = /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,}){1,2}$/.test(query.trim());
  const normalizedDomain = isDomainQuery ? query.trim().toLowerCase() : null;

  const referenceEntry = normalizedDomain
    ? sectorCatalog.find((e) => e.domain === normalizedDomain)
    : null;

  const filtered = useMemo(() => {
    let results = [...sectorCatalog];

    if (normalizedDomain && referenceEntry) {
      results = results.filter(
        (e) => e.category === referenceEntry.category && e.domain !== referenceEntry.domain
      );
    } else if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(
        (e) => e.company_name.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q)
      );
    }

    if (activeCategory) {
      results = results.filter((e) => e.category === activeCategory);
    }

    return results.sort((a, b) => b.popularity_score - a.popularity_score);
  }, [query, activeCategory, referenceEntry, normalizedDomain, sectorCatalog]);

  const visible  = filtered.slice(0, page * PAGE_SIZE);
  const hasMore  = filtered.length > page * PAGE_SIZE;

  const COMPETITOR_LIMIT = 25;
  const atLimit = tracked.size >= COMPETITOR_LIMIT;

  async function trackCompetitor(entry: CatalogEntry) {
    if (tracked.has(entry.domain) || loadingDomain === entry.domain) return;
    if (atLimit) {
      setTrackError("limit");
      return;
    }
    setLoadingDomain(entry.domain);
    setTrackError(null);

    try {
      const res = await fetch("/api/discover/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:    `https://${entry.domain}`,
          name:   entry.company_name,
          domain: entry.domain,
        }),
      });

      if (res.ok) {
        setTracked((prev) => new Set([...prev, entry.domain]));
        router.refresh();
      } else if (res.status === 403) {
        setTrackError("limit");
      } else {
        const data = await res.json() as { error?: string };
        setTrackError(data.error ?? "Failed to track competitor");
      }
    } catch {
      setTrackError("Network error — please try again");
    } finally {
      setLoadingDomain(null);
    }
  }

  async function untrackCompetitor(entry: CatalogEntry) {
    if (!tracked.has(entry.domain) || removingDomain === entry.domain) return;
    setRemovingDomain(entry.domain);
    setTrackError(null);

    try {
      const res = await fetch("/api/discover/untrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://${entry.domain}` }),
      });

      if (res.ok) {
        setTracked((prev) => {
          const next = new Set(prev);
          next.delete(entry.domain);
          return next;
        });
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        setTrackError(data.error ?? "Failed to remove competitor");
      }
    } catch {
      setTrackError("Network error — please try again");
    } finally {
      setRemovingDomain(null);
    }
  }

  function clearFilters() {
    setQuery("");
    setActiveCategory(null);
    setPage(1);
  }

  const browseSectorLabel = getSectorLabel(browseSector);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">

      {/* ── Browse-sector filter ─────────────────────────────────────── */}
      {/* This is a CATALOG FILTER, not a sector switcher.               */}
      {/* Use the Sector control in the app header to switch your sector. */}
      <div className="mb-6 flex items-center gap-2">
        <div ref={browseSectorRef} className="relative">
          <button
            onClick={() => setBrowseSectorOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[#0d2010] px-3 py-1 text-[11px] font-medium transition-colors hover:border-[#1a3020]"
            style={{ background: "rgba(46,230,166,0.03)", color: "#64748b" }}
            aria-label="Browse by sector"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#2EE6A6", opacity: 0.8 }}
            />
            <span className="text-slate-600 text-[10px] uppercase tracking-[0.14em] font-semibold">Browse</span>
            <span style={{ color: "rgba(46,230,166,0.65)" }}>{browseSectorLabel}</span>
            <svg
              width="8"
              height="8"
              viewBox="0 0 9 9"
              fill="none"
              aria-hidden="true"
              className="opacity-40"
              style={{ transform: browseSectorOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
            >
              <path d="M1.5 3L4.5 6.5L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {browseSectorOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-[12px] border border-[#1a3020] bg-[#060d06] py-1"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85)" }}
            >
              <div className="px-3.5 pt-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                Browse catalog by sector
              </div>
              {BROWSE_SECTOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleBrowseSectorSelect(opt.value)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition-colors hover:bg-[#0a1a0a]"
                  style={{ color: opt.value === browseSector ? "#2EE6A6" : "#64748b" }}
                >
                  <span
                    className="h-1 w-1 shrink-0 rounded-full"
                    style={{ background: opt.value === browseSector ? "#2EE6A6" : "transparent" }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-700">
          — catalog filter only. To switch your sector use the control in the radar header.
        </span>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <div className="relative mb-5">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" />
            <path d="M10 10L13.5 13.5" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search by name, or enter a domain to find similar competitors"
          className="h-12 w-full rounded-[12px] border border-[#0d2010] bg-[#020802] pl-11 pr-10 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#2EE6A6]/22 focus:ring-1 focus:ring-[#2EE6A6]/12"
        />
        {query && (
          <button
            onClick={clearFilters}
            className="absolute inset-y-0 right-4 flex items-center text-slate-700 transition-colors hover:text-slate-400"
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Similar-domain banner ────────────────────────────────────── */}
      {isDomainQuery && referenceEntry && (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-[10px] border border-[#2EE6A6]/14 px-4 py-2.5"
          style={{ background: "rgba(46,230,166,0.04)" }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "#2EE6A6", boxShadow: "0 0 4px rgba(46,230,166,0.7)" }}
          />
          <span className="text-[13px] text-slate-400">
            Showing competitors similar to{" "}
            <span className="font-semibold text-white">{referenceEntry.company_name}</span>
            {" · "}
            <span style={{ color: getCategoryColor(referenceEntry.category) }}>
              {CATEGORY_LABELS[referenceEntry.category]}
            </span>
          </span>
        </div>
      )}

      {isDomainQuery && !referenceEntry && query.trim().length > 0 && (
        <div className="mb-5 rounded-[10px] border border-[#0d2010] bg-[#0a0f0a] px-4 py-2.5">
          <span className="text-[13px] text-slate-600">
            Domain not in catalog — add it manually via{" "}
            <a href="/app/onboarding" className="text-[#2EE6A6] hover:underline">
              onboarding
            </a>
            .
          </span>
        </div>
      )}

      {/* ── Category filters ─────────────────────────────────────────── */}
      <div className="mb-7 flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveCategory(null); setPage(1); }}
          className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
            !activeCategory
              ? "border border-[#2EE6A6]/25 bg-[#2EE6A6]/8 text-[#2EE6A6]"
              : "border border-[#0d2010] bg-[#020802] text-slate-500 hover:border-[#152a15] hover:text-slate-400"
          }`}
        >
          All{" "}
          <span className="ml-1 tabular-nums opacity-50">{sectorCatalog.length}</span>
        </button>
        {sectorCategories.map((cat) => {
          const count    = sectorCatalog.filter((e) => e.category === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(isActive ? null : cat); setPage(1); }}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                isActive
                  ? "border"
                  : "border border-[#0d2010] bg-[#020802] text-slate-500 hover:border-[#152a15] hover:text-slate-400"
              }`}
              style={
                isActive
                  ? {
                      background:   getCategoryBg(cat),
                      borderColor:  `${getCategoryColor(cat)}40`,
                      color:        getCategoryColor(cat),
                    }
                  : undefined
              }
            >
              {CATEGORY_LABELS[cat]}
              <span className="ml-1 tabular-nums opacity-50">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Meta row ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[12px] text-slate-700">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
        {tracked.size > 0 && (
          <span className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#2EE6A6", opacity: 0.7 }} />
            {tracked.size} tracking
          </span>
        )}
      </div>

      {/* ── Error / limit banner ─────────────────────────────────────── */}
      {trackError && (
        trackError === "limit" ? (
          <div
            className="mb-5 rounded-[10px] border px-4 py-3 text-[13px]"
            style={{
              borderColor: "rgba(245,158,11,0.25)",
              background:  "rgba(245,158,11,0.06)",
              color:       "#f59e0b",
            }}
          >
            <span className="font-semibold">⚠ Competitor limit reached</span>
            <span className="ml-2 opacity-80">
              Maximum of {COMPETITOR_LIMIT} competitors allowed. Remove a competitor to add another.
            </span>
            <button
              onClick={() => setTrackError(null)}
              className="ml-3 opacity-50 hover:opacity-90"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="mb-5 rounded-[10px] border border-red-900/30 bg-red-950/20 px-4 py-3 text-[13px] text-red-400">
            {trackError}
            <button onClick={() => setTrackError(null)} className="ml-3 text-red-600 hover:text-red-400">✕</button>
          </div>
        )
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d2010]"
            style={{ background: "rgba(46,230,166,0.04)" }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" />
              <path d="M16 16L20 20" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-slate-400">No competitors found</p>
          <p className="mt-1 text-[12px] text-slate-700">Try a different search or clear your filters</p>
          <button onClick={clearFilters} className="mt-4 text-[12px] text-[#2EE6A6] hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => {
            const isTracked  = tracked.has(entry.domain);
            const isLoading  = loadingDomain === entry.domain;
            const isRemoving = removingDomain === entry.domain;

            return (
              <div
                key={entry.id}
                className="flex flex-col rounded-[14px] border border-[#0d2010] bg-[#020802] p-5 transition-colors hover:border-[#152a15]"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#030c03]">
                    <CompanyLogo domain={entry.domain} name={entry.company_name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold leading-tight text-white">
                      {entry.company_name}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-600">
                      {entry.domain}
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <CategoryBadge category={entry.category} />
                </div>

                {CATEGORY_TEASER[entry.category] && (
                  <p className="mb-4 text-[11px] leading-snug text-slate-700">
                    {CATEGORY_TEASER[entry.category]}
                  </p>
                )}

                {isTracked ? (
                  <div className="mt-auto flex gap-2">
                    {/* Tracked indicator */}
                    <div
                      className="flex flex-1 items-center justify-center rounded-[10px] border border-[#2EE6A6]/18 py-2 text-[12px] font-semibold text-[#2EE6A6]"
                      style={{ background: "rgba(46,230,166,0.07)" }}
                    >
                      ✓ Tracking
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => untrackCompetitor(entry)}
                      disabled={isRemoving}
                      className="flex items-center justify-center rounded-[10px] border border-[#1a0a0a] px-3 py-2 text-[11px] text-slate-700 transition-colors hover:border-red-900/40 hover:text-red-500 disabled:opacity-40"
                      aria-label={`Remove ${entry.company_name} from tracking`}
                      title="Remove from radar"
                    >
                      {isRemoving ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => trackCompetitor(entry)}
                    disabled={isLoading || atLimit}
                    title={atLimit ? "Competitor limit reached — remove one to add another" : undefined}
                    className={`mt-auto w-full rounded-[10px] py-2 text-[12px] font-semibold transition-all ${
                      isLoading || atLimit
                        ? "border border-[#0d2010] text-slate-600 opacity-50 cursor-not-allowed"
                        : "border border-[#152a15] text-slate-400 hover:border-[#2EE6A6]/22 hover:text-[#2EE6A6]"
                    }`}
                  >
                    {isLoading ? "Adding…" : "Track competitor"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-[#0d2010] bg-[#020802] px-7 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:border-[#152a15] hover:text-slate-300"
          >
            Show more
            <span className="ml-2 text-slate-700">
              ({filtered.length - visible.length} remaining)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
