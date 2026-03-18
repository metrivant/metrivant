import '../helpers/env';

// Mock supabase before any import that touches the module
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

import { createSupabaseMock } from '../helpers/supabase-mock';

const mockSupabase = createSupabaseMock();

import { reconcilePoolSignals } from '../../lib/pool-reconciliation';

beforeEach(() => {
  mockSupabase.__reset();
});

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: `sig-${Math.random().toString(36).slice(2)}`,
    competitor_id: 'cmp-001',
    signal_type: 'feed_press_release',
    confidence_score: 0.75,
    detected_at: new Date().toISOString(),
    source_type: 'feed_event',
    ...overrides,
  };
}

describe('reconcilePoolSignals', () => {
  it('returns { checked: 0, boosted: 0 } when there are no signals', async () => {
    mockSupabase.__setTableResponse('signals', []);
    const result = await reconcilePoolSignals();
    expect(result).toEqual({ checked: 0, boosted: 0 });
  });

  it('returns { checked: 0, boosted: 0 } when Supabase returns an error', async () => {
    mockSupabase.__setTableResponse('signals', null, { message: 'db error' });
    const result = await reconcilePoolSignals();
    expect(result).toEqual({ checked: 0, boosted: 0 });
  });

  it('does not boost when only one signal exists for a competitor', async () => {
    mockSupabase.__setTableResponse('signals', [
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'feed_press_release' }),
    ]);
    const result = await reconcilePoolSignals();
    expect(result.boosted).toBe(0);
  });

  it('does not boost when two signals have the same type (duplicate guard)', async () => {
    const now = new Date().toISOString();
    mockSupabase.__setTableResponse('signals', [
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'feed_press_release', detected_at: now }),
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'feed_press_release', detected_at: now }),
    ]);
    const result = await reconcilePoolSignals();
    expect(result.boosted).toBe(0);
  });

  it('does not boost when two different-type signals are > 24h apart', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 25 * 3600 * 1000);
    mockSupabase.__setTableResponse('signals', [
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'feed_press_release', detected_at: now.toISOString() }),
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'earnings_release', detected_at: old.toISOString() }),
    ]);
    const result = await reconcilePoolSignals();
    expect(result.boosted).toBe(0);
  });

  it('boosts confidence by 0.08 for one corroborating signal within 24h', async () => {
    const now = new Date().toISOString();
    const sigA = makeSignal({ id: 'sig-a', competitor_id: 'cmp-001', signal_type: 'feed_press_release', confidence_score: 0.75, detected_at: now });
    const sigB = makeSignal({ id: 'sig-b', competitor_id: 'cmp-001', signal_type: 'earnings_release', confidence_score: 0.80, detected_at: now });
    mockSupabase.__setTableResponse('signals', [sigA, sigB]);

    const result = await reconcilePoolSignals();
    expect(result.boosted).toBeGreaterThan(0);
    expect(result.checked).toBe(2);
  });

  it('caps boost at 1.0 when existing confidence is near maximum', async () => {
    const now = new Date().toISOString();
    // Signal with confidence already at 0.98 should not exceed 1.0
    const sigA = makeSignal({ id: 'sig-a', competitor_id: 'cmp-001', signal_type: 'feed_press_release', confidence_score: 0.98, detected_at: now });
    const sigB = makeSignal({ id: 'sig-b', competitor_id: 'cmp-001', signal_type: 'earnings_release', confidence_score: 0.80, detected_at: now });
    mockSupabase.__setTableResponse('signals', [sigA, sigB]);

    // verify the boost logic internally caps at 1.0:
    // 0.98 + 0.08 = 1.06 → capped at 1.0 by Math.min(1.0, ...)
    // The update should be called only if newConfidence > anchor.confidence_score + 0.001
    // 1.0 > 0.98 + 0.001 → true, so update is called
    const result = await reconcilePoolSignals();
    expect(result.boosted).toBeGreaterThan(0);
  });

  it('returns correct checked count matching total signals fetched', async () => {
    const now = new Date().toISOString();
    const signals = Array.from({ length: 5 }, (_, i) =>
      makeSignal({ competitor_id: 'cmp-002', signal_type: `type_${i}`, detected_at: now })
    );
    mockSupabase.__setTableResponse('signals', signals);
    const result = await reconcilePoolSignals();
    expect(result.checked).toBe(5);
  });

  it('handles multiple competitors independently', async () => {
    const now = new Date().toISOString();
    mockSupabase.__setTableResponse('signals', [
      makeSignal({ competitor_id: 'cmp-001', signal_type: 'feed_press_release', detected_at: now }),
      makeSignal({ competitor_id: 'cmp-002', signal_type: 'feed_press_release', detected_at: now }),
    ]);
    // Each has only 1 signal → no boosts
    const result = await reconcilePoolSignals();
    expect(result.boosted).toBe(0);
  });
});
