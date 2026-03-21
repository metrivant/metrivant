import { isPrivateUrl } from '../../lib/url-safety';

describe('isPrivateUrl', () => {
  // ── Must block ─────────────────────────────────────────────────────────────

  test.each([
    ['http://localhost/path',             'localhost'],
    ['http://127.0.0.1/path',            '127.0.0.1'],
    ['http://127.0.0.254/path',          '127.x.x.x'],
    ['http://10.0.0.1/path',             '10.x.x.x'],
    ['http://10.255.255.255/path',       '10.x.x.x (high)'],
    ['http://192.168.0.1/path',          '192.168.x.x'],
    ['http://192.168.255.255/path',      '192.168.x.x (high)'],
    ['http://172.16.0.1/path',           '172.16.x.x (bottom)'],
    ['http://172.31.255.255/path',       '172.31.x.x (top)'],
    ['http://169.254.169.254/latest',    'cloud metadata'],
    ['http://0.0.0.0/path',             '0.0.0.0'],
    ['http://myhost.local/path',         '.local suffix'],
    ['http://[::1]/path',               'IPv6 loopback bracket'],
    ['http://::1/path',                 'IPv6 loopback bare'],
    ['ftp://example.com/file',          'non-http protocol'],
    ['file:///etc/passwd',              'file protocol'],
    ['not-a-url',                       'unparseable'],
  ])('blocks %s (%s)', (url) => {
    expect(isPrivateUrl(url)).toBe(true);
  });

  // ── Must allow ─────────────────────────────────────────────────────────────

  test.each([
    ['https://acme.example.com',        'standard domain'],
    ['https://stripe.com/pricing',      'public SaaS'],
    ['http://172.15.0.1/path',          '172.15 (below private range)'],
    ['http://172.32.0.1/path',          '172.32 (above private range)'],
    ['https://192.169.0.1/path',        '192.169 (not 192.168)'],
    ['https://11.0.0.1/path',           '11.x (not 10.x)'],
    ['https://sub.domain.co.uk/page',   'multi-level TLD'],
  ])('allows %s (%s)', (url) => {
    expect(isPrivateUrl(url)).toBe(false);
  });
});
