import '../helpers/env';

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

jest.mock('../../lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    captureCheckIn: jest.fn(),
    setContext: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    withScope: jest.fn(),
    init: jest.fn(),
  },
}));

// pipeline-metrics writes to supabase — mock it to prevent noise
jest.mock('../../lib/pipeline-metrics', () => ({
  recordEvent: jest.fn(),
  startTimer: jest.fn(() => jest.fn().mockReturnValue(10)),
  generateRunId: jest.fn().mockReturnValue('run-test-001'),
}));

// rate-limit module uses in-process state — mock to always allow
jest.mock('../../lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { PER_IP: 60, PER_USER: 120 },
}));

import { createSupabaseMock } from '../helpers/supabase-mock';
import { FIXTURE } from '../helpers/fixtures';

const mockSupabase = createSupabaseMock();

import handler from '../../api/detect-signals';

const AUTH_REQ = FIXTURE.makeAuthRequest();

beforeEach(() => {
  mockSupabase.__reset();
  jest.clearAllMocks();
});

// Configure the baseline set of Supabase responses for detect-signals.
// detect-signals makes these calls in order:
//   1. section_diffs (stale diff diagnostic) — count query
//   2. section_diffs (high_value batch) — returns diffs
//   3. section_diffs (standard batch) — returns diffs
//   4. page_sections (bulk section text) — returns section rows
//   5. signals (existing hash check) — returns existing hashes
//   6. signals (upsert) — per diff
//   7. section_diffs (update signal_detected) — per diff

function setupNoDiffs() {
  mockSupabase.__setTableResponse('section_diffs', [], null, 0);
  mockSupabase.__setTableResponse('page_sections', []);
  mockSupabase.__setTableResponse('signals', []);
}

describe('detect-signals handler — auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = FIXTURE.makeRequest({});
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 401 when Bearer token is wrong', async () => {
    const req = FIXTURE.makeRequest({ authorization: 'Bearer wrong' });
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('proceeds past auth with correct Bearer token', async () => {
    setupNoDiffs();
    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('detect-signals handler — no diffs', () => {
  it('returns signalsCreated: 0 when there are no eligible diffs', async () => {
    setupNoDiffs();
    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.signalsCreated).toBe(0);
    expect(body.rowsClaimed).toBe(0);
  });

  it('response includes all expected fields', async () => {
    setupNoDiffs();
    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('job', 'detect-signals');
    expect(body).toHaveProperty('signalsCreated');
    expect(body).toHaveProperty('signalsSuppressed');
    expect(body).toHaveProperty('suppressedByNoise');
    expect(body).toHaveProperty('suppressedByLowConfidence');
    expect(body).toHaveProperty('signalsDeduplicated');
    expect(body).toHaveProperty('signalsPendingReview');
    expect(body).toHaveProperty('suppressionBreakdown');
    expect(body).toHaveProperty('runtimeDurationMs');
  });
});

describe('detect-signals handler — noise suppression', () => {
  it('suppresses whitespace-only diff and does not create a signal', async () => {
    const prevText = 'Pro plan: $99/month';
    const currText = '  Pro   plan:  $99/month  '; // same content, different whitespace

    const diff = FIXTURE.sectionDiff({
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      page_class: 'high_value',
    });

    // section_diffs diagnostic (count query), then high_value batch, then standard batch
    mockSupabase.__setTableResponse('section_diffs', [diff], null, 1);
    mockSupabase.__setTableResponse('page_sections', [
      { id: FIXTURE.SECTION_ID_PREV, section_text: prevText, section_hash: 'prev001' },
      { id: FIXTURE.SECTION_ID_CURR, section_text: currText, section_hash: 'curr001' },
    ]);
    mockSupabase.__setTableResponse('signals', []);

    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.signalsCreated).toBe(0);
    expect(body.suppressedByNoise).toBeGreaterThan(0);
  });

  it('suppresses dynamic-content-only diff (ISO timestamp rotation)', async () => {
    // Content differs only in ISO timestamp — semantic content is identical
    const prevText = 'Updated 2024-01-01T10:00:00Z — Pro plan: $99/month';
    const currText = 'Updated 2024-06-15T14:00:00Z — Pro plan: $99/month';

    const diff = FIXTURE.sectionDiff({
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      page_class: 'high_value',
    });

    mockSupabase.__setTableResponse('section_diffs', [diff], null, 1);
    mockSupabase.__setTableResponse('page_sections', [
      { id: FIXTURE.SECTION_ID_PREV, section_text: prevText, section_hash: 'prev002' },
      { id: FIXTURE.SECTION_ID_CURR, section_text: currText, section_hash: 'curr002' },
    ]);
    mockSupabase.__setTableResponse('signals', []);

    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.signalsCreated).toBe(0);
    expect(body.suppressedByNoise).toBeGreaterThan(0);
  });
});

