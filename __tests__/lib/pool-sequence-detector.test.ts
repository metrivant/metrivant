import '../helpers/env';

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

import { createSupabaseMock } from '../helpers/supabase-mock';

const mockSupabase = createSupabaseMock();

import { detectPoolSequences } from '../../lib/pool-sequence-detector';

beforeEach(() => {
  mockSupabase.__reset();
});

function makePoolEvent(competitorId: string, sourceType: string, daysAgo = 1): Record<string, unknown> {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    competitor_id: competitorId,
    source_type: sourceType,
    event_type: 'event',
    created_at: new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString(),
  };
}

describe('detectPoolSequences', () => {
  it('returns { checked: 0, sequencesFound: 0 } when no pool events exist', async () => {
    mockSupabase.__setTableResponse('pool_events', []);
    const result = await detectPoolSequences();
    expect(result).toEqual({ checked: 0, sequencesFound: 0 });
  });

  it('returns { checked: 0, sequencesFound: 0 } when Supabase returns error', async () => {
    mockSupabase.__setTableResponse('pool_events', null, { message: 'db error' });
    const result = await detectPoolSequences();
    expect(result).toEqual({ checked: 0, sequencesFound: 0 });
  });

  it('does not detect hiring_build_plus_product_launch when only careers events present', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'careers'),
      makePoolEvent('cmp-001', 'careers'),
    ]);
    // activity_events has no existing sequences
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    expect(result.sequencesFound).toBe(0);
  });

  it('does not detect hiring_build_plus_product_launch when only product events present', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'product'),
      makePoolEvent('cmp-001', 'product'),
    ]);
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    expect(result.sequencesFound).toBe(0);
  });

  it('detects hiring_build_plus_product_launch when both careers and product events present', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'careers'),
      makePoolEvent('cmp-001', 'product'),
    ]);
    // No existing sequences for this competitor
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    expect(result.checked).toBe(2);
    expect(result.sequencesFound).toBeGreaterThan(0);
  });

  it('detects full_campaign when newsroom + investor + product all present', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'newsroom'),
      makePoolEvent('cmp-001', 'investor'),
      makePoolEvent('cmp-001', 'product'),
    ]);
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    expect(result.sequencesFound).toBeGreaterThan(0);
  });

  it('returns checked count equal to total pool_events fetched', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'newsroom'),
      makePoolEvent('cmp-002', 'careers'),
      makePoolEvent('cmp-003', 'investor'),
    ]);
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    expect(result.checked).toBe(3);
  });

  it('deduplicates: does not fire again if sequence already recorded within 7 days', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'careers'),
      makePoolEvent('cmp-001', 'product'),
    ]);

    // Simulate existing sequence already recorded
    mockSupabase.__setTableResponse('activity_events', [
      {
        id: 'ae-001',
        competitor_id: 'cmp-001',
        event_type: 'multi_pool_sequence',
        raw_data: { sequence_name: 'hiring_build_plus_product_launch' },
        detected_at: new Date().toISOString(),
      },
    ]);

    const result = await detectPoolSequences();
    // sequencesFound should be 0 since the sequence is already recorded
    expect(result.sequencesFound).toBe(0);
  });

  it('does not detect full_campaign when only 2 of 3 required pool types present', async () => {
    mockSupabase.__setTableResponse('pool_events', [
      makePoolEvent('cmp-001', 'newsroom'),
      makePoolEvent('cmp-001', 'investor'),
      // missing 'product'
    ]);
    mockSupabase.__setTableResponse('activity_events', []);

    const result = await detectPoolSequences();
    // hiring_build_plus_product_launch also won't fire (needs careers+product)
    // contract_win_plus_investor_announcement needs procurement+investor
    // regulatory_filing_plus_newsroom needs regulatory+newsroom
    // full_campaign needs all 3
    // → no sequences should fire
    expect(result.sequencesFound).toBe(0);
  });
});
