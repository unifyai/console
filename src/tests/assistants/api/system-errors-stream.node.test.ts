/**
 * Tests for the System Errors SSE stream route.
 *
 * Validates ephemeral per-connection Pub/Sub subscription lifecycle:
 * - Each SSE connection creates its own subscription with system_error filter
 * - Subscriptions are cleaned up when the connection closes
 * - Messages are correctly streamed as SSE data lines
 * - Server-side ACK (errors are best-effort, no client ACK needed)
 * - Falls back to local event bus in local dev mode
 * - Only system_error messages are forwarded in local mode
 *
 * Uses vi.mock to replace @google-cloud/pubsub so no real GCP calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import of the route module
// ---------------------------------------------------------------------------

const createdSubscriptions: Array<{ name: string; opts: any }> = [];
const deletedSubscriptions: string[] = [];
const mockSubscriptionInstances = new Map<string, EventEmitter>();

const mockTopicCreateSubscription = vi.fn(async (name: string, opts: any) => {
  createdSubscriptions.push({ name, opts });
  return [{ name }];
});

const mockTopic = { createSubscription: mockTopicCreateSubscription };

const mockSubscription = vi.fn((name: string) => {
  let emitter = mockSubscriptionInstances.get(name);
  if (!emitter) {
    emitter = new EventEmitter();
    (emitter as any).close = vi.fn();
    (emitter as any).delete = vi.fn(async () => {
      deletedSubscriptions.push(name);
    });
    mockSubscriptionInstances.set(name, emitter);
  }
  return emitter;
});

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: class MockPubSub {
    topic() {
      return mockTopic;
    }
    subscription(name: string) {
      return mockSubscription(name);
    }
  },
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { request: vi.fn() };
    }
  },
}));

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ASSISTANT_ID = 'assistant-syserr-789';
const TEST_PROJECT_ID = 'my-gcp-project';
const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

function makeMockMessage(
  payload: Record<string, unknown>,
  opts: { ackId?: string; id?: string } = {}
) {
  return {
    data: Buffer.from(JSON.stringify(payload)),
    id: opts.id || 'msg-1',
    ackId: opts.ackId || 'ack-1',
    publishTime: new Date(),
    ack: vi.fn(),
    nack: vi.fn(),
  };
}

async function drainStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(decoder.decode(value, { stream: true }));
  }

  reader.releaseLock();
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('System Errors SSE Stream Route', () => {
  beforeEach(() => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', MOCK_CREDENTIALS);
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra-service');
    createdSubscriptions.length = 0;
    deletedSubscriptions.length = 0;
    mockSubscriptionInstances.clear();
    mockTopicCreateSubscription.mockClear();
    mockSubscription.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // Ephemeral subscription lifecycle
  // =========================================================================

  it(
    'creates a unique ephemeral subscription per connection',
    {
      meta: {
        alias: 'SysErr-UniqueSubscription',
        scenario: 'Two concurrent SSE connections for same assistant',
        behavior: 'Each gets a distinct subscription',
      },
    },
    async () => {
      const ctrl1 = new AbortController();
      const ctrl2 = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req1 = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: ctrl1.signal }
      );
      const req2 = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: ctrl2.signal }
      );

      const [res1, res2] = await Promise.all([
        GET(req1, { params: { assistantId: TEST_ASSISTANT_ID } }),
        GET(req2, { params: { assistantId: TEST_ASSISTANT_ID } }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(createdSubscriptions.length).toBe(2);
      expect(createdSubscriptions[0].name).not.toBe(createdSubscriptions[1].name);

      for (const sub of createdSubscriptions) {
        expect(sub.name).toContain(TEST_ASSISTANT_ID);
        expect(sub.name).toContain('-syserr-');
      }

      ctrl1.abort();
      ctrl2.abort();
      await Promise.all([drainStream(res1), drainStream(res2)]);
    }
  );

  it(
    'creates subscription with system_error filter',
    {
      meta: {
        alias: 'SysErr-Filter',
        scenario: 'Subscription is created',
        behavior: 'Has the system_error filter applied',
      },
    },
    async () => {
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

      await new Promise((r) => setTimeout(r, 50));
      controller.abort();
      await drainStream(res);

      expect(createdSubscriptions.length).toBe(1);
      const opts = createdSubscriptions[0].opts;
      expect(opts.filter).toBe('attributes.thread = "system_error"');
      expect(opts.expirationPolicy.ttl.seconds).toBe(86400);
      expect(opts.messageRetentionDuration.seconds).toBe(600);
    }
  );

  it(
    'deletes the ephemeral subscription when the stream ends',
    {
      meta: {
        alias: 'SysErr-Cleanup',
        scenario: 'SSE connection is closed',
        behavior: 'Subscription is deleted',
      },
    },
    async () => {
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

      await new Promise((r) => setTimeout(r, 50));
      controller.abort();
      await drainStream(res);

      await new Promise((r) => setTimeout(r, 50));

      expect(deletedSubscriptions.length).toBeGreaterThanOrEqual(1);
      expect(deletedSubscriptions[0]).toContain('-syserr-');
    }
  );

  // =========================================================================
  // SSE response shape
  // =========================================================================

  it(
    'returns proper SSE headers',
    {
      meta: {
        alias: 'SysErr-SSEHeaders',
        scenario: 'SSE response is created',
        behavior: 'Contains correct Content-Type and caching headers',
      },
    },
    async () => {
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const response = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('X-Accel-Buffering')).toBe('no');

      controller.abort();
      await drainStream(response);
    }
  );

  it(
    'streams system error messages as SSE data lines',
    {
      meta: {
        alias: 'SysErr-StreamMessage',
        scenario: 'A system error is published on the topic',
        behavior: 'Message is forwarded as SSE data line with id and publishTime',
      },
    },
    async () => {
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const response = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      await new Promise((r) => setTimeout(r, 50));

      const msg = makeMockMessage(
        {
          thread: 'system_error',
          event: { content: 'The assistant ran out of memory.' },
        },
        { id: 'err-msg-1', ackId: 'ack-err-1' }
      );

      const subEmitter = Array.from(mockSubscriptionInstances.values())[0];
      subEmitter?.emit('message', msg);

      await new Promise((r) => setTimeout(r, 50));
      controller.abort();

      const allData = await drainStream(response);
      expect(allData).toContain(': connected');

      const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
      expect(dataLines.length).toBe(1);

      const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
      expect(parsed.thread).toBe('system_error');
      expect(parsed.event.content).toContain('ran out of memory');
      expect(parsed.id).toBe('err-msg-1');
      expect(parsed.publishTime).toBeTruthy();

      // Server-side ACK (no client ACK for system errors)
      expect(msg.ack).toHaveBeenCalled();
    }
  );

  it(
    'streams messages with structured error_type field',
    {
      meta: {
        alias: 'SysErr-StructuredType',
        scenario: 'Unity publishes an error with error_type in the event payload',
        behavior: 'SSE data preserves the error_type field for client parsing',
      },
    },
    async () => {
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const response = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      await new Promise((r) => setTimeout(r, 50));

      const msg = makeMockMessage(
        {
          thread: 'system_error',
          event: {
            content: 'The assistant ran out of memory. Please wait.',
            error_type: 'oom',
          },
        },
        { id: 'err-structured-1' }
      );

      const subEmitter = Array.from(mockSubscriptionInstances.values())[0];
      subEmitter?.emit('message', msg);

      await new Promise((r) => setTimeout(r, 50));
      controller.abort();

      const allData = await drainStream(response);
      const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
      expect(dataLines.length).toBe(1);

      const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
      expect(parsed.event.error_type).toBe('oom');
    }
  );

  // =========================================================================
  // Error handling
  // =========================================================================

  it(
    'falls back to local event bus when credentials are missing',
    {
      meta: {
        alias: 'SysErr-LocalFallback',
        scenario: 'No COMMS_SERVICE_ACCOUNT_CREDENTIALS',
        behavior: 'Returns 200 SSE response using local event bus',
      },
    },
    async () => {
      vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', '');

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const controller = new AbortController();
      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const response = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      controller.abort();
      await drainStream(response);
    }
  );

  it(
    'returns 400 when assistantId is empty',
    {
      meta: {
        alias: 'SysErr-MissingId',
        scenario: 'Empty assistantId in request',
        behavior: 'Returns 400',
      },
    },
    async () => {
      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(`http://localhost/api/assistant//system-errors/stream`, {
        method: 'GET',
      });
      const response = await GET(req, { params: { assistantId: '' } });

      expect(response.status).toBe(400);
    }
  );

  // =========================================================================
  // Topic not found (pre-system-error assistants)
  // =========================================================================

  it(
    'returns 404 when the assistant topic does not exist',
    {
      meta: {
        alias: 'SysErr-TopicNotFound',
        scenario: 'Assistant was created before system error support was deployed',
        behavior: 'Returns 404 so the hook does not retry',
      },
    },
    async () => {
      const notFoundError = Object.assign(new Error('NOT_FOUND'), { code: 5 });
      mockTopicCreateSubscription.mockRejectedValueOnce(notFoundError);

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET' }
      );
      const response = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.detail).toContain('not found');
    }
  );

  // =========================================================================
  // Staging suffix
  // =========================================================================

  it(
    'uses staging suffix when ORCHESTRA_URL contains staging',
    {
      meta: {
        alias: 'SysErr-StagingSuffix',
        scenario: 'Staging environment',
        behavior: 'Topic name includes -staging suffix',
      },
    },
    async () => {
      vi.stubEnv('ORCHESTRA_URL', 'https://api-staging.unify.ai');
      const controller = new AbortController();

      const { GET } = await import('@/app/api/assistant/[assistantId]/system-errors/stream/route');

      const req = new NextRequest(
        `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/system-errors/stream`,
        { method: 'GET', signal: controller.signal }
      );
      const res = await GET(req, {
        params: { assistantId: TEST_ASSISTANT_ID },
      });

      await new Promise((r) => setTimeout(r, 50));
      controller.abort();
      await drainStream(res);

      expect(createdSubscriptions.length).toBe(1);
      expect(createdSubscriptions[0].name).toContain(`unity-${TEST_ASSISTANT_ID}-staging`);
    }
  );
});
