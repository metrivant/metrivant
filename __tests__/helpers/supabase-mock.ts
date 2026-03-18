// Fluent Supabase query builder mock.
// Supports the full chaining pattern used by the Metrivant runtime.
// Usage: configure via __setTableResponse / __setRpcResponse before calling the handler.

type MockRow = Record<string, unknown>;
type ResolvedResult = { data: MockRow[] | MockRow | null; error: unknown; count?: number | null };

function makeChain(resolved: ResolvedResult): Record<string, jest.Mock> {
  // A chain object where every method returns itself, but is also awaitable.
  // Awaiting the chain yields { data, error }.

  const chain: Record<string, jest.Mock> = {};

  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'filter',
    'order', 'limit', 'range',
    'maybeSingle', 'catch',
  ];

  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }

  // Make the chain awaitable — resolves to the configured result.
  chain['then'] = jest.fn((resolve: (v: ResolvedResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject)
  );

  // single() resolves to a single object rather than an array.
  const singleResult: ResolvedResult = {
    data: Array.isArray(resolved.data) ? (resolved.data[0] ?? null) : resolved.data,
    error: resolved.error,
    count: resolved.count,
  };
  const singleChain: Record<string, jest.Mock> = {};
  singleChain['then'] = jest.fn((resolve: (v: ResolvedResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(singleResult).then(resolve, reject)
  );
  singleChain['catch'] = jest.fn(() => Promise.resolve(singleResult));

  chain['single'] = jest.fn().mockReturnValue(singleChain);

  chain['catch'] = jest.fn(() => Promise.resolve(resolved));

  return chain;
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createSupabaseMock() {
  // Per-table responses: table name → result
  const tableResponses = new Map<string, ResolvedResult>();
  // Per-RPC responses: rpc name → result
  const rpcResponses = new Map<string, ResolvedResult>();

  const mock = {
    from: jest.fn((table: string) => {
      const resp = tableResponses.get(table) ?? { data: [], error: null, count: null };
      return makeChain(resp);
    }),
    rpc: jest.fn((name: string) => {
      const resp = rpcResponses.get(name) ?? { data: null, error: null };
      return makeChain(resp);
    }),

    // Test configuration helpers
    __setTableResponse(
      table: string,
      data: MockRow[] | MockRow | null,
      error: unknown = null,
      count: number | null = null
    ) {
      tableResponses.set(table, { data, error, count });
    },
    __setRpcResponse(name: string, data: MockRow | null, error: unknown = null) {
      rpcResponses.set(name, { data, error });
    },
    __reset() {
      tableResponses.clear();
      rpcResponses.clear();
      mock.from.mockReset();
      mock.rpc.mockReset();
      mock.from.mockImplementation((table: string) => {
        const resp = tableResponses.get(table) ?? { data: [], error: null, count: null };
        return makeChain(resp);
      });
      mock.rpc.mockImplementation((name: string) => {
        const resp = rpcResponses.get(name) ?? { data: null, error: null };
        return makeChain(resp);
      });
    },
  };

  return mock;
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
