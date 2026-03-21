// Automated scoring system for competitor suggestions.
//
// Scores each discovered entity on a 0.0–1.0 scale based on:
//   1. Article frequency (more mentions = higher)
//   2. Source diversity (more distinct sources = higher)
//   3. Recency (recent mentions score higher)
//   4. Domain discoverability (has a website = higher)
//
// Decision thresholds:
//   score >= 0.70 → auto-accept (trigger onboarding)
//   score <  0.35 → auto-reject (too weak to track)
//   0.35–0.69     → pending (visible in ops dashboard for manual review)

// ── Config ────────────────────────────────────────────────────────────────────

const ACCEPT_THRESHOLD = 0.70;
const REJECT_THRESHOLD = 0.35;

// Weight distribution (must sum to 1.0)
const W_ARTICLES = 0.30;  // article frequency
const W_SOURCES  = 0.30;  // source diversity
const W_RECENCY  = 0.20;  // how recent the mentions are
const W_DOMAIN   = 0.20;  // has a discoverable domain

// Normalization caps
const MAX_ARTICLES_FOR_FULL_SCORE = 10;  // 10+ articles = max score
const MAX_SOURCES_FOR_FULL_SCORE  = 5;   // 5+ sources = max score
const RECENCY_HALF_LIFE_DAYS      = 7;   // score halves every 7 days

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoringInput {
  articleCount:  number;
  sourceCount:   number;
  lastSeenAt:    Date;
  hasDomain:     boolean;
}

export interface ScoringResult {
  score:          number;
  decision:       "accept" | "reject" | "pending";
  reason:         string;
  breakdown: {
    article_weight:  number;
    source_weight:   number;
    recency_weight:  number;
    domain_weight:   number;
  };
}

// ── Scorer ────────────────────────────────────────────────────────────────────

export function scoreCompetitorSuggestion(input: ScoringInput): ScoringResult {
  // Article frequency: linear ramp to max
  const articleScore = Math.min(1.0, input.articleCount / MAX_ARTICLES_FOR_FULL_SCORE);

  // Source diversity: linear ramp to max
  const sourceScore = Math.min(1.0, input.sourceCount / MAX_SOURCES_FOR_FULL_SCORE);

  // Recency: exponential decay from last mention
  const ageDays = (Date.now() - input.lastSeenAt.getTime()) / (24 * 60 * 60 * 1000);
  const recencyScore = Math.exp(-ageDays * (Math.LN2 / RECENCY_HALF_LIFE_DAYS));

  // Domain: binary
  const domainScore = input.hasDomain ? 1.0 : 0.0;

  // Weighted sum
  const score = Math.round((
    articleScore * W_ARTICLES +
    sourceScore  * W_SOURCES +
    recencyScore * W_RECENCY +
    domainScore  * W_DOMAIN
  ) * 1000) / 1000;

  // Decision
  let decision: "accept" | "reject" | "pending";
  let reason: string;

  if (score >= ACCEPT_THRESHOLD) {
    decision = "accept";
    reason = `score ${score} >= ${ACCEPT_THRESHOLD} (${input.articleCount} articles, ${input.sourceCount} sources)`;
  } else if (score < REJECT_THRESHOLD) {
    decision = "reject";
    reason = `score ${score} < ${REJECT_THRESHOLD} (insufficient evidence)`;
  } else {
    decision = "pending";
    reason = `score ${score} between thresholds (manual review recommended)`;
  }

  return {
    score,
    decision,
    reason,
    breakdown: {
      article_weight:  Math.round(articleScore * W_ARTICLES * 1000) / 1000,
      source_weight:   Math.round(sourceScore * W_SOURCES * 1000) / 1000,
      recency_weight:  Math.round(recencyScore * W_RECENCY * 1000) / 1000,
      domain_weight:   Math.round(domainScore * W_DOMAIN * 1000) / 1000,
    },
  };
}

export { ACCEPT_THRESHOLD, REJECT_THRESHOLD };
