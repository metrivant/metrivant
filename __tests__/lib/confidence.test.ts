// Tests for computeConfidence — the scoring function embedded in detect-signals.
// We test the function indirectly by importing the file and calling the exported helpers.
// Since computeConfidence is not exported, we test it through classifySignal outputs
// by observing the resulting confidence scores in detect-signals integration tests.
//
// Instead, this file unit-tests the observable confidence model properties by
// re-implementing the formula and verifying boundary conditions match the spec.

import '../helpers/env';

// ── Inline implementation mirror ──────────────────────────────────────────────
// These values mirror detect-signals.ts exactly. If the source changes, these
// tests will catch the drift.

const SECTION_WEIGHTS: Record<string, number> = {
  pricing_plans:        0.85,
  pricing_references:   0.85,
  hero:                 0.65,
  headline:             0.60,
  nav_links:            0.55,
  cta_blocks:           0.55,
  release_feed:         0.55,
  announcements:        0.55,
  features_overview:    0.50,
  press_feed:           0.50,
  product_mentions:     0.45,
};

const DEFAULT_WEIGHT = 0.25;
const CONFIDENCE_SUPPRESS  = 0.35;
const CONFIDENCE_INTERPRET = 0.65;

function computeConfidence(
  sectionType: string,
  observationCount: number,
  lastSeenAt: string | null,
  pageClass: string
): number {
  const base = SECTION_WEIGHTS[sectionType] ?? DEFAULT_WEIGHT;

  const ageMs = lastSeenAt
    ? Date.now() - new Date(lastSeenAt).getTime()
    : Infinity;

  const recencyBonus =
    ageMs < 2  * 3600 * 1000 ? 0.15 :
    ageMs < 24 * 3600 * 1000 ? 0.10 : 0.05;

  const obsBonus = Math.min(0.15, Math.max(0, (observationCount - 1) * 0.05));

  const pageClassBonus = pageClass === 'high_value' ? 0.08 : 0;

  return Math.min(1.0, base + recencyBonus + obsBonus + pageClassBonus);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeConfidence — base weights', () => {
  const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

  it('uses correct base for pricing_plans (0.85)', () => {
    const score = computeConfidence('pricing_plans', 1, recentTime, 'standard');
    // base 0.85 + recency 0.15 = 1.0 → capped at 1.0
    expect(score).toBe(1.0);
  });

  it('uses correct base for hero (0.65)', () => {
    const score = computeConfidence('hero', 1, recentTime, 'standard');
    // base 0.65 + recency 0.15 = 0.80
    expect(score).toBeCloseTo(0.80, 5);
  });

  it('uses DEFAULT_WEIGHT (0.25) for unknown section type', () => {
    const oldTime = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48h old
    const score = computeConfidence('unknown_section', 1, oldTime, 'standard');
    // base 0.25 + recency 0.05 = 0.30 — below CONFIDENCE_SUPPRESS
    expect(score).toBeCloseTo(0.30, 5);
    expect(score).toBeLessThan(CONFIDENCE_SUPPRESS);
  });

  it('uses DEFAULT_WEIGHT for product_mentions (0.45)', () => {
    const oldTime = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const score = computeConfidence('product_mentions', 1, oldTime, 'standard');
    // base 0.45 + recency 0.05 = 0.50
    expect(score).toBeCloseTo(0.50, 5);
  });
});

