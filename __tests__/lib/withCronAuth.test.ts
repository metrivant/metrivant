// Test CRON_SECRET fail-closed behavior (H3).
//
// The module reads process.env.CRON_SECRET at load time, so we must
// manipulate the env BEFORE requiring the module. Each test scenario
// uses jest.isolateModules to get a fresh module evaluation.

function makeRes() {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(authHeader?: string) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

describe('verifyCronSecret', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('returns 503 when CRON_SECRET is unset in production (VERCEL_ENV)', () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_ENV = 'production';
    process.env.NODE_ENV = 'test'; // NODE_ENV is secondary

    jest.isolateModules(() => {
      const { verifyCronSecret } = require('../../lib/withCronAuth');
      const res = makeRes();
      const result = verifyCronSecret(makeReq(), res);
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'cron_secret_not_configured' });
    });
  });

  test('returns 503 when CRON_SECRET is empty string in production (NODE_ENV)', () => {
    process.env.CRON_SECRET = '';
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'production';

    jest.isolateModules(() => {
      const { verifyCronSecret } = require('../../lib/withCronAuth');
      const res = makeRes();
      const result = verifyCronSecret(makeReq(), res);
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  test('allows requests when CRON_SECRET is unset in development', () => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'test';

    jest.isolateModules(() => {
      const { verifyCronSecret } = require('../../lib/withCronAuth');
      const res = makeRes();
      const result = verifyCronSecret(makeReq(), res);
      expect(result).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  test('returns 401 when CRON_SECRET is set but header is wrong', () => {
    process.env.CRON_SECRET = 'correct-secret';
    delete process.env.VERCEL_ENV;

    jest.isolateModules(() => {
      const { verifyCronSecret } = require('../../lib/withCronAuth');
      const res = makeRes();
      const result = verifyCronSecret(makeReq('Bearer wrong-secret'), res);
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  test('allows requests with correct Bearer token', () => {
    process.env.CRON_SECRET = 'correct-secret';
    delete process.env.VERCEL_ENV;

    jest.isolateModules(() => {
      const { verifyCronSecret } = require('../../lib/withCronAuth');
      const res = makeRes();
      const result = verifyCronSecret(makeReq('Bearer correct-secret'), res);
      expect(result).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
