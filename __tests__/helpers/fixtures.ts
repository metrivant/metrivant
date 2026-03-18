// Canonical test fixtures with deterministic IDs.
// All overrides are shallow-merged with the defaults.

export const FIXTURE = {
  ORG_ID:          'org-00000000-0000-0000-0000-000000000001',
  COMPETITOR_ID:   'cmp-00000000-0000-0000-0000-000000000001',
  COMPETITOR_ID_2: 'cmp-00000000-0000-0000-0000-000000000002',
  PAGE_ID:         'pge-00000000-0000-0000-0000-000000000001',
  SNAPSHOT_ID:     'snp-00000000-0000-0000-0000-000000000001',
  SECTION_ID_PREV: 'sec-00000000-0000-0000-0000-000000000001',
  SECTION_ID_CURR: 'sec-00000000-0000-0000-0000-000000000002',
  BASELINE_ID:     'bsl-00000000-0000-0000-0000-000000000001',
  DIFF_ID:         'dif-00000000-0000-0000-0000-000000000001',
  SIGNAL_ID:       'sig-00000000-0000-0000-0000-000000000001',
  POOL_EVENT_ID:   'pev-00000000-0000-0000-0000-000000000001',

  competitor(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.COMPETITOR_ID,
      name: 'Acme Corp',
      website_url: 'https://acme.example.com',
      org_id: FIXTURE.ORG_ID,
      pressure_index: 0,
      last_signal_at: null,
      ...overrides,
    };
  },

  monitoredPage(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.PAGE_ID,
      competitor_id: FIXTURE.COMPETITOR_ID,
      url: 'https://acme.example.com/pricing',
      page_type: 'pricing',
      page_class: 'high_value',
      health_state: 'healthy',
      active: true,
      ...overrides,
    };
  },

  pageSection(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.SECTION_ID_CURR,
      monitored_page_id: FIXTURE.PAGE_ID,
      snapshot_id: FIXTURE.SNAPSHOT_ID,
      section_type: 'pricing_plans',
      section_hash: 'newhash001',
      section_text: 'Pro plan: $129/month',
      created_at: new Date().toISOString(),
      validation_status: 'valid',
      ...overrides,
    };
  },

  sectionBaseline(overrides: Record<string, unknown> = {}) {
    return {
      monitored_page_id: FIXTURE.PAGE_ID,
      section_type: 'pricing_plans',
      section_hash: 'oldhash001',
      source_section_id: FIXTURE.SECTION_ID_PREV,
      ...overrides,
    };
  },

  sectionDiff(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.DIFF_ID,
      monitored_page_id: FIXTURE.PAGE_ID,
      competitor_id: FIXTURE.COMPETITOR_ID,
      section_type: 'pricing_plans',
      previous_section_id: FIXTURE.SECTION_ID_PREV,
      current_section_id: FIXTURE.SECTION_ID_CURR,
      signal_detected: false,
      is_noise: false,
      page_class: 'high_value',
      observation_count: 1,
      last_seen_at: new Date().toISOString(),
      confirmed: true,
      monitored_pages: { competitor_id: FIXTURE.COMPETITOR_ID },
      ...overrides,
    };
  },

  signal(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.SIGNAL_ID,
      competitor_id: FIXTURE.COMPETITOR_ID,
      signal_type: 'price_point_change',
      signal_hash: 'abc123def456abc123def456abc123de',
      urgency: 3,
      confidence_score: 0.75,
      status: 'pending',
      summary: 'Pro plan price increased from $99 to $129/month',
      strategic_implication: null,
      recommended_action: null,
      detected_at: new Date().toISOString(),
      source_type: 'page_diff',
      relevance_level: null,
      ...overrides,
    };
  },

  poolEvent(overrides: Record<string, unknown> = {}) {
    return {
      id: FIXTURE.POOL_EVENT_ID,
      competitor_id: FIXTURE.COMPETITOR_ID,
      source_type: 'newsroom',
      source_url: 'https://acme.example.com/feed.rss',
      event_type: 'press_release',
      title: 'Acme Corp Announces Record Q4 Revenue',
      summary: 'Revenue grew 40% year-over-year to $500M',
      event_url: 'https://acme.example.com/news/q4-2024',
      published_at: new Date().toISOString(),
      content_hash: 'contenthash001',
      normalization_status: 'pending',
      created_at: new Date().toISOString(),
      awardee_name: null,
      contract_value: null,
      contract_id: null,
      buyer_name: null,
      program_name: null,
      ...overrides,
    };
  },

  // Builds a mock ApiReq with the given headers
  makeRequest(headers: Record<string, string> = {}): {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string>;
    body: null;
  } {
    return {
      method: 'GET',
      url: '/api/test',
      headers,
      query: {},
      body: null,
    };
  },

  // Builds an ApiReq with a valid Bearer token
  makeAuthRequest() {
    return FIXTURE.makeRequest({
      authorization: `Bearer ${process.env.CRON_SECRET ?? 'test-secret'}`,
    });
  },

  // Builds a minimal ApiRes mock with jest spy methods
  makeResponse() {
    const res = {
      headersSent: false,
      statusCode: 200,
      body: null as unknown,
      status: jest.fn(),
      json: jest.fn(),
    };
    res.status.mockReturnValue(res);
    res.json.mockImplementation((b: unknown) => { res.body = b; });
    return res;
  },
};
