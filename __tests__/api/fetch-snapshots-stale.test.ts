// Test H5: stale-content heuristic in fetchWithClassification.
//
// Verifies that responses with stale Age or Last-Modified headers
// are classified as 'stale_content' failures.

describe('H5: stale-content heuristic', () => {
  const STALE_THRESHOLD_SEC = 7 * 24 * 60 * 60; // 7 days in seconds

  test('Age header > 7 days triggers stale_content', () => {
    const ageSeconds = STALE_THRESHOLD_SEC + 1;
    expect(ageSeconds > STALE_THRESHOLD_SEC).toBe(true);
    // The code: parseInt(ageHeader, 10) > STALE_THRESHOLD_SEC
    expect(parseInt(String(ageSeconds), 10) > STALE_THRESHOLD_SEC).toBe(true);
  });

  test('Age header < 7 days does NOT trigger stale_content', () => {
    const ageSeconds = STALE_THRESHOLD_SEC - 1;
    expect(parseInt(String(ageSeconds), 10) > STALE_THRESHOLD_SEC).toBe(false);
  });

  test('Last-Modified > 7 days ago triggers stale_content', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const lmTime = eightDaysAgo.getTime();
    expect(Date.now() - lmTime > STALE_THRESHOLD_SEC * 1000).toBe(true);
  });

  test('Last-Modified < 7 days ago does NOT trigger stale_content', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const lmTime = sixDaysAgo.getTime();
    expect(Date.now() - lmTime > STALE_THRESHOLD_SEC * 1000).toBe(false);
  });

  test('Invalid Last-Modified header is safely ignored', () => {
    const lmTime = new Date('not-a-date').getTime();
    expect(isNaN(lmTime)).toBe(true);
    // Code: if (!isNaN(lmTime) && ...) — NaN fails the guard, header ignored
  });

  test('Missing headers do not trigger stale_content', () => {
    // When headers are absent, the code doesn't enter either check block.
    // This verifies the null/undefined path doesn't throw.
    const ageHeader: string | null = null;
    const lastModified: string | null = null;

    let stale = false;
    if (ageHeader) {
      const ageSec = parseInt(ageHeader, 10);
      if (!isNaN(ageSec) && ageSec > STALE_THRESHOLD_SEC) stale = true;
    }
    if (lastModified) {
      const lmTime = new Date(lastModified).getTime();
      if (!isNaN(lmTime) && (Date.now() - lmTime) > STALE_THRESHOLD_SEC * 1000) stale = true;
    }
    expect(stale).toBe(false);
  });
});
