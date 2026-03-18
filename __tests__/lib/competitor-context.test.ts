import '../helpers/env';

// Mock supabase before importing the module under test
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { formatContextForPrompt } from '../../lib/competitor-context';
import type { CompetitorContext } from '../../lib/competitor-context';

function makeContext(overrides: Partial<CompetitorContext> = {}): CompetitorContext {
  return {
    competitor_id: 'cmp-001',
    org_id: 'org-001',
    competitor_name: 'Acme Corp',
    hypothesis: 'Moving upmarket to enterprise',
    confidence_level: 'medium',
    evidence_trail: [],
    open_questions: [],
    strategic_arc: null,
    signal_count: 0,
    last_updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('formatContextForPrompt', () => {
  it('includes competitor name in output header', () => {
    const ctx = makeContext();
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('Acme Corp');
  });

  it('includes hypothesis when present', () => {
    const ctx = makeContext({ hypothesis: 'Moving upmarket to enterprise' });
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('Moving upmarket to enterprise');
  });

  it('includes confidence level alongside hypothesis', () => {
    const ctx = makeContext({ confidence_level: 'high', hypothesis: 'Aggressive pricing play' });
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('high confidence');
  });

  it('omits hypothesis section when hypothesis is null', () => {
    const ctx = makeContext({ hypothesis: null });
    const output = formatContextForPrompt(ctx);
    expect(output).not.toContain('Hypothesis');
  });

  it('shows last 5 evidence items only — ignores older ones', () => {
    const evidence = Array.from({ length: 8 }, (_, i) => ({
      date: `2025-01-0${i + 1}`,
      signal_type: 'price_point_change',
      summary: `Evidence item ${i + 1}`,
      verdict: 'validates' as const,
    }));
    const ctx = makeContext({ evidence_trail: evidence });
    const output = formatContextForPrompt(ctx);
    // Items 4–8 (last 5) should be present; items 1–3 should not
    expect(output).toContain('Evidence item 4');
    expect(output).toContain('Evidence item 8');
    expect(output).not.toContain('Evidence item 1');
  });

  it('includes open questions truncated to first 2', () => {
    const ctx = makeContext({
      open_questions: ['Q1 first', 'Q2 second', 'Q3 third', 'Q4 fourth'],
    });
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('Q1 first');
    expect(output).toContain('Q2 second');
    expect(output).not.toContain('Q3 third');
  });

  it('includes strategic_arc when set', () => {
    const ctx = makeContext({ strategic_arc: 'Expanding into European markets' });
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('Expanding into European markets');
  });

  it('omits strategic_arc section when null', () => {
    const ctx = makeContext({ strategic_arc: null });
    const output = formatContextForPrompt(ctx);
    expect(output).not.toContain('Strategic arc');
  });

  it('outputs === END CONTEXT === footer', () => {
    const ctx = makeContext();
    const output = formatContextForPrompt(ctx);
    expect(output).toContain('=== END CONTEXT ===');
  });

  it('handles empty evidence_trail without throwing', () => {
    const ctx = makeContext({ evidence_trail: [] });
    expect(() => formatContextForPrompt(ctx)).not.toThrow();
  });
});
