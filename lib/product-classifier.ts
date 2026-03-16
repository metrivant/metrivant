// Deterministic product / release event classification.
//
// Classification order:
//   1. Semver — if a valid version tag is present, classify from version structure.
//      Semver takes precedence over keyword matching.
//   2. Keywords — title + summary keyword matching when no valid semver.
//
// Canonical product event types:
//   major_release | feature_launch | feature_update | integration_release |
//   security_update | bugfix_release | api_change | docs_update |
//   deprecation | other_product_event
//
// Note: 'feature_launch' is shared with the existing page-diff pipeline signal type.
// signal.source_type = 'feed_event' distinguishes product feed origin from page diff.

export type ProductEventType =
  | "major_release"
  | "feature_launch"
  | "feature_update"
  | "integration_release"
  | "security_update"
  | "bugfix_release"
  | "api_change"
  | "docs_update"
  | "deprecation"
  | "other_product_event";

export type ProductSignificanceTier = "high" | "medium" | "low" | "other";

export interface ProductClassificationResult {
  productEventType:  ProductEventType;
  significanceTier:  ProductSignificanceTier;
  confidence:        number;
  classifiedBy:      "semver" | "keywords";
  versionTag:        string | null; // normalized version tag, e.g. "v1.2.3"
}

// Confidence values per significance tier (all above 0.65 CONFIDENCE_INTERPRET gate).
const TIER_CONFIDENCE: Record<ProductSignificanceTier, number> = {
  high:   0.82,
  medium: 0.76,
  low:    0.70,
  other:  0.68,
};

const TIER_BY_TYPE: Record<ProductEventType, ProductSignificanceTier> = {
  major_release:       "high",
  feature_launch:      "high",
  security_update:     "high",
  api_change:          "high",
  deprecation:         "high",
  integration_release: "medium",
  feature_update:      "medium",
  bugfix_release:      "low",
  docs_update:         "low",
  other_product_event: "other",
};

// ── Semver extraction ──────────────────────────────────────────────────────────
// Extracts version tag from release title or GUID.
// Handles: "v1.2.3", "v1.2.3-beta", "2.0.1", "v2.0", "Release 1.3.0"

const SEMVER_FULL_RE  = /\bv?(\d+)\.(\d+)\.(\d+)(?:[.-]\w+)?\b/;
const SEMVER_SHORT_RE = /\bv?(\d+)\.(\d+)\b/;

export function extractVersionTag(title: string, guid?: string | null): string | null {
  // Full semver from title (preferred)
  const fullMatch = title.match(SEMVER_FULL_RE);
  if (fullMatch) {
    const raw = fullMatch[0];
    return raw.startsWith("v") ? raw : `v${raw}`;
  }

  // Short semver from title (e.g. "v2.0")
  const shortMatch = title.match(SEMVER_SHORT_RE);
  if (shortMatch) {
    const raw = shortMatch[0];
    return raw.startsWith("v") ? raw : `v${raw}`;
  }

  // GitHub GUID pattern: "tag:github.com,2008:Repository/123456789/v1.2.3"
  if (guid) {
    const parts = guid.split("/");
    const last  = parts[parts.length - 1];
    if (SEMVER_FULL_RE.test(last) || SEMVER_SHORT_RE.test(last)) {
      return last.startsWith("v") ? last : `v${last}`;
    }
  }

  return null;
}

// ── Semver-based classification ────────────────────────────────────────────────
// Rules per spec:
//   major version (X.0.0 or X.0): → major_release
//   minor version (X.Y.0 or X.Y where Y > 0): → feature_update
//   patch version (X.Y.Z where Z > 0): → bugfix_release
//
// Semver classification takes precedence over keyword matching when a valid tag present.

