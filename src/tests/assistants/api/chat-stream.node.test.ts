/**
 * Tests for the Chat SSE stream route and ACK endpoint.
 *
 * Validates persistent per-user+assistant Pub/Sub subscription behavior:
 * - Subscription is deterministic based on contactId (not random UUID)
 * - Same contactId reuses the same subscription (ALREADY_EXISTS handled)
 * - Subscriptions are NOT deleted on disconnect (persistent)
 * - Messages are correctly streamed as SSE data lines
 * - Client-side ACK: __ackId is included in SSE payloads for browser to ACK
 * - Server extends ACK deadline (modifyAckDeadline) instead of ACKing
 * - ACK endpoint acknowledges via the correct persistent subscription
 * - contactId is required (400 if missing)
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
const TEST_CONTACT_ID = '42';
const TEST_PROJECT_ID = 'my-gcp-project';
const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

function makeUrl(assistantId: string, contactId?: string): string {
  const base = `http://localhost/api/assistant/${assistantId}/events`;
  return contactId ? `${base}?contactId=${contactId}` : base;
}

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

function createPubSubMock(
  controller: AbortController,
  opts: {
    messageBatches?: Array<{ receivedMessages: any[] }>;
    onSubscriptionCreate?: (url: string, data: any) => void;
    onSubscriptionDelete?: (url: string) => void;
    onAck?: (url: string, data: any) => void;
    onModifyAckDeadline?: (url: string, data: any) => void;
  } = {}
) {
  const {
    messageBatches = [],
    onSubscriptionCreate,
    onSubscriptionDelete,
    onAck,
    onModifyAckDeadline,
  } = opts;
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

    if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':modifyAckDeadline')) {
      onModifyAckDeadline?.(reqOpts.url, reqOpts.data);
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
  // Persistent subscription lifecycle
  // =========================================================================

  it('creates a deterministic subscription based on contactId', async () => {
    const createdSubscriptions: string[] = [];
    const controller = new AbortController();

    mockRequest.mockImplementation(async (opts: { url: string; method: string; data?: any }) => {
      if (opts.method === 'PUT' && opts.url.includes('/subscriptions/')) {
        createdSubscriptions.push(opts.url);
        return { status: 200, data: {} };
      }
      if (opts.method === 'POST' && opts.url.endsWith(':pull')) {
        controller.abort();
        return { status: 200, data: { receivedMessages: [] } };
      }
      return { status: 200, data: {} };
    });

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    expect(createdSubscriptions[0]).toContain(`-chat-${TEST_CONTACT_ID}`);
    // Should NOT contain a random UUID segment
    expect(createdSubscriptions[0]).not.toContain('-sse-');
  });

  it('different contactIds get different subscriptions', async () => {
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
      return { status: 200, data: {} };
    });

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req1 = new NextRequest(makeUrl(TEST_ASSISTANT_ID, '42'), {
      method: 'GET',
      signal: ctrl1.signal,
    });
    const req2 = new NextRequest(makeUrl(TEST_ASSISTANT_ID, '99'), {
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
    expect(createdSubscriptions[0]).toContain('-chat-42');
    expect(createdSubscriptions[1]).toContain('-chat-99');

    await Promise.all([drainStream(res1), drainStream(res2)]);
  });

  it('handles ALREADY_EXISTS (409) gracefully when subscription already exists', async () => {
    const controller = new AbortController();

    mockRequest.mockImplementation(async (opts: { url: string; method: string; data?: any }) => {
      if (opts.method === 'PUT' && opts.url.includes('/subscriptions/')) {
        const error: any = new Error('ALREADY_EXISTS');
        error.response = { status: 409 };
        throw error;
      }
      if (opts.method === 'POST' && opts.url.endsWith(':pull')) {
        controller.abort();
        return { status: 200, data: { receivedMessages: [] } };
      }
      return { status: 200, data: {} };
    });

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(res.status).toBe(200);
    await drainStream(res);
  });

  it('creates subscription with correct topic, 31-day expiration, and retention', async () => {
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

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(createPayload).toBeTruthy();
    expect(createPayload.topic).toBe(
      `projects/${TEST_PROJECT_ID}/topics/unity-${TEST_ASSISTANT_ID}`
    );
    expect(createPayload.expirationPolicy.ttl).toBe('2678400s');
    expect(createPayload.messageRetentionDuration).toBe('600s');
  });

  it('does NOT delete the subscription when the stream ends', async () => {
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

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(res);

    expect(deletedSubscriptions.length).toBe(0);
  });

  // =========================================================================
  // SSE response shape
  // =========================================================================

  it('returns proper SSE headers', async () => {
    const controller = new AbortController();

    mockRequest.mockImplementation(createPubSubMock(controller));

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
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
  // Client-side ACK: SSE route delegates ACK to the browser
  // =========================================================================

  it('does NOT ACK messages server-side', async () => {
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
                'ack-should-not-happen'
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

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(response);

    expect(ackedIds.length).toBe(0);
  });

  it('includes __ackId in SSE payload for client-side ACK', async () => {
    const controller = new AbortController();

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
                'ack-for-client'
              ),
            ],
          },
        ],
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    const allData = await drainStream(response);

    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBe(1);

    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.__ackId).toBe('ack-for-client');
    expect(parsed.event.content).toBe('Hello from assistant');
    expect(parsed.id).toBe('msg-server-1');
    expect(parsed.publishTime).toBeTruthy();
  });

  it('extends ACK deadline after pulling a message', async () => {
    const controller = new AbortController();
    const deadlineExtensions: Array<{ url: string; data: any }> = [];

    mockRequest.mockImplementation(
      createPubSubMock(controller, {
        messageBatches: [
          {
            receivedMessages: [
              makePubSubMessage(
                {
                  thread: 'unify_message_outbound',
                  event: { content: 'Test', contact_id: 42 },
                },
                'ack-deadline-test'
              ),
            ],
          },
        ],
        onModifyAckDeadline: (url, data) => {
          deadlineExtensions.push({ url, data });
        },
      })
    );

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(response);

    const extensions = deadlineExtensions.filter((e) => e.data.ackDeadlineSeconds > 0);
    expect(extensions.length).toBe(1);
    expect(extensions[0].data.ackIds).toContain('ack-deadline-test');
    expect(extensions[0].data.ackDeadlineSeconds).toBe(30);
  });

  it('NACKs unprocessed messages when connection aborts mid-processing', async () => {
    const controller = new AbortController();
    const deadlineChanges: Array<{ url: string; data: any }> = [];
    let pullCount = 0;

    mockRequest.mockImplementation(async (reqOpts: { url: string; method: string; data?: any }) => {
      if (reqOpts.method === 'PUT' && reqOpts.url.includes('/subscriptions/')) {
        return { status: 200, data: {} };
      }

      if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':pull')) {
        pullCount++;
        if (pullCount === 1) {
          // Abort the connection just before returning a batch with two messages.
          // The first message will be processed, but the second should hit the
          // abort check and get NACKed.
          controller.abort();
          return {
            status: 200,
            data: {
              receivedMessages: [
                makePubSubMessage(
                  {
                    thread: 'unify_message_outbound',
                    event: { content: 'First', contact_id: 42 },
                  },
                  'ack-first'
                ),
                makePubSubMessage(
                  {
                    thread: 'unify_message_outbound',
                    event: { content: 'Second', contact_id: 42 },
                  },
                  'ack-nack-test'
                ),
              ],
            },
          };
        }
        return { status: 200, data: { receivedMessages: [] } };
      }

      if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':modifyAckDeadline')) {
        deadlineChanges.push({ url: reqOpts.url, data: reqOpts.data });
        return { status: 200, data: {} };
      }

      return { status: 200, data: {} };
    });

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    await drainStream(response);

    const nacks = deadlineChanges.filter((e) => e.data.ackDeadlineSeconds === 0);
    expect(nacks.length).toBeGreaterThanOrEqual(1);
    expect(nacks.some((n) => n.data.ackIds.includes('ack-nack-test'))).toBe(true);
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when credentials are missing', async () => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', '');

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), { method: 'GET' });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(response.status).toBe(500);
  });

  it('returns 400 when assistantId is empty', async () => {
    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl('', TEST_CONTACT_ID), { method: 'GET' });
    const response = await GET(req, { params: { assistantId: '' } });

    expect(response.status).toBe(400);
  });

  it('returns 400 when contactId is missing', async () => {
    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID), { method: 'GET' });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

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

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
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

  // =========================================================================
  // ACK endpoint
  // =========================================================================

  it('ACK endpoint acknowledges via the correct persistent subscription', async () => {
    const ackedIds: Array<{ url: string; data: any }> = [];

    mockRequest.mockImplementation(async (reqOpts: { url: string; method: string; data?: any }) => {
      if (reqOpts.method === 'POST' && reqOpts.url.endsWith(':acknowledge')) {
        ackedIds.push({ url: reqOpts.url, data: reqOpts.data });
        return { status: 200, data: {} };
      }
      return { status: 200, data: {} };
    });

    const { POST } = await import('@/app/api/assistant/[assistantId]/events/ack/route');

    const req = new NextRequest(`http://localhost/api/assistant/${TEST_ASSISTANT_ID}/events/ack`, {
      method: 'POST',
      body: JSON.stringify({ ackId: 'ack-from-client', contactId: TEST_CONTACT_ID }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(req, { params: { assistantId: TEST_ASSISTANT_ID } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(ackedIds.length).toBe(1);
    expect(ackedIds[0].url).toContain(`-chat-${TEST_CONTACT_ID}`);
    expect(ackedIds[0].data.ackIds).toContain('ack-from-client');
  });
});
