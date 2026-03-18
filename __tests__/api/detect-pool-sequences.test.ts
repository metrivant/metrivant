import '../helpers/env';

jest.mock('../../lib/pool-sequence-detector', () => ({
  detectPoolSequences: mockDetectPoolSequences,
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

const mockDetectPoolSequences = jest.fn();

import handler from '../../api/detect-pool-sequences';

const AUTH_REQ = FIXTURE.makeAuthRequest();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('detect-pool-sequences handler — auth', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const req = FIXTURE.makeRequest({});
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('returns 401 when token is wrong', async () => {
    const req = FIXTURE.makeRequest({ authorization: 'Bearer bad' });
    const res = FIXTURE.makeResponse();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('detect-pool-sequences handler — success', () => {
  it('returns ok: true with checked and sequencesFound on success', async () => {
    mockDetectPoolSequences.mockResolvedValue({ checked: 120, sequencesFound: 3 });
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(120);
    expect(body.sequencesFound).toBe(3);
    expect(body).toHaveProperty('runtimeDurationMs');
  });

  it('returns ok: true with sequencesFound: 0 when no sequences detected', async () => {
    mockDetectPoolSequences.mockResolvedValue({ checked: 50, sequencesFound: 0 });
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.sequencesFound).toBe(0);
  });
});

describe('detect-pool-sequences handler — error handling', () => {
  it('returns ok: false when detectPoolSequences throws', async () => {
    mockDetectPoolSequences.mockRejectedValue(new Error('Supabase timeout'));
    const res = FIXTURE.makeResponse();

    await handler(AUTH_REQ, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe('string');
  });
});
