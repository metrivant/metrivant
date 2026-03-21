// Test H10: pipeline_events insert failure captures to Sentry.

// Must mock sentry BEFORE the module loads to avoid the dynamic require issue.
const mockCaptureMessage = jest.fn();
jest.mock('../../lib/sentry', () => ({
  Sentry: {
    captureMessage: mockCaptureMessage,
  },
}));

jest.mock('../../lib/supabase', () => {
  const insertError = new Error('connection timeout');
  return {
    supabase: {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          then: jest.fn((_, reject) => {
            // Simulate a failed insert
            return Promise.resolve().then(() => reject(insertError));
          }),
        }),
      }),
    },
  };
});

import { recordEvent } from '../../lib/pipeline-metrics';

describe('H10: recordEvent Sentry capture on failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('captures pipeline_event_insert_failed to Sentry on error', async () => {
    recordEvent({ stage: 'test_stage', status: 'success' });

    // recordEvent is fire-and-forget — wait for microtasks to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'pipeline_event_insert_failed',
      expect.objectContaining({
        level: 'warning',
        extra: expect.objectContaining({
          stage: 'test_stage',
        }),
      })
    );
  });
});
