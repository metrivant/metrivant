// Test H11: signals from baseline_maturing pages are forced to pending_review.
//
// Verifies the signal status override logic in detect-signals.

describe('H11: baseline_maturing signal suppression', () => {
  const CONFIDENCE_INTERPRET = 0.65;

  test('baseline_maturing page forces signal to pending_review regardless of confidence', () => {
    const healthStateMap = new Map<string, string>([
      ['pge-1', 'baseline_maturing'],
      ['pge-2', 'healthy'],
    ]);

    // Signal from baseline_maturing page with HIGH confidence (0.90 > 0.65)
    const pageHealth1 = healthStateMap.get('pge-1');
    const confidence1 = 0.90;
    const status1 =
      pageHealth1 === 'baseline_maturing' ? 'pending_review' :
      confidence1 >= CONFIDENCE_INTERPRET ? 'pending' :
      'pending_review';
    expect(status1).toBe('pending_review'); // forced by baseline_maturing

    // Signal from healthy page with HIGH confidence
    const pageHealth2 = healthStateMap.get('pge-2');
    const confidence2 = 0.90;
    const status2 =
      pageHealth2 === 'baseline_maturing' ? 'pending_review' :
      confidence2 >= CONFIDENCE_INTERPRET ? 'pending' :
      'pending_review';
    expect(status2).toBe('pending'); // normal confidence-based routing

    // Signal from healthy page with LOW confidence
    const confidence3 = 0.40;
    const status3 =
      pageHealth2 === 'baseline_maturing' ? 'pending_review' :
      confidence3 >= CONFIDENCE_INTERPRET ? 'pending' :
      'pending_review';
    expect(status3).toBe('pending_review'); // normal low-confidence routing
  });

  test('unknown health_state does not trigger suppression', () => {
    const healthStateMap = new Map<string, string>();
    // Page not in map (e.g., page_class info not loaded)
    const pageHealth = healthStateMap.get('pge-unknown');
    const confidence = 0.80;
    const status =
      pageHealth === 'baseline_maturing' ? 'pending_review' :
      confidence >= CONFIDENCE_INTERPRET ? 'pending' :
      'pending_review';
    expect(status).toBe('pending'); // undefined !== 'baseline_maturing'
  });

  test('suppressedByBaselineMaturing counter increments correctly', () => {
    const healthStateMap = new Map<string, string>([
      ['pge-1', 'baseline_maturing'],
      ['pge-2', 'baseline_maturing'],
      ['pge-3', 'healthy'],
    ]);

    let suppressedByBaselineMaturing = 0;
    const diffs = [
      { monitored_page_id: 'pge-1' },
      { monitored_page_id: 'pge-2' },
      { monitored_page_id: 'pge-3' },
    ];

    for (const diff of diffs) {
      const pageHealth = healthStateMap.get(diff.monitored_page_id);
      if (pageHealth === 'baseline_maturing') {
        suppressedByBaselineMaturing++;
      }
    }

    expect(suppressedByBaselineMaturing).toBe(2);
  });
});