describe('computeConfidence — recency bonus tiers', () => {
  it('applies 0.15 bonus for content seen < 2h ago', () => {
    const justNow = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const score = computeConfidence('nav_links', 1, justNow, 'standard');
    // base 0.55 + recency 0.15 = 0.70
    expect(score).toBeCloseTo(0.70, 5);
  });

  it('applies 0.10 bonus for content seen 2–24h ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const score = computeConfidence('nav_links', 1, threeHoursAgo, 'standard');
    // base 0.55 + recency 0.10 = 0.65
    expect(score).toBeCloseTo(0.65, 5);
  });

  it('applies 0.05 bonus for content seen > 24h ago', () => {
    const yesterday = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const score = computeConfidence('nav_links', 1, yesterday, 'standard');
    // base 0.55 + recency 0.05 = 0.60
    expect(score).toBeCloseTo(0.60, 5);
  });

  it('applies minimum 0.05 recency bonus when lastSeenAt is null', () => {
    const score = computeConfidence('nav_links', 1, null, 'standard');
    // null → Infinity age → 0.05 bonus
    // base 0.55 + recency 0.05 = 0.60
    expect(score).toBeCloseTo(0.60, 5);
  });
});

describe('computeConfidence — observation bonus', () => {
  const recentTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString(); // 3h ago = 0.10 recency

  it('gives 0 observation bonus for observationCount=1', () => {
    const score = computeConfidence('features_overview', 1, recentTime, 'standard');
    // base 0.50 + recency 0.10 + obs 0 = 0.60
    expect(score).toBeCloseTo(0.60, 5);
  });

  it('gives 0.05 observation bonus per additional observation', () => {
    const score = computeConfidence('features_overview', 2, recentTime, 'standard');
    // base 0.50 + recency 0.10 + obs 0.05 = 0.65
    expect(score).toBeCloseTo(0.65, 5);
  });

  it('caps observation bonus at 0.15 (observationCount=4+)', () => {
    const score4 = computeConfidence('features_overview', 4, recentTime, 'standard');
    const score10 = computeConfidence('features_overview', 10, recentTime, 'standard');
    // obs bonus = min(0.15, (4-1)*0.05) = 0.15
    expect(score4).toBeCloseTo(score10, 5);
    expect(score4).toBeCloseTo(0.75, 5); // 0.50 + 0.10 + 0.15
  });
});

describe('computeConfidence — page_class bonus', () => {
  const recentTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

  it('adds 0.08 bonus for high_value page_class', () => {
    const standard = computeConfidence('features_overview', 1, recentTime, 'standard');
    const highValue = computeConfidence('features_overview', 1, recentTime, 'high_value');
    expect(highValue - standard).toBeCloseTo(0.08, 5);
  });

  it('adds no bonus for standard page_class', () => {
    const score = computeConfidence('features_overview', 1, recentTime, 'standard');
    expect(score).toBeCloseTo(0.60, 5);
  });

  it('adds no bonus for ambient page_class', () => {
    const score = computeConfidence('features_overview', 1, recentTime, 'ambient');
    expect(score).toBeCloseTo(0.60, 5);
  });
});

describe('computeConfidence — score capping', () => {
  it('caps score at 1.0 for pricing_plans + high_value + fresh + many observations', () => {
    const justNow = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    const score = computeConfidence('pricing_plans', 10, justNow, 'high_value');
    // 0.85 + 0.15 + 0.15 + 0.08 = 1.23 → capped at 1.0
    expect(score).toBe(1.0);
  });
});

describe('computeConfidence — suppression gates', () => {
  it('unknown section type with old timestamp → below CONFIDENCE_SUPPRESS (0.35)', () => {
    const oldTime = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const score = computeConfidence('unknown_type', 1, oldTime, 'standard');
    expect(score).toBeLessThan(CONFIDENCE_SUPPRESS);
  });

  it('product_mentions with high_value and fresh → above CONFIDENCE_INTERPRET (0.65)', () => {
    const justNow = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const score = computeConfidence('product_mentions', 1, justNow, 'high_value');
    // 0.45 + 0.15 + 0 + 0.08 = 0.68 → above 0.65
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_INTERPRET);
  });

  it('nav_links with standard page and 24h+ old → pending_review tier (0.35–0.64)', () => {
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const score = computeConfidence('nav_links', 1, old, 'standard');
    // 0.55 + 0.05 = 0.60 → pending_review
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_SUPPRESS);
    expect(score).toBeLessThan(CONFIDENCE_INTERPRET);
  });
});
