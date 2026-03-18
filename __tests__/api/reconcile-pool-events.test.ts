import '../helpers/env';

// Mock reconcilePoolSignals at the lib boundary — the handler delegates entirely to it
jest.mock('../../lib/pool-reconciliation', () => ({
  reconcilePoolSignals: mockReconcilePoolSignals,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {},
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

import { FIXTURE } from '../helpers/fixtures';

const mockReconcilePoolSignals = jest.fn();

import handler from '../../api/reconcile-pool-events';

const AUTH_REQ = FIXTURE.makeAuthRequest();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reconcile-pool-events handler — auth', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const req = FIXTURE.makeRequest({});
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 401 when token is wrong', async () => {
    const req = FIXTURE.makeRequest({ authorization: 'Bearer bad-token' });
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('reconcile-pool-events handler — success', () => {
  it('returns ok: true with checked and boosted counts on success', async () => {
    mockReconcilePoolSignals.mockResolvedValue({ checked: 42, boosted: 7 });
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(42);
    expect(body.boosted).toBe(7);
    expect(body).toHaveProperty('runtimeDurationMs');
  });

  it('returns ok: true with checked: 0 when no signals to reconcile', async () => {
    mockReconcilePoolSignals.mockResolvedValue({ checked: 0, boosted: 0 });
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(0);
    expect(body.boosted).toBe(0);
  });
});

describe('reconcile-pool-events handler — error handling', () => {
  it('returns ok: false with error string when reconcilePoolSignals throws', async () => {
    mockReconcilePoolSignals.mockRejectedValue(new Error('DB connection lost'));
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error as string).toContain('DB connection lost');
  });
});