describe('detect-signals handler — confidence gates', () => {
  it('suppresses diff with unknown section type (low confidence < 0.35)', async () => {
    // unknown_section_type → DEFAULT_WEIGHT 0.25 + old timestamp 0.05 = 0.30 < 0.35 suppress
    const oldTime = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const diff = FIXTURE.sectionDiff({
      section_type: 'unknown_section_xyz',
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      page_class: 'standard',
      observation_count: 1,
      last_seen_at: oldTime,
    });

    mockSupabase.__setTableResponse('section_diffs', [diff], null, 1);
    mockSupabase.__setTableResponse('page_sections', [
      { id: FIXTURE.SECTION_ID_PREV, section_text: 'Old content here', section_hash: 'prev003' },
      { id: FIXTURE.SECTION_ID_CURR, section_text: 'New content here', section_hash: 'curr003' },
    ]);
    mockSupabase.__setTableResponse('signals', []);

    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.signalsCreated).toBe(0);
    expect(body.suppressedByLowConfidence).toBeGreaterThan(0);
  });

  it('creates a pending signal for high-confidence diff (pricing_plans + high_value)', async () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

    const diff = FIXTURE.sectionDiff({
      section_type: 'pricing_plans',
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      page_class: 'high_value',
      observation_count: 1,
      last_seen_at: recentTime,
    });

    // The handler runs two batch queries for section_diffs (high_value + standard).
    // Our global mock returns the same diff for both, so rowsClaimed may be 2.
    // We assert signalsCreated >= 1 (at least one signal fires from the eligible diff).
    mockSupabase.__setTableResponse('section_diffs', [diff], null, 1);
    mockSupabase.__setTableResponse('page_sections', [
      { id: FIXTURE.SECTION_ID_PREV, section_text: 'Pro plan: $99/month', section_hash: 'prev004' },
      { id: FIXTURE.SECTION_ID_CURR, section_text: 'Pro plan: $129/month', section_hash: 'curr004' },
    ]);
    // No existing signal hashes — this should be a new signal
    mockSupabase.__setTableResponse('signals', []);

    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.signalsCreated).toBeGreaterThanOrEqual(1);
    expect(body.suppressedByNoise).toBe(0);
    expect(body.suppressedByLowConfidence).toBe(0);
  });
});

describe('detect-signals handler — deduplication', () => {
  it('suppresses diff when signal hash already exists', async () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const diff = FIXTURE.sectionDiff({
      section_type: 'pricing_plans',
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      page_class: 'high_value',
      observation_count: 1,
      last_seen_at: recentTime,
    });

    mockSupabase.__setTableResponse('section_diffs', [diff], null, 1);
    mockSupabase.__setTableResponse('page_sections', [
      { id: FIXTURE.SECTION_ID_PREV, section_text: 'Pro plan: $99/month', section_hash: 'prev005' },
      { id: FIXTURE.SECTION_ID_CURR, section_text: 'Pro plan: $129/month', section_hash: 'curr005' },
    ]);
    // Return a matching hash — simulates existing signal
    // The actual hash is sha256(competitorId:signal_type:section_type:diffId)[:32]
    // We need to return any hash from the signals table to block creation.
    // Since the mock returns whatever we set, we populate signals with a placeholder
    // and rely on the batch-hash-check flow to deduplicate.
    // For this test we simulate the existingHashSet having the hash pre-loaded
    // by returning the computed hash from the signals query.
    // The exact hash value is deterministic from the test data — compute it here:
    const { createHash } = require('crypto');
    const signalType = 'price_point_change';
    const computedHash = createHash('sha256')
      .update(`${FIXTURE.COMPETITOR_ID}:${signalType}:pricing_plans:${FIXTURE.DIFF_ID}`)
      .digest('hex')
      .slice(0, 32);

    mockSupabase.__setTableResponse('signals', [{ signal_hash: computedHash }]);

    const res = FIXTURE.makeResponse();
    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.signalsCreated).toBe(0);
    expect(body.signalsDeduplicated).toBeGreaterThan(0);
  });
});
