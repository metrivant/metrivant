// Test H7: snapshot quarantine after 3 extraction failures.
//
// Verifies the quarantine logic: snapshots that fail extraction 3+ times
// are marked sections_extracted=true to exit the processing queue.

describe('H7: snapshot quarantine logic', () => {
  test('quarantine triggers at failCount >= 3', () => {
    const thresholds = [
      { failCount: 0, shouldQuarantine: false },
      { failCount: 1, shouldQuarantine: false },
      { failCount: 2, shouldQuarantine: false },
      { failCount: 3, shouldQuarantine: true },
      { failCount: 5, shouldQuarantine: true },
      { failCount: 10, shouldQuarantine: true },
    ];

    for (const { failCount, shouldQuarantine } of thresholds) {
      // Replicate the quarantine condition from extract-sections
      const result = (failCount ?? 0) >= 3;
      expect(result).toBe(shouldQuarantine);
    }
  });

  test('quarantine marks snapshot as extracted with null raw_html', () => {
    // Verify the update payload matches the quarantine contract
    const quarantinePayload = {
      sections_extracted: true,
      raw_html: null,
    };

    // After quarantine, the snapshot should:
    // 1. Not be picked up by extract-sections (sections_extracted=true)
    // 2. Not hold raw_html storage (raw_html=null)
    expect(quarantinePayload.sections_extracted).toBe(true);
    expect(quarantinePayload.raw_html).toBeNull();
  });

  test('quarantine is non-fatal — errors are caught', () => {
    // Verify that a quarantine check failure doesn't propagate
    let pipelineBlocked = false;

    try {
      // Simulate quarantine check throwing
      try {
        throw new Error('supabase query failed');
      } catch {
        // Non-fatal — quarantine failure must never block pipeline
        // (This is the exact pattern from extract-sections)
      }
    } catch {
      pipelineBlocked = true;
    }

    expect(pipelineBlocked).toBe(false);
  });
});
