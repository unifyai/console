/**
 * Tests for the Chat SSE stream route.
 *
 * Validates ephemeral per-connection Pub/Sub subscription lifecycle:
 * - Each SSE connection creates its own subscription (fan-out to multiple viewers)
 * - Subscriptions are cleaned up when the connection closes
 * - Messages are correctly streamed as SSE data lines
 * - Server-side ACK: messages are acknowledged immediately (no __ackId in payload)
 *
 * Uses vi.mock to replace GoogleAuth and fs so no real GCP calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import of the route module
// ---------------------------------------------------------------------------

const mockRequest = vi.fn();

vi.mock('google-auth-library', () => {
  return {
    GoogleAuth: class MockGoogleAuth {
      async getClient() {
        return { request: mockRequest };
      }
    },
  };
});

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ASSISTANT_ID = 'assistant-chat-456';
const TEST_PROJECT_ID = 'my-gcp-project';
const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

function makePubSubMessage(payload: Record<string, unknown>, ackId = 'ack-1') {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return {
    ackId,
    message: {
      data: encoded,
      messageId: 'msg-server-1',
      publishTime: new Date().toISOString(),
    },
  };
}

/**
 * Creates a mock implementation that:
 * - Records subscription creation (PUT) calls
 * - Delivers `messageBatches` in sequence on pull calls, then aborts the controller
 * - Records subscription deletion (DELETE) calls
 * - Records ACK calls
 */
function createPubSubMock(
  controller: AbortController,
  opts: {
    messageBatches?: Array<{ receivedMessages: any[] }>;
    onSubscriptionCreate?: (url: string, data: any) => void;
    onSubscriptionDelete?: (url: string) => void;
    onAck?: (url: string, data: any) => void;
  } = {}
) {
  const { messageBatches = [], onSubscriptionCreate, onSubscriptionDelete, onAck } = opts;
  let pullCount = 0;

  return async (reqOpts: { url: string; method: string; data?: any }) => {
    if (reqOpts.method === 'PUT' && reqOpts.url.includes('/subscriptions/')) {
      onSubscriptionCreate?.(reqOpts.url, reqOpts.data);
      return { status: 200, data: {} };
    }

    if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':pull')) {
      const batchIndex = pullCount++;
      if (batchIndex < messageBatches.length) {
        return { status: 200, data: messageBatches[batchIndex] };
      }
      controller.abort();
      return { status: 200, data: { receivedMessages: [] } };
    }

    if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':acknowledge')) {
      onAck?.(reqOpts.url, reqOpts.data);
      return { status: 200, data: {} };
    }

    if (reqOpts.method === 'DELETE' && reqOpts.url.includes('/subscriptions/')) {
      onSubscriptionDelete?.(reqOpts.url);
      return { status: 200, data: {} };
    }

    return { status: 200, data: {} };
  };
}

async function drainStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];

  // eslint-disable-next-line no-constant-condition
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

