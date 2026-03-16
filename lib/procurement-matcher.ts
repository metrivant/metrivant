// Deterministic competitor matching for external procurement sources.
//
// When ingesting from sector-scoped or government-hosted procurement feeds,
// entries may reference companies that may or may not be tracked competitors.
// This module matches procurement entry content against known competitor names.
//
// Strategy:
//   1. Build per-competitor match regexes from normalized names (word-boundary).
//   2. Check awardee_name field first (strongest signal).
//   3. Check title + summary for name mentions.
//   4. Return all matched competitor IDs.
//
// Rules:
//   - Exact case-insensitive word-boundary substring matching only.
//   - No fuzzy matching, no AI.
//   - Names shorter than 3 characters are excluded (too likely to false-match).
//   - When multiple tracked competitors match a single entry, return all of them.
//     Callers create a separate pool_event per matched competitor.
//
// This module is O(N × M) per ingest run where N = entries, M = competitors.
// Both values are expected to be < 200 in normal operation.

export interface CompetitorRecord {
  id:   string;
  name: string;
}

interface CompiledCompetitor {
  id:    string;
  name:  string;
  regex: RegExp;
}

// Build a word-boundary regex for a competitor name.
// Handles multi-word names and names with special regex characters.
function buildMatchRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use \b for single-word names; for multi-word names the phrase itself
  // acts as a sufficient boundary when used with case-insensitive matching.
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// Pre-compile regexes for a list of competitors.
// Call once per ingest run, then reuse across all entries.
export function compileCompetitorMatchers(competitors: CompetitorRecord[]): CompiledCompetitor[] {
  return competitors
    .filter((c) => c.name && c.name.trim().length >= 3)
    .map((c) => ({
      id:    c.id,
      name:  c.name.trim(),
      regex: buildMatchRegex(c.name.trim()),
    }));
}

// Match a single procurement entry against compiled competitor matchers.
// Returns an array of competitor IDs for all matched competitors (may be empty).
export function matchCompetitors(
  awardee:  string | null | undefined,
  title:    string,
  summary:  string | null | undefined,
  compiled: CompiledCompetitor[]
): string[] {
  if (compiled.length === 0) return [];

  // Build search text: awardee_name is highest-fidelity field, checked first
  // in the combined string. Title and summary provide broader context.
  const searchText = [awardee, title, summary]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ");

  if (!searchText) return [];

  const matched: string[] = [];
  for (const comp of compiled) {
    if (comp.regex.test(searchText)) {
      matched.push(comp.id);
    }
  }

  return matched;
}
