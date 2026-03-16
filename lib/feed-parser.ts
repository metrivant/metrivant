// Deterministic RSS 2.0 and Atom 1.0 feed parser.
//
// No AI. No browser rendering. Regex-based XML parsing only.
// Handles:
//   • CDATA sections in title / summary / description
//   • RSS <item> and Atom <entry> elements
//   • Atom <link href="..."> and RSS <link>text</link>
//   • Multiple date field names (pubDate, published, dc:date, updated)
//   • HTML entity decoding (&amp; &lt; &quot; etc.)
//   • Missing summary fields (common on enterprise newsroom feeds)
//   • WordPress content:encoded for summary fallback
//   • content_hash derivation: GUID → title+date → title+URL

import { createHash } from "crypto";

export interface FeedEntry {
  title:        string;
  summary:      string | null;
  event_url:    string | null;
  published_at: Date   | null;
  guid:         string | null;
  content_hash: string;
}

// ── HTML entity decoder ────────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(parseInt(num, 10)));
}

// ── Text extraction ────────────────────────────────────────────────────────────
// Extracts text content from the first matching XML element.
// Handles both plain text and CDATA-wrapped content.

function extractText(xml: string, ...tags: string[]): string | null {
  for (const tag of tags) {
    // Match <tag [attrs]>CDATA or text</tag>
    // Non-greedy [\s\S]*? prevents cross-element matches.
    const re = new RegExp(
      `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
      "i"
    );
    const match = xml.match(re);
    if (match) {
      const raw = (match[1] ?? match[2] ?? "").trim();
      if (raw) return decodeEntities(raw);
    }
  }
  return null;
}

// ── Link extraction ────────────────────────────────────────────────────────────
// Handles both:
//   Atom: <link href="https://..." />  (preferred)
//   RSS:  <link>https://...</link>

function extractLink(itemXml: string): string | null {
  // Atom: <link href="url" ...> — check for href attribute
  const atomMatch = itemXml.match(/<link\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/i);
  if (atomMatch) return atomMatch[1].trim();

  // RSS: <link>url</link>
  const rssMatch = itemXml.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (rssMatch) return rssMatch[1].trim();

  return null;
}

// ── Date parsing ───────────────────────────────────────────────────────────────
// Handles RFC 2822 (RSS pubDate), ISO 8601 (Atom published), and dc:date.

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  try {
    const d = new Date(raw.trim());
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ── Content hash ──────────────────────────────────────────────────────────────
// Deterministic fingerprint for deduplication.
//
// Priority:
//   1. GUID — RSS spec: MUST be unique and MUST NOT change per item
//   2. title + published_at — stable for articles with dates but no GUID
//   3. title + event_url   — stable for undated articles with known URLs
//   4. title only          — last resort; still unique within a feed on any given day
//
// 40 hex chars (sha256[:40] = 20 bytes) — sufficient entropy for dedup.

function computeContentHash(entry: Omit<FeedEntry, "content_hash">): string {
  let key: string;
  if (entry.guid) {
    key = `guid:${entry.guid}`;
  } else if (entry.published_at) {
    key = `title+date:${entry.title}|${entry.published_at.toISOString()}`;
  } else if (entry.event_url) {
    key = `title+url:${entry.title}|${entry.event_url}`;
  } else {
    key = `title:${entry.title}`;
  }
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

// ── Item/entry splitting ───────────────────────────────────────────────────────
// Extracts individual item/entry XML blobs from the feed body.
// Atom: <entry>...</entry>
// RSS:  <item>...</item>
// Non-greedy [\s\S]*? is safe because entries don't contain nested entries.

function splitEntries(feedXml: string): string[] {
  const entries: string[] = [];

  // Try Atom <entry> first.
  const atomIt = feedXml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi);
  for (const m of atomIt) entries.push(m[1]);

  // Fall back to RSS <item>.
  if (entries.length === 0) {
    const rssIt = feedXml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi);
    for (const m of rssIt) entries.push(m[1]);
  }

  return entries;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function parseFeed(xml: string): FeedEntry[] {
  const entryXmls = splitEntries(xml);
  const entries: FeedEntry[] = [];

  for (const entryXml of entryXmls) {
    // Title is required — entries without one are skipped (malformed or structural).
    const title = extractText(entryXml, "title");
    if (!title) continue;

    // Summary: try multiple field names in preference order.
    // content:encoded is WordPress-specific but common for press release feeds.
    // "summary" is Atom; "description" is RSS; "content" is Atom full-body.
    const summary = extractText(
      entryXml,
      "summary",
      "description",
      "content:encoded",
      "content",
      "media:description"
    );

    // Event URL: Atom uses <link href="..."> or <id> as canonical URL; RSS uses <link>.
    const event_url = extractLink(entryXml) ?? extractText(entryXml, "id");

    // GUID: RSS <guid>, Atom <id> (Atom id is the canonical entry URI).
    const guid = extractText(entryXml, "guid") ?? extractText(entryXml, "id");

    // Publication timestamp.
    const published_at = parseDate(
      extractText(entryXml, "pubDate", "published", "dc:date", "updated")
    );

    const partial: Omit<FeedEntry, "content_hash"> = {
      title,
      summary,
      event_url,
      published_at,
      guid,
    };

    entries.push({ ...partial, content_hash: computeContentHash(partial) });
  }

  return entries;
}
