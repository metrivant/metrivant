// Deterministic JSON parsing for Greenhouse, Lever, and Ashby ATS API responses.
//
// Each ATS has a different response shape. This module normalises all three into
// the canonical pool_event fields used by ingest-careers.ts.
//
// Output shape per posting:
//   externalId:      string  — ATS-native job ID (Greenhouse int as string, Lever/Ashby UUID)
//   title:           string  — job title
//   department:      string  — raw department / team name from ATS
//   location:        string  — primary location string (first location if multiple)
//   employmentType:  string  — "Full-time" | "Part-time" | "Contract" | "" (best-effort)
//   postingUrl:      string  — absolute URL to the public job posting
//   publishedAt:     string  — ISO 8601 timestamp (created or updated date, best available)
//   contentHash:     string  — sha256(externalId:title)[:40] — stable dedup key

import { createHash } from "crypto";

export type AtsType = "greenhouse" | "lever" | "ashby" | "workday";

export interface ParsedPosting {
  externalId:     string;
  title:          string;
  department:     string;
  location:       string;
  employmentType: string;
  postingUrl:     string;
  publishedAt:    string;
  contentHash:    string;
}

function contentHash(externalId: string, title: string): string {
  return createHash("sha256")
    .update(`${externalId}:${title}`)
    .digest("hex")
    .slice(0, 40);
}

function safeStr(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function safeIso(v: unknown): string {
  if (typeof v === "string" && v) {
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    // Unix timestamp string
    const n = Number(v);
    if (!isNaN(n) && n > 0) return new Date(n * 1000).toISOString();
  }
  if (typeof v === "number" && v > 0) {
    // Greenhouse/Lever return millisecond timestamps
    return new Date(v > 1e12 ? v : v * 1000).toISOString();
  }
  return new Date().toISOString();
}

// ── Greenhouse ─────────────────────────────────────────────────────────────────
// Response: { "jobs": [ { id, title, updated_at, location: { name }, departments: [...], job_url, ... } ] }

function parseGreenhouse(json: unknown): ParsedPosting[] {
  if (typeof json !== "object" || json === null) return [];
  const root = json as Record<string, unknown>;
  if (!Array.isArray(root.jobs)) return [];

  const postings: ParsedPosting[] = [];

  for (const job of root.jobs) {
    if (typeof job !== "object" || job === null) continue;
    const j = job as Record<string, unknown>;

    const externalId = safeStr(j.id);
    const title      = safeStr(j.title);
    if (!externalId || !title) continue;

    // Location
    const locObj   = j.location as Record<string, unknown> | null | undefined;
    const location = safeStr(locObj?.name);

    // Department — first entry in departments array
    let department = "";
    if (Array.isArray(j.departments) && j.departments.length > 0) {
      const dept = j.departments[0] as Record<string, unknown>;
      department = safeStr(dept.name);
    }

    // Employment type — Greenhouse puts it in metadata or omits it; best-effort
    let employmentType = "";
    if (Array.isArray(j.metadata)) {
      for (const m of j.metadata as Array<Record<string, unknown>>) {
        if (/employment.type/i.test(safeStr(m.name))) {
          employmentType = safeStr(m.value);
          break;
        }
      }
    }

    const postingUrl  = safeStr(j.absolute_url ?? j.job_url);
    const publishedAt = safeIso(j.updated_at ?? j.created_at);

    postings.push({
      externalId,
      title,
      department,
      location,
      employmentType,
      postingUrl,
      publishedAt,
      contentHash: contentHash(externalId, title),
    });
  }

  return postings;
}

// ── Lever ──────────────────────────────────────────────────────────────────────
// Response: [ { id, text (title), categories: { team, location, commitment }, hostedUrl, createdAt, ... } ]

function parseLever(json: unknown): ParsedPosting[] {
  if (!Array.isArray(json)) return [];

  const postings: ParsedPosting[] = [];

  for (const posting of json) {
    if (typeof posting !== "object" || posting === null) continue;
    const p = posting as Record<string, unknown>;

    const externalId = safeStr(p.id);
    const title      = safeStr(p.text);
    if (!externalId || !title) continue;

    const cats         = (p.categories ?? {}) as Record<string, unknown>;
    const department   = safeStr(cats.team ?? cats.department);
    const location     = safeStr(cats.location);
    const employmentType = safeStr(cats.commitment); // "Full-time", "Part-time", etc.

    const postingUrl  = safeStr(p.hostedUrl ?? p.applyUrl);
    const publishedAt = safeIso(p.createdAt);

    postings.push({
      externalId,
      title,
      department,
      location,
      employmentType,
      postingUrl,
      publishedAt,
      contentHash: contentHash(externalId, title),
    });
  }

  return postings;
}

// ── Ashby ──────────────────────────────────────────────────────────────────────
// Response: { "jobPostings": [ { id, title, locationName, departmentName, employmentType, jobUrl, publishedAt, ... } ] }
// Or older shape: { "jobs": [...] }

function parseAshby(json: unknown): ParsedPosting[] {
  if (typeof json !== "object" || json === null) return [];
  const root = json as Record<string, unknown>;

  const items = Array.isArray(root.jobPostings)
    ? root.jobPostings
    : Array.isArray(root.jobs)
    ? root.jobs
    : [];

  const postings: ParsedPosting[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;

    const externalId = safeStr(p.id);
    const title      = safeStr(p.title);
    if (!externalId || !title) continue;

    const department     = safeStr(p.departmentName ?? p.department);
    const location       = safeStr(p.locationName   ?? p.location);
    const employmentType = safeStr(p.employmentType);
    const postingUrl     = safeStr(p.jobUrl ?? p.url);
    const publishedAt    = safeIso(p.publishedAt ?? p.createdAt ?? p.updatedAt);

    postings.push({
      externalId,
      title,
      department,
      location,
      employmentType,
      postingUrl,
      publishedAt,
      contentHash: contentHash(externalId, title),
    });
  }

  return postings;
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

export function parseAtsResponse(atsType: AtsType, json: unknown): ParsedPosting[] {
  switch (atsType) {
    case "greenhouse": return parseGreenhouse(json);
    case "lever":      return parseLever(json);
    case "ashby":      return parseAshby(json);
    case "workday":
      // Workday does not have a structured API endpoint supported here.
      // Postings arrive via HTML careers-page monitoring (standard page diff pipeline).
      return [];
  }
}
