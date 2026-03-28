# Sector System Optimization Analysis

## Current Architecture Review

### ✅ Strengths
1. **Comprehensive coverage**: 5 pipeline stages integrated
2. **Consistent pattern**: Pre-fetch sector, apply as multiplier/guidance
3. **Type-safe**: Full TypeScript strict mode compliance
4. **No schema changes**: Configuration-only approach
5. **Unified weighting**: All 5 sectors precision-aligned (6:1 max ratio, 0.10 max bonus)

### 🔄 Optimization Opportunities

#### 1. Sector Fetching Efficiency
**Current**: Each pipeline stage independently calls `getSectorForCompetitor()`
- interpret-signals.ts: batch fetch, Map<competitor_id, sector>
- update-pressure-index.ts: batch fetch, Map<competitor_id, sector>
- detect-signals.ts: batch fetch, Map<competitor_id, sector>

**Issue**: 3+ redundant sector lookups per pipeline run for same competitors

**Optimization**:
```typescript
// Option A: Pipeline-level sector cache (Redis/memory)
// Option B: Pass sector as metadata through pipeline stages
// Option C: Denormalize sector to competitors table (trade-off: stale data risk)

// Recommended: Option A (pipeline-level cache)
// - Cache TTL: 5 minutes (balances freshness vs performance)
// - Cache key: competitor_id
// - Invalidate on org sector change
```

**Impact**: Reduce Supabase queries by ~60% for sector lookups

#### 2. Configuration Duplication
**Current**: Two sector configuration modules
- `radar-ui/lib/sector-config.ts`: Comprehensive (60+ signal types, UI config, terminology)
- `lib/sector-weights.ts`: Runtime subset (signal/pool weights, confidence bonuses)

**Issue**: Manual sync required when adding new signal types or adjusting weights

**Optimization**:
```typescript
// Option A: Generate runtime config from UI config (build-time)
// Option B: Shared @metrivant/sector-config package
// Option C: Runtime imports UI config (surface ownership violation)

// Recommended: Option A (build-time generation)
// - Script: scripts/generate-runtime-sector-config.ts
// - Input: radar-ui/lib/sector-config.ts
// - Output: lib/sector-weights.ts (auto-generated, do not edit)
// - Run: pre-commit hook + CI validation
```

**Impact**: Single source of truth, zero drift risk

#### 3. Sector Amplification Observability
**Current**: Sector weighting applied silently in pipeline

**Issue**: No visibility into sector-specific amplification in action

**Optimization**:
```typescript
// Add sector metadata to pipeline_events table
interface PipelineEvent {
  // ... existing fields
  sector?: string;
  sector_signal_weight?: number;  // Applied multiplier
  sector_pool_weight?: number;    // Applied multiplier
  sector_confidence_bonus?: number; // Applied bonus
}

// Track sector-boosted signals
await recordEvent({
  run_id: runId,
  stage: "signal",
  status: "success",
  metadata: {
    sector: sector,
    signal_weight_applied: sectorWeight, // e.g., 2.5 for fintech regulatory
    confidence_bonus_applied: sectorBonus, // e.g., 0.10
  }
});
```

**Impact**: Audit trail for sector amplification, debugging, performance analysis

#### 4. Sector Validation & Migration
**Current**: No validation that `organizations.sector` matches `SectorId` type

**Issue**: Typos or invalid values cause fallback to default (saas)

**Optimization**:
```typescript
// Migration: Add CHECK constraint
ALTER TABLE organizations
  ADD CONSTRAINT organizations_sector_check
    CHECK (sector IN ('saas', 'fintech', 'cybersecurity', 'defense', 'energy', 'custom'));

// Runtime validation helper
export function validateSector(sector: string | null): SectorId | null {
  const valid: SectorId[] = ['saas', 'fintech', 'cybersecurity', 'defense', 'energy', 'custom'];
  return sector && valid.includes(sector as SectorId) ? (sector as SectorId) : null;
}
```

**Impact**: Data integrity, prevents silent fallback behavior

#### 5. Sector-Specific Noise Suppression
**Current**: Noise rules are org-scoped, not sector-aware

**Issue**: Generic noise patterns applied uniformly across sectors

**Optimization**:
```typescript
// Sector-specific noise baselines
// Example: Defense sector tolerates more "contract" keyword churn
// Example: Fintech sector suppresses more "compliance" boilerplate

interface SectorNoiseProfile {
  sector: SectorId;
  dynamic_content_tolerance: number;  // 0.0-1.0
  keyword_allowlist: string[];        // Sector-specific terms to preserve
  keyword_blocklist: string[];        // Sector-specific noise terms
}

// Apply in detect-signals noise gates
if (sector === 'defense' && text.includes('contract')) {
  // Higher tolerance for contract language churn
  dynamicContentThreshold *= 1.5;
}
```

**Impact**: Fewer false positives per sector, better signal quality

## Synergy Opportunities

### 1. Sector + Pool Integration
**Current**: Pools and sector weighting are separate concerns

**Enhancement**: Pool priorities should auto-adjust per sector
```typescript
// Auto-enable high-weight pools for new competitors
async function onboardCompetitor(competitor: Competitor, sector: SectorId) {
  const poolWeights = getSectorConfig(sector).poolWeights;

  // Enable pools with weight >= 5.0 automatically
  const priorityPools = Object.entries(poolWeights)
    .filter(([_, weight]) => weight >= 5.0)
    .map(([pool]) => pool);

  // Seed feeds for priority pools
  for (const pool of priorityPools) {
    await seedFeedForPool(competitor, pool);
  }
}
```

### 2. Sector + Baseline Maturity
**Current**: Baseline maturity suppression is uniform

**Enhancement**: Sector-specific maturity windows
```typescript
// Fast-moving sectors (SaaS, Cybersecurity): 3-day baseline window
// Slow-moving sectors (Defense, Energy): 7-day baseline window

const baselineWindow = getSectorConfig(sector).patternThresholds.baselineMaturityDays;
// Use in health_state = 'baseline_maturing' logic
```

### 3. Sector + Movement Clustering
**Current**: Movement detection uses generic 14d window + 2-signal minimum

**Enhancement**: Sector-specific clustering parameters
```typescript
// High-velocity sectors: 7d window, 3-signal minimum
// Strategic sectors: 21d window, 2-signal minimum

const movementWindow = getSectorConfig(sector).movementDetection.windowDays;
const minSignals = getSectorConfig(sector).movementDetection.minSignals;
```

## Implementation Priority

**High Priority (Next Session):**
1. ✅ Sector amplification observability (pipeline_events metadata)
2. ✅ Configuration duplication fix (build-time generation)
3. ✅ Sector validation (CHECK constraint + helper)

**Medium Priority (Future):**
4. Sector fetching cache (Redis or memory cache)
5. Sector-specific noise suppression profiles

**Low Priority (Nice-to-have):**
6. Sector + pool auto-prioritization
7. Sector-specific baseline maturity windows
8. Sector-specific movement clustering

## Measurement

Track sector system impact via:
- Sector-boosted signal count per run
- Confidence bonus application rate
- Pressure amplification distribution
- Movement narrative quality (manual review)
- Positioning accuracy (operator feedback)