function parseSemverComponents(tag: string): { major: number; minor: number; patch: number } | null {
  const stripped = tag.replace(/^v/, "");

  const fullM = stripped.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (fullM) {
    return { major: parseInt(fullM[1], 10), minor: parseInt(fullM[2], 10), patch: parseInt(fullM[3], 10) };
  }

  const shortM = stripped.match(/^(\d+)\.(\d+)(?!\.\d)/);
  if (shortM) {
    return { major: parseInt(shortM[1], 10), minor: parseInt(shortM[2], 10), patch: 0 };
  }

  return null;
}

function classifyFromSemver(tag: string): ProductEventType | null {
  const v = parseSemverComponents(tag);
  if (!v) return null;

  if (v.minor === 0 && v.patch === 0) return "major_release";
  if (v.patch === 0)                   return "feature_update";
  return "bugfix_release";
}

// ── Keyword-based classification ───────────────────────────────────────────────
// Rules evaluated in priority order — first match wins.
// More-specific keywords before general ones.

const KEYWORD_RULES: Array<{ type: ProductEventType; keywords: string[] }> = [
  {
    type: "security_update",
    keywords: [
      "security", "vulnerability", "cve-", "patch", "hardening",
      "security fix", "security patch", "security release",
      "critical fix", "security advisory",
    ],
  },
  {
    type: "deprecation",
    keywords: [
      "deprecat", "sunset", "retiring", "end of support",
      "end of life", "eol", "removed support", "no longer supported",
    ],
  },
  {
    type: "api_change",
    keywords: [
      "api", "sdk", "endpoint", "webhook", "schema change",
      "developer api", "rest api", "graphql", "openapi",
      "breaking change", "backwards incompatible",
    ],
  },
  {
    type: "major_release",
    keywords: [
      "version 2", "version 3", "version 4", "version 5",
      "v2.0", "v3.0", "v4.0", "v5.0",
      "major release", "general availability", "generally available", " ga ",
      "2.0 release", "3.0 release", "major version",
      "platform launch", "product launch",
    ],
  },
  {
    type: "integration_release",
    keywords: [
      "integration", "connector", "plugin", "extension",
      "partnership integration", "native integration",
      "supports ", "compatible with", "works with",
    ],
  },
  {
    type: "feature_launch",
    keywords: [
      "introducing", "new feature", "launches", "launches new",
      "now available", "announcing", "we're excited",
      "today we", "release of", "rolling out",
    ],
  },
  {
    type: "feature_update",
    keywords: [
      "improved", "enhanced", "updated", "added support",
      "expanded", "upgrade", "better", "faster", "smarter",
      "added to", "now supports", "extends support",
    ],
  },
  {
    type: "bugfix_release",
    keywords: [
      "bug fix", "bugfix", "fixes", "fix for", "resolved",
      "stability", "stability improvements", "maintenance release",
      "hotfix", "patch release",
    ],
  },
  {
    type: "docs_update",
    keywords: [
      "documentation", "docs", "guide", "reference", "tutorial",
      "getting started", "how-to", "readme", "api reference",
    ],
  },
];

function classifyFromKeywords(title: string, summary: string | null | undefined): ProductEventType {
  const text = `${title} ${summary ?? ""}`.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.type;
    }
  }

  return "other_product_event";
}

// ── Main entry point ───────────────────────────────────────────────────────────

export function classifyProductEvent(
  title:      string,
  summary:    string | null | undefined,
  versionTag: string | null | undefined
): ProductClassificationResult {
  // Semver takes precedence when a valid version tag is present (per spec).
  if (versionTag) {
    const semverType = classifyFromSemver(versionTag);
    if (semverType) {
      const tier = TIER_BY_TYPE[semverType];
      return {
        productEventType: semverType,
        significanceTier: tier,
        confidence:       TIER_CONFIDENCE[tier],
        classifiedBy:     "semver",
        versionTag,
      };
    }
  }

  // Keyword fallback
  const kwType = classifyFromKeywords(title, summary);
  const tier   = TIER_BY_TYPE[kwType];
  return {
    productEventType: kwType,
    significanceTier: tier,
    confidence:       TIER_CONFIDENCE[tier],
    classifiedBy:     "keywords",
    versionTag:       versionTag ?? null,
  };
}
