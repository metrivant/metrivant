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
import { EMERGING_CATALOG, type EmergingCompetitor } from "../../../lib/sector-catalog";

// ── Catalog browse sectors ────────────────────────────────────────────────────

const BROWSE_SECTOR_OPTIONS = [
  { value: "saas",          label: "Software & AI"      },
  { value: "fintech",       label: "Fintech"             },
  { value: "cybersecurity", label: "Cybersecurity"       },
  { value: "defense",       label: "Defense & Aerospace" },
  { value: "energy",        label: "Energy & Resources"  },
] as const;

const BROWSE_SECTOR_CUSTOM = { value: "custom", label: "Custom" } as const;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 18;

// Category intelligence teasers
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

// ── Company logo with letter fallback ─────────────────────────────────────────

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const hue = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (failed) {
    return (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[12px] font-semibold"
        style={{
          background: `hsl(${hue}, 15%, 12%)`,
          color:      `hsl(${hue}, 25%, 55%)`,
          letterSpacing: "0.04em",
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
      width={26}
      height={26}
      className="rounded-[4px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// ── Category badge — monochrome ────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CatalogCategory }) {
  return (
    <span
      className="inline-flex rounded-[3px] px-2 py-0.5 text-[9px] font-medium uppercase"
      style={{
        letterSpacing:   "0.14em",
        background:      "rgba(255,255,255,0.04)",
        border:          "1px solid rgba(255,255,255,0.08)",
        color:           "rgba(255,255,255,0.35)",
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
  plan = "analyst",
}: {
  initialTracked: string[];
  initialSector?: string;
  plan?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CatalogCategory | null>(null);
  const [tracked, setTracked] = useState<Set<string>>(new Set(initialTracked));
  const [loadingDomain, setLoadingDomain] = useState<string | null>(null);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showRising, setShowRising] = useState(false);
  const [loadingEmergingDomain, setLoadingEmergingDomain] = useState<string | null>(null);

  // Global operation in progress check — enforces one-at-a-time tracking
  const anyOperationInProgress = loadingDomain !== null || loadingEmergingDomain !== null || removingDomain !== null;

  const CATALOG_SECTORS = new Set(["saas", "defense", "energy"]);
  const defaultBrowse = CATALOG_SECTORS.has(initialSector) ? initialSector : "saas";
  const [browseSector, setBrowseSector] = useState(defaultBrowse);
  const [browseSectorOpen, setBrowseSectorOpen] = useState(false);
  const browseSectorRef = useRef<HTMLDivElement>(null);

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
    const catalogValue = CATALOG_SECTORS.has(value) ? value : "saas";
    setBrowseSector(value);
    setBrowseSectorOpen(false);
    setActiveCategory(null);
    setQuery("");
    setPage(1);
    setShowRising(false);
    void catalogValue;
  }

  // Emerging companies for current browse context
  const emergingList: EmergingCompetitor[] = useMemo(() => {
    if (browseSector === "custom") {
      // Show all emerging companies across all sectors
      return Object.values(EMERGING_CATALOG).flat();
    }
    return EMERGING_CATALOG[browseSector] ?? [];
  }, [browseSector]);

  const isCustomBrowse  = browseSector === "custom";
  const catalogSector   = (!isCustomBrowse && CATALOG_SECTORS.has(browseSector)) ? browseSector : "saas";
  const sectorConfig    = getSectorConfig(catalogSector);
  const sectorCategories: CatalogCategory[] = isCustomBrowse
    ? (Object.keys(CATEGORY_LABELS) as CatalogCategory[])
    : (sectorConfig.catalogCategories as CatalogCategory[]);

  const sectorCatalog = useMemo(
    () => isCustomBrowse
      ? COMPETITOR_CATALOG
      : COMPETITOR_CATALOG.filter((e) => CATEGORY_SECTOR[e.category] === catalogSector),
    [isCustomBrowse, catalogSector]
  );

  const isDomainQuery   = /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,}){1,2}$/.test(query.trim());
  const normalizedDomain = isDomainQuery ? query.trim().toLowerCase() : null;
  const referenceEntry  = normalizedDomain
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
    if (activeCategory) results = results.filter((e) => e.category === activeCategory);
    return results.sort((a, b) => b.popularity_score - a.popularity_score);
  }, [query, activeCategory, referenceEntry, normalizedDomain, sectorCatalog]);

  const visible  = filtered.slice(0, page * PAGE_SIZE);
  const hasMore  = filtered.length > page * PAGE_SIZE;

  const COMPETITOR_LIMIT = plan === "pro" ? 25 : 10;
  const atLimit = tracked.size >= COMPETITOR_LIMIT;

  async function trackCompetitor(entry: CatalogEntry) {
    if (tracked.has(entry.domain) || loadingDomain === entry.domain) return;
    if (atLimit) { setTrackError("limit"); return; }
    setLoadingDomain(entry.domain);
    setTrackError(null);
    try {
      const res = await fetch("/api/discover/track", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: `https://${entry.domain}`, name: entry.company_name, domain: entry.domain }),
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: `https://${entry.domain}` }),
      });
      if (res.ok) {
        setTracked((prev) => { const n = new Set(prev); n.delete(entry.domain); return n; });
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

  async function trackEmerging(entry: EmergingCompetitor) {
    if (tracked.has(entry.domain) || loadingEmergingDomain === entry.domain) return;
    if (atLimit) { setTrackError("limit"); return; }
    setLoadingEmergingDomain(entry.domain);
    setTrackError(null);
    try {
      const res = await fetch("/api/discover/track", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: entry.website_url, name: entry.name, domain: entry.domain }),
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
      setLoadingEmergingDomain(null);
    }
  }

  async function untrackEmerging(entry: EmergingCompetitor) {
    if (!tracked.has(entry.domain) || removingDomain === entry.domain) return;
    setRemovingDomain(entry.domain);
    setTrackError(null);
    try {
      const res = await fetch("/api/discover/untrack", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: entry.website_url }),
      });
      if (res.ok) {
        setTracked((prev) => { const n = new Set(prev); n.delete(entry.domain); return n; });
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
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-8">

      {/* ── Sector browse + hint ─────────────────────────────────────── */}
      <div className="mb-7 flex items-center justify-between gap-3">
        <div ref={browseSectorRef} className="relative">
          <button
            onClick={() => setBrowseSectorOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium uppercase transition-colors"
            style={{
              letterSpacing: "0.14em",
              border:        "1px solid rgba(255,255,255,0.10)",
              background:    "rgba(255,255,255,0.02)",
              color:         "rgba(255,255,255,0.45)",
              borderRadius:  "4px",
            }}
            aria-label="Browse by sector"
          >
            <span style={{ color: "#00B4FF", opacity: 0.8, fontSize: 8 }}>■</span>
            {browseSectorLabel}
            <svg
              width="8" height="8" viewBox="0 0 9 9" fill="none" aria-hidden="true"
              style={{
                opacity: 0.4,
                transform: browseSectorOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              <path d="M1.5 3L4.5 6.5L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {browseSectorOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden py-1"
              style={{
                borderRadius:  "6px",
                border:        "1px solid rgba(255,255,255,0.10)",
                background:    "#080808",
                boxShadow:     "0 16px 48px rgba(0,0,0,0.95)",
              }}
            >
              <div
                className="px-3.5 pt-2 pb-1.5 text-[8px] font-medium uppercase"
                style={{ letterSpacing: "0.22em", color: "rgba(255,255,255,0.20)" }}
              >
                Browse catalog by sector
              </div>
              {BROWSE_SECTOR_OPTIONS.map((opt) => {
                const isSelected = opt.value === browseSector;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleBrowseSectorSelect(opt.value)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[11px] transition-colors"
                    style={{
                      color: isSelected ? "#ffffff" : "rgba(255,255,255,0.35)",
                      background: isSelected ? "rgba(255,255,255,0.04)" : "transparent",
                    }}
                  >
                    <span
                      className="h-1 w-1 shrink-0 rounded-full"
                      style={{ background: isSelected ? "#00B4FF" : "transparent" }}
                    />
                    {opt.label}
                  </button>
                );
              })}
              <div style={{ margin: "4px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              <button
                onClick={() => handleBrowseSectorSelect(BROWSE_SECTOR_CUSTOM.value)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[11px] transition-colors"
                style={{
                  color: BROWSE_SECTOR_CUSTOM.value === browseSector ? "#ffffff" : "rgba(255,255,255,0.35)",
                  background: BROWSE_SECTOR_CUSTOM.value === browseSector ? "rgba(255,255,255,0.04)" : "transparent",
                }}
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{ background: BROWSE_SECTOR_CUSTOM.value === browseSector ? "#00B4FF" : "transparent" }}
                />
                {BROWSE_SECTOR_CUSTOM.label}
              </button>
            </div>
          )}
        </div>

        <span
          className="text-[10px]"
          style={{ color: "rgba(255,255,255,0.14)", letterSpacing: "0.04em" }}
        >
          Catalog filter only — sector switching is in the radar header.
        </span>

        {/* ── All / Rising toggle ──────────────────────────────────── */}
        <div
          className="ml-auto flex items-center"
          style={{
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
            background:   "rgba(255,255,255,0.02)",
            padding:      "2px",
          }}
        >
          {([
            { id: false, label: "All" },
            { id: true,  label: "Rising" },
          ] as const).map(({ id, label }) => {
            const active = showRising === id;
            return (
              <button
                key={label}
                onClick={() => { setShowRising(id); setPage(1); setQuery(""); setActiveCategory(null); }}
                className="px-3 py-1 text-[10px] font-medium uppercase transition-all"
                style={{
                  letterSpacing: "0.14em",
                  borderRadius:  "3px",
                  background:    active ? (id ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.06)") : "transparent",
                  color:         active ? (id ? "rgba(245,158,11,0.90)" : "rgba(255,255,255,0.70)") : "rgba(255,255,255,0.25)",
                  border:        active && id ? "1px solid rgba(245,158,11,0.20)" : "1px solid transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Rising view ─────────────────────────────────────────────── */}
      {showRising && (
        <>
          <div className="mb-5 flex items-center gap-2.5 px-4 py-2.5"
            style={{
              background:   "rgba(245,158,11,0.03)",
              border:       "1px solid rgba(245,158,11,0.10)",
              borderRadius: "4px",
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(245,158,11,0.70)" }} />
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.03em" }}>
              Curated emerging competitors — fast-moving, recently funded, and worth watching.
            </span>
          </div>

          {trackError && (
            trackError === "limit" ? (
              <div className="mb-5 flex items-center justify-between px-4 py-3 text-[12px]"
                style={{ borderRadius: "4px", border: "1px solid rgba(245,158,11,0.20)", background: "rgba(245,158,11,0.04)", color: "rgba(245,158,11,0.80)" }}
              >
                <span><span className="font-semibold">Limit reached.</span><span className="ml-2 opacity-70">Maximum {COMPETITOR_LIMIT} competitors. Remove one to add another.</span></span>
                <button onClick={() => setTrackError(null)} className="ml-4 opacity-40 hover:opacity-80" aria-label="Dismiss">✕</button>
              </div>
            ) : (
              <div className="mb-5 flex items-center justify-between px-4 py-3 text-[12px]"
                style={{ borderRadius: "4px", border: "1px solid rgba(239,68,68,0.20)", background: "rgba(239,68,68,0.04)", color: "rgba(239,68,68,0.75)" }}
              >
                {trackError}
                <button onClick={() => setTrackError(null)} className="ml-4 opacity-40 hover:opacity-80">✕</button>
              </div>
            )
          )}

          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", overflow: "hidden" }}
          >
            {emergingList.map((entry) => {
              const isTracked  = tracked.has(entry.domain);
              const isLoading  = loadingEmergingDomain === entry.domain;
              const isRemoving = removingDomain === entry.domain;
              return (
                <div key={entry.domain}
                  className="flex flex-col p-5 transition-colors"
                  style={{ background: isTracked ? "rgba(0,180,255,0.025)" : "#070707" }}
                  onMouseEnter={(e) => { if (!isTracked) (e.currentTarget as HTMLDivElement).style.background = "#0c0c0c"; }}
                  onMouseLeave={(e) => { if (!isTracked) (e.currentTarget as HTMLDivElement).style.background = "#070707"; }}
                >
                  {/* Logo + name */}
                  <div className="mb-3 flex flex-col items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center"
                      style={{ borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
                    >
                      <CompanyLogo domain={entry.domain} name={entry.name} />
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-medium text-white" style={{ letterSpacing: "0.04em", lineHeight: 1.3 }}>
                        {entry.name}
                      </div>
                      <div className="mt-0.5 text-[10px]" style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
                        {entry.domain}
                      </div>
                    </div>
                  </div>

                  {/* Rising badge */}
                  <div className="mb-3 flex items-center justify-center">
                    <span className="inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[9px] font-medium uppercase"
                      style={{ letterSpacing: "0.14em", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", color: "rgba(245,158,11,0.75)" }}
                    >
                      <span className="h-1 w-1 rounded-full" style={{ background: "rgba(245,158,11,0.80)" }} />
                      Rising
                    </span>
                  </div>

                  {/* Rationale */}
                  <p className="mb-4 text-center text-[10px] leading-snug"
                    style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.03em" }}
                  >
                    {entry.rationale}
                  </p>

                  {/* CTA */}
                  {isTracked ? (
                    <div className="mt-auto flex gap-2">
                      <div className="flex flex-1 items-center justify-center py-2 text-[11px] font-medium"
                        style={{ borderRadius: "4px", border: "1px solid rgba(0,180,255,0.20)", background: "rgba(0,180,255,0.06)", color: "#00B4FF", letterSpacing: "0.08em" }}
                      >
                        ✓ Tracking
                      </div>
                      <button
                        onClick={() => untrackEmerging(entry)}
                        disabled={isRemoving}
                        className="flex items-center justify-center px-3 py-2 transition-colors disabled:opacity-40"
                        style={{ borderRadius: "4px", border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.25)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,68,68,0.75)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
                        aria-label={`Remove ${entry.name}`}
                        title="Remove from radar"
                      >
                        {isRemoving ? <span className="text-[10px]">…</span> : (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => trackEmerging(entry)}
                      disabled={anyOperationInProgress || atLimit}
                      title={atLimit ? "Competitor limit reached" : anyOperationInProgress && !isLoading ? "Please wait..." : undefined}
                      className="mt-auto w-full py-2 text-[11px] font-medium uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ borderRadius: "4px", border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em" }}
                      onMouseEnter={(e) => { if (!anyOperationInProgress && !atLimit) { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)"; } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; }}
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex gap-0.5">
                            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
                            <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
                          </span>
                          Adding
                        </span>
                      ) : "Track"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Search ───────────────────────────────────────────────────── */}
      {!showRising && (<>
      <div className="relative mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />
            <path d="M10 10L13.5 13.5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search by name or domain"
          className="h-11 w-full pl-10 pr-10 text-[13px] text-white outline-none transition-all"
          style={{
            background:   "#060606",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
            letterSpacing: "0.03em",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
        {query && (
          <button
            onClick={clearFilters}
            className="absolute inset-y-0 right-4 flex items-center transition-colors"
            style={{ color: "rgba(255,255,255,0.25)" }}
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Domain-match banner ───────────────────────────────────────── */}
      {isDomainQuery && referenceEntry && (
        <div
          className="mb-5 flex items-center gap-2.5 px-4 py-2.5"
          style={{
            background:   "rgba(255,255,255,0.02)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
          }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "#00B4FF", opacity: 0.7 }}
          />
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Showing competitors similar to{" "}
            <span className="font-medium text-white">{referenceEntry.company_name}</span>
            {" · "}
            <span style={{ color: "rgba(255,255,255,0.60)" }}>
              {CATEGORY_LABELS[referenceEntry.category]}
            </span>
          </span>
        </div>
      )}

      {isDomainQuery && !referenceEntry && query.trim().length > 0 && (
        <div
          className="mb-5 px-4 py-2.5"
          style={{
            background:   "rgba(255,255,255,0.02)",
            border:       "1px solid rgba(255,255,255,0.06)",
            borderRadius: "4px",
          }}
        >
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.30)" }}>
            Domain not in catalog — add it manually via{" "}
            <a href="/app/onboarding" style={{ color: "#00B4FF" }} className="hover:underline">
              onboarding
            </a>.
          </span>
        </div>
      )}

      {/* ── Category filters ─────────────────────────────────────────── */}
      <div className="mb-7 flex flex-wrap gap-1.5">
        <button
          onClick={() => { setActiveCategory(null); setPage(1); }}
          className="px-3 py-1.5 text-[10px] font-medium uppercase transition-all"
          style={{
            letterSpacing: "0.12em",
            borderRadius:  "3px",
            border:        !activeCategory ? "1px solid rgba(0,180,255,0.30)" : "1px solid rgba(255,255,255,0.08)",
            background:    !activeCategory ? "rgba(0,180,255,0.06)"           : "rgba(255,255,255,0.02)",
            color:         !activeCategory ? "#00B4FF"                          : "rgba(255,255,255,0.30)",
          }}
        >
          All{" "}
          <span style={{ opacity: 0.45 }}>{sectorCatalog.length}</span>
        </button>
        {sectorCategories.map((cat) => {
          const count    = sectorCatalog.filter((e) => e.category === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(isActive ? null : cat); setPage(1); }}
              className="px-3 py-1.5 text-[10px] font-medium uppercase transition-all"
              style={{
                letterSpacing: "0.12em",
                borderRadius:  "3px",
                border:        isActive ? "1px solid rgba(0,180,255,0.30)" : "1px solid rgba(255,255,255,0.08)",
                background:    isActive ? "rgba(0,180,255,0.06)"           : "rgba(255,255,255,0.02)",
                color:         isActive ? "#00B4FF"                          : "rgba(255,255,255,0.30)",
              }}
            >
              {CATEGORY_LABELS[cat]}
              <span style={{ opacity: 0.40, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Meta row ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <span
          className="text-[11px]"
          style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}
        >
          {filtered.length} {filtered.length !== 1 ? "targets" : "target"}
        </span>
        {tracked.size > 0 && (
          <span
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#00B4FF", opacity: 0.6 }} />
            {tracked.size} tracked
          </span>
        )}
      </div>

      {/* ── Error / limit banner ─────────────────────────────────────── */}
      {trackError && (
        trackError === "limit" ? (
          <div
            className="mb-5 flex items-center justify-between px-4 py-3 text-[12px]"
            style={{
              borderRadius: "4px",
              border:       "1px solid rgba(245,158,11,0.20)",
              background:   "rgba(245,158,11,0.04)",
              color:        "rgba(245,158,11,0.80)",
            }}
          >
            <span>
              <span className="font-semibold">Limit reached.</span>
              <span className="ml-2 opacity-70">
                Maximum {COMPETITOR_LIMIT} competitors. Remove one to add another.
              </span>
            </span>
            <button
              onClick={() => setTrackError(null)}
              style={{ opacity: 0.40 }}
              className="hover:opacity-80 ml-4"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            className="mb-5 flex items-center justify-between px-4 py-3 text-[12px]"
            style={{
              borderRadius: "4px",
              border:       "1px solid rgba(239,68,68,0.20)",
              background:   "rgba(239,68,68,0.04)",
              color:        "rgba(239,68,68,0.75)",
            }}
          >
            {trackError}
            <button onClick={() => setTrackError(null)} className="ml-4 opacity-40 hover:opacity-80">✕</button>
          </div>
        )
      )}

      {/* ── Results grid ─────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center"
            style={{
              borderRadius: "50%",
              border:       "1px solid rgba(255,255,255,0.08)",
              background:   "rgba(255,255,255,0.02)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" />
              <path d="M16 16L20 20" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p
            className="text-[13px] font-medium"
            style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}
          >
            No targets found.
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.03em" }}
          >
            Adjust your search or clear filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 text-[11px] hover:underline"
            style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.06em" }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            border:     "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {visible.map((entry) => {
            const isTracked  = tracked.has(entry.domain);
            const isLoading  = loadingDomain === entry.domain;
            const isRemoving = removingDomain === entry.domain;

            return (
              <div
                key={entry.id}
                className="flex flex-col p-5 transition-colors"
                style={{
                  background: isTracked ? "rgba(0,180,255,0.025)" : "#070707",
                }}
                onMouseEnter={(e) => {
                  if (!isTracked) (e.currentTarget as HTMLDivElement).style.background = "#0c0c0c";
                }}
                onMouseLeave={(e) => {
                  if (!isTracked) (e.currentTarget as HTMLDivElement).style.background = "#070707";
                }}
              >
                {/* Logo + name */}
                <div className="mb-3 flex flex-col items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: "6px",
                      border:       "1px solid rgba(255,255,255,0.06)",
                      background:   "rgba(255,255,255,0.03)",
                    }}
                  >
                    <CompanyLogo domain={entry.domain} name={entry.company_name} />
                  </div>
                  <div className="text-center">
                    <div
                      className="text-[13px] font-medium text-white"
                      style={{ letterSpacing: "0.04em", lineHeight: 1.3 }}
                    >
                      {entry.company_name}
                    </div>
                    <div
                      className="mt-0.5 text-[10px]"
                      style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}
                    >
                      {entry.domain}
                    </div>
                  </div>
                </div>

                {/* Category badge */}
                <div className="mb-3 flex items-center justify-center">
                  <CategoryBadge category={entry.category} />
                </div>

                {/* Teaser */}
                {CATEGORY_TEASER[entry.category] && (
                  <p
                    className="mb-4 text-center text-[10px] leading-snug"
                    style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.03em" }}
                  >
                    {CATEGORY_TEASER[entry.category]}
                  </p>
                )}

                {/* CTA */}
                {isTracked ? (
                  <div className="mt-auto flex gap-2">
                    <div
                      className="flex flex-1 items-center justify-center py-2 text-[11px] font-medium"
                      style={{
                        borderRadius: "4px",
                        border:       "1px solid rgba(0,180,255,0.20)",
                        background:   "rgba(0,180,255,0.06)",
                        color:        "#00B4FF",
                        letterSpacing: "0.08em",
                      }}
                    >
                      ✓ Tracking
                    </div>
                    <button
                      onClick={() => untrackCompetitor(entry)}
                      disabled={isRemoving}
                      className="flex items-center justify-center px-3 py-2 transition-colors disabled:opacity-40"
                      style={{
                        borderRadius: "4px",
                        border:       "1px solid rgba(255,255,255,0.06)",
                        background:   "transparent",
                        color:        "rgba(255,255,255,0.25)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.35)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,68,68,0.75)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)";
                      }}
                      aria-label={`Remove ${entry.company_name}`}
                      title="Remove from radar"
                    >
                      {isRemoving ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => trackCompetitor(entry)}
                    disabled={anyOperationInProgress || atLimit}
                    title={atLimit ? "Competitor limit reached" : anyOperationInProgress && !isLoading ? "Please wait..." : undefined}
                    className="mt-auto w-full py-2 text-[11px] font-medium uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderRadius:  "4px",
                      border:        "1px solid rgba(255,255,255,0.10)",
                      background:    "transparent",
                      color:         "rgba(255,255,255,0.35)",
                      letterSpacing: "0.10em",
                    }}
                    onMouseEnter={(e) => {
                      if (!anyOperationInProgress && !atLimit) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
                      (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)";
                    }}
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex gap-0.5">
                          <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                          <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
                          <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
                        </span>
                        Adding
                      </span>
                    ) : "Track"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      </>)}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {!showRising && hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-7 py-2.5 text-[11px] font-medium uppercase transition-colors"
            style={{
              borderRadius:  "4px",
              border:        "1px solid rgba(255,255,255,0.10)",
              background:    "transparent",
              color:         "rgba(255,255,255,0.30)",
              letterSpacing: "0.10em",
            }}
          >
            Load more
            <span style={{ marginLeft: 8, opacity: 0.35 }}>
              ({filtered.length - visible.length})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
