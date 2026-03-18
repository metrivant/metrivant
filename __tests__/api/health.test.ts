import '../helpers/env';

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Suppress Sentry side-effects in tests
jest.mock('../../lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    captureCheckIn: jest.fn(),
    setContext: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    withScope: jest.fn(),
    init: jest.fn(),
    getClient: jest.fn(),
  },
}));

import { createSupabaseMock } from '../helpers/supabase-mock';
import { FIXTURE } from '../helpers/fixtures';

const mockSupabase = createSupabaseMock();

// health.ts imports supabase at module load — jest.mock hoists above imports
import handler from '../../api/health';

const AUTH_REQ = FIXTURE.makeAuthRequest();

beforeEach(() => {
  mockSupabase.__reset();
  jest.clearAllMocks();
});

// Configure all the Supabase calls health.ts makes so they return valid defaults.
// health.ts runs 15 parallel queries.
function setupHealthyResponses() {
  // All count-based queries return count=0, data=null, no error
  // maybeSingle queries return data=null, no error
  mockSupabase.__setTableResponse('snapshots', null, null, 0);
  mockSupabase.__setTableResponse('section_diffs', null, null, 0);
  mockSupabase.__setTableResponse('signals', null, null, 0);
  mockSupabase.__setTableResponse('monitored_pages', null, null, 0);
}

describe('health handler', () => {
  it('returns 401 when CRON_SECRET is missing from request', async () => {
    const req = FIXTURE.makeRequest({}); // no auth header
    const res = FIXTURE.makeResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const req = FIXTURE.makeRequest({ authorization: 'Bearer wrong-secret' });
    const res = FIXTURE.makeResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responds with ok: true when Supabase queries succeed', async () => {
    setupHealthyResponses();
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it('response includes required shape fields', async () => {
    setupHealthyResponses();
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('healthy');
    expect(body).toHaveProperty('latestFetchAt');
    expect(body).toHaveProperty('snapshotBacklog');
    expect(body).toHaveProperty('diffBacklog');
    expect(body).toHaveProperty('signalBacklog');
    expect(body).toHaveProperty('stuckSignals');
    expect(body).toHaveProperty('failedSignals');
    expect(body).toHaveProperty('recentSignals');
    expect(body).toHaveProperty('noiseDiffRatioLast24h');
    expect(body).toHaveProperty('pipelineBacklogWarnings');
    expect(body).toHaveProperty('fetchBacklogByPageClass');
  });

  it('healthy=false when latestFetchAt is null (no snapshots ever fetched)', async () => {
    setupHealthyResponses();
    // Default setupHealthyResponses gives count=0 data=null for snapshots,
    // which means latestFetchAt=null → fetchIsFresh=false → healthy=false
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.healthy).toBe(false);
  });

  it('returns ok: false when a core Supabase query throws an error', async () => {
    // Simulate a supabase error on the core snapshots query
    mockSupabase.__setTableResponse('snapshots', null, { message: 'connection refused' });
    // Other tables return ok
    mockSupabase.__setTableResponse('section_diffs', null, null, 0);
    mockSupabase.__setTableResponse('signals', null, null, 0);

    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    // When error is thrown, withSentry wrapper returns 500
    // health.ts itself returns status 500 with ok: false
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.healthy).toBe(false);
  });
});