describe('Chat SSE Stream Route', () => {
  beforeEach(() => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', MOCK_CREDENTIALS);
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra-service');
    mockRequest.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // Ephemeral subscription lifecycle
  // =========================================================================

  it('creates a unique ephemeral subscription per connection', async () => {
    const createdSubscriptions: string[] = [];

    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    mockRequest.mockImplementation(async (opts: { url: string; method: string; data?: any }) => {
      if (opts.method === 'PUT' && opts.url.includes('/subscriptions/')) {
        createdSubscriptions.push(opts.url);
        return { status: 200, data: {} };
      }
      if (opts.method === 'POST' && opts.url.endsWith(':pull')) {
        ctrl1.abort();
        ctrl2.abort();
        return { status: 200, data: { receivedMessages: [] } };
      }
      if (opts.method === 'DELETE') return { status: 200, data: {} };
      return { status: 200, data: {} };
    });

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req1 = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: ctrl1.signal,
    });
    const req2 = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: ctrl2.signal,
    });

    const [res1, res2] = await Promise.all([
      GET(req1, { params: { assistantId: TEST_ASSISTANT_ID } }),
      GET(req2, { params: { assistantId: TEST_ASSISTANT_ID } }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    expect(createdSubscriptions.length).toBe(2);
    expect(createdSubscriptions[0]).not.toBe(createdSubscriptions[1]);

    for (const url of createdSubscriptions) {
      expect(url).toContain(TEST_ASSISTANT_ID);
      expect(url).toContain('-chat-sse-');
    }

    await Promise.all([drainStream(res1), drainStream(res2)]);
  });

  it('creates subscription with correct topic, expiration, and retention', async () => {
    const controller = new AbortController();
    let createPayload: any = null;

    mockRequest.mockImplementation(
      createPubSubMock(controller, {
        onSubscriptionCreate: (_url, data) => {
          createPayload = data;
        },
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(createPayload).toBeTruthy();
    expect(createPayload.topic).toBe(
      `projects/${TEST_PROJECT_ID}/topics/unity-${TEST_ASSISTANT_ID}`
    );
    expect(createPayload.expirationPolicy.ttl).toBe('86400s');
    expect(createPayload.messageRetentionDuration).toBe('600s');
  });

  it('deletes the ephemeral subscription when the stream ends', async () => {
    const controller = new AbortController();
    const deletedSubscriptions: string[] = [];

    mockRequest.mockImplementation(
      createPubSubMock(controller, {
        onSubscriptionDelete: (url) => {
          deletedSubscriptions.push(url);
        },
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(deletedSubscriptions.length).toBeGreaterThanOrEqual(1);
    expect(deletedSubscriptions[0]).toContain('-chat-sse-');
  });

  // =========================================================================
  // SSE response shape
  // =========================================================================

  it('returns proper SSE headers', async () => {
    const controller = new AbortController();

    mockRequest.mockImplementation(createPubSubMock(controller));

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    await drainStream(response);
  });

  // =========================================================================
  // Server-side ACK and payload shape
  // =========================================================================

  it('ACKs messages server-side and does NOT include __ackId in payload', async () => {
    const controller = new AbortController();
    const ackedIds: string[][] = [];

    mockRequest.mockImplementation(
      createPubSubMock(controller, {
        messageBatches: [
          {
            receivedMessages: [
              makePubSubMessage(
                {
                  thread: 'unify_message_outbound',
                  event: { content: 'Hello from assistant', contact_id: 42 },
                },
                'ack-server-side'
              ),
            ],
          },
        ],
        onAck: (_url, data) => {
          ackedIds.push(data.ackIds);
        },
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    const allData = await drainStream(response);

    // Server-side ACK should have happened
    expect(ackedIds.length).toBe(1);
    expect(ackedIds[0]).toContain('ack-server-side');

    // Payload should NOT contain __ackId
    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBe(1);

    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.__ackId).toBeUndefined();
    expect(parsed.event.content).toBe('Hello from assistant');
    expect(parsed.id).toBe('msg-server-1');
    expect(parsed.publishTime).toBeTruthy();
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when credentials are missing', async () => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', '');

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(response.status).toBe(500);
  });

  it('returns 400 when assistantId is empty', async () => {
    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant//events`, { method: 'GET' });
    const response = await GET(req, { params: { assistantId: '' } });

    expect(response.status).toBe(400);
  });

  // =========================================================================
  // Staging suffix
  // =========================================================================

  it('uses staging suffix in topic name when ORCHESTRA_URL contains staging', async () => {
    vi.stubEnv('ORCHESTRA_URL', 'https://api-staging.unify.ai');
    const controller = new AbortController();
    let createPayload: any = null;

    mockRequest.mockImplementation(
      createPubSubMock(controller, {
        onSubscriptionCreate: (_url, data) => {
          createPayload = data;
        },
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events`, {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(createPayload).toBeTruthy();
    expect(createPayload.topic).toBe(
      `projects/${TEST_PROJECT_ID}/topics/unity-${TEST_ASSISTANT_ID}-staging`
    );
  });
});
