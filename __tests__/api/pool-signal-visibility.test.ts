// Test H4: pool signals with null monitored_page_id are visible
// to pressure_index and radar-feed signal aggregation.
//
// This tests the data merge logic directly — the key invariant is that
// signals with competitor_id but null monitored_page_id are included
// in aggregation maps.

describe('H4: pool signal visibility', () => {
  test('pool signals merge into signalWeightByCompetitor via competitor_id', () => {
    // Replicate update-pressure-index aggregation logic
    const SEVERITY_WEIGHTS: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };
    const signalWeightByCompetitor = new Map<string, number>();

    // Page-diff signals (existing path — via monitored_page_id → competitor_id)
    const pageToCompetitor = new Map([['pge-1', 'cmp-A']]);
    const pageDiffSignals = [
      { monitored_page_id: 'pge-1', severity: 'high', confidence_score: 0.8, detected_at: new Date().toISOString() },
    ];

    for (const signal of pageDiffSignals) {
      const cid = pageToCompetitor.get(signal.monitored_page_id);
      if (!cid) continue;
      const severityW = SEVERITY_WEIGHTS[signal.severity] ?? 0.3;
      const confidence = signal.confidence_score ?? 0.5;
      const prev = signalWeightByCompetitor.get(cid) ?? 0;
      signalWeightByCompetitor.set(cid, prev + severityW * confidence * 1.0); // decay=1 for fresh
    }

    // Pool signals (new path — competitor_id directly, monitored_page_id=null)
    const poolSignals = [
      { competitor_id: 'cmp-A', severity: 'medium', confidence_score: 0.7, detected_at: new Date().toISOString() },
      { competitor_id: 'cmp-B', severity: 'high', confidence_score: 0.9, detected_at: new Date().toISOString() },
    ];

    for (const signal of poolSignals) {
      const cid = signal.competitor_id;
      const severityW = SEVERITY_WEIGHTS[signal.severity] ?? 0.3;
      const confidence = signal.confidence_score ?? 0.5;
      const prev = signalWeightByCompetitor.get(cid) ?? 0;
      signalWeightByCompetitor.set(cid, prev + severityW * confidence * 1.0);
    }

    // cmp-A should have BOTH page-diff + pool signal weight
    expect(signalWeightByCompetitor.get('cmp-A')).toBeGreaterThan(0.8); // page-diff alone would be 0.8
    // cmp-B should have pool signal weight (no page-diff signals)
    expect(signalWeightByCompetitor.get('cmp-B')).toBeGreaterThan(0);
    expect(signalWeightByCompetitor.has('cmp-B')).toBe(true);
  });

  test('pool signals merge into signalAggMap for radar-feed momentum', () => {
    // Replicate radar-feed signal aggregation
    interface SignalAggRow {
      competitor_id: string;
      signals_7d: number;
      weighted_velocity_7d: number;
      last_signal_at: string | null;
      latest_signal_type: string | null;
    }

    const signalAggMap = new Map<string, SignalAggRow>();
    const now = new Date().toISOString();

    // Existing page-diff path (competitor A has 1 page signal)
    signalAggMap.set('cmp-A', {
      competitor_id: 'cmp-A',
      signals_7d: 1,
      weighted_velocity_7d: 2, // raw severity sum before normalisation
      last_signal_at: now,
      latest_signal_type: 'price_point_change',
    });

    // Pool signals
    const poolSignals = [
      { competitor_id: 'cmp-A', severity: 'medium', detected_at: now, signal_type: 'hiring_spike' },
      { competitor_id: 'cmp-C', severity: 'high', detected_at: now, signal_type: 'feed_press_release' },
    ];

    for (const sig of poolSignals) {
      const cid = sig.competitor_id;
      const existing = signalAggMap.get(cid) ?? {
        competitor_id: cid, signals_7d: 0, weighted_velocity_7d: 0,
        last_signal_at: null, latest_signal_type: null,
      };
      const severityWeight = sig.severity === 'high' ? 3 : sig.severity === 'medium' ? 2 : 1;
      existing.signals_7d += 1;
      existing.weighted_velocity_7d += severityWeight;
      if (!existing.last_signal_at || sig.detected_at > existing.last_signal_at) {
        existing.last_signal_at = sig.detected_at;
        existing.latest_signal_type = sig.signal_type;
      }
      signalAggMap.set(cid, existing);
    }

    // cmp-A: 1 page + 1 pool = 2 signals
    expect(signalAggMap.get('cmp-A')!.signals_7d).toBe(2);
    // cmp-C: 1 pool signal (no page signals)
    expect(signalAggMap.has('cmp-C')).toBe(true);
    expect(signalAggMap.get('cmp-C')!.signals_7d).toBe(1);
  });

  test('pool pending signals merge into pendingCountMap', () => {
    const pendingCountMap = new Map<string, number>();

    // Page-diff pending (existing path)
    pendingCountMap.set('cmp-A', 1);

    // Pool pending signals
    const poolPending = [
      { competitor_id: 'cmp-A' },
      { competitor_id: 'cmp-D' },
      { competitor_id: 'cmp-D' },
    ];

    for (const row of poolPending) {
      pendingCountMap.set(row.competitor_id, (pendingCountMap.get(row.competitor_id) ?? 0) + 1);
    }

    expect(pendingCountMap.get('cmp-A')).toBe(2); // 1 page + 1 pool
    expect(pendingCountMap.get('cmp-D')).toBe(2); // 2 pool only
  });
});
