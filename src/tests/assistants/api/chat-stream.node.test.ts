/**
 * Tests for the Chat SSE stream route and ACK endpoint.
 *
 * Validates persistent per-user+assistant Pub/Sub subscription behavior:
 * - Subscription is deterministic based on contactId (not random UUID)
 * - Same contactId reuses the same subscription (ALREADY_EXISTS handled)
 * - Subscriptions are NOT deleted on disconnect (persistent)
 * - Messages are correctly streamed as SSE data lines
 * - Client-side ACK: __ackId is included in SSE payloads for browser to ACK
 * - Server does NOT call message.ack() — browser ACKs via REST endpoint
 * - ACK endpoint acknowledges via the correct persistent subscription
 * - contactId is required (400 if missing)
 *
 * Uses vi.mock to replace @google-cloud/pubsub and google-auth-library
 * so no real GCP calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import of the route module
// ---------------------------------------------------------------------------

const createdSubscriptions: Array<{ name: string; opts: any }> = [];
const mockSubscriptionInstances = new Map<string, EventEmitter>();
let createSubError: Error | null = null;

const mockTopicCreateSubscription = vi.fn(async (name: string, opts: any) => {
  if (createSubError) throw createSubError;
  createdSubscriptions.push({ name, opts });
  return [{ name }];
});

const mockTopic = { createSubscription: mockTopicCreateSubscription };

const mockSubscription = vi.fn((name: string) => {
  let emitter = mockSubscriptionInstances.get(name);
  if (!emitter) {
    emitter = new EventEmitter();
    (emitter as any).close = vi.fn();
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

// google-auth-library mock is still needed for the ACK endpoint
const mockRequest = vi.fn();
vi.mock('google-auth-library', () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { request: mockRequest };
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

const TEST_ASSISTANT_ID = 'assistant-chat-456';
const TEST_CONTACT_ID = '42';
const TEST_PROJECT_ID = 'my-gcp-project';
const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

function makeUrl(assistantId: string, contactId?: string): string {
  const base = `http://localhost/api/assistant/${assistantId}/events`;
  return contactId ? `${base}?contactId=${contactId}` : base;
}

function makeMockMessage(
  payload: Record<string, unknown>,
  opts: { ackId?: string; id?: string; publishTime?: Date } = {}
) {
  return {
    data: Buffer.from(JSON.stringify(payload)),
    id: opts.id || 'msg-server-1',
    ackId: opts.ackId || 'ack-1',
    publishTime: opts.publishTime || new Date(),
    ack: vi.fn(),
    nack: vi.fn(),
    modAck: vi.fn(),
  };
}

async function collectStream(response: Response, { until }: { until: () => boolean }): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(decoder.decode(value, { stream: true }));
    if (until()) {
      reader.cancel();
      break;
    }
  }

  reader.releaseLock();
  return parts.join('');
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

describe('Chat SSE Stream Route', () => {
  beforeEach(() => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', MOCK_CREDENTIALS);
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra-service');
    createdSubscriptions.length = 0;
    mockSubscriptionInstances.clear();
    createSubError = null;
    mockRequest.mockReset();
    mockTopicCreateSubscription.mockClear();
    mockSubscription.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // Persistent subscription lifecycle
  // =========================================================================

  it('creates a deterministic subscription based on contactId', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    // Abort after stream starts to let it clean up
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    expect(createdSubscriptions[0].name).toContain(`-chat-${TEST_CONTACT_ID}`);
    expect(createdSubscriptions[0].name).not.toContain('-sse-');
  });

  it('different contactIds get different subscriptions', async () => {
    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

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
    expect(createdSubscriptions[0].name).toContain('-chat-42');
    expect(createdSubscriptions[1].name).toContain('-chat-99');

    ctrl1.abort();
    ctrl2.abort();
    await Promise.all([drainStream(res1), drainStream(res2)]);
  });

  it('handles ALREADY_EXISTS (code 6) gracefully when subscription exists', async () => {
    const controller = new AbortController();
    const alreadyExists: any = new Error('ALREADY_EXISTS');
    alreadyExists.code = 6;
    createSubError = alreadyExists;

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);
  });

  it('creates subscription with filter and correct config', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    const opts = createdSubscriptions[0].opts;
    expect(opts.filter).toContain('unify_message_outbound');
    expect(opts.filter).toContain('assistant_desktop_ready');
    expect(opts.expirationPolicy.ttl.seconds).toBe(2678400);
    expect(opts.messageRetentionDuration.seconds).toBe(600);
  });

  it('does NOT delete the subscription when the stream ends', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    // The subscriber's close() should be called but the subscription itself
    // should NOT be deleted (persistent subscription survives reconnects)
    const subName = createdSubscriptions[0]?.name;
    if (subName) {
      const emitter = mockSubscriptionInstances.get(subName);
      expect((emitter as any)?.close).toHaveBeenCalled();
    }
  });

  // =========================================================================
  // SSE response shape
  // =========================================================================

  it('returns proper SSE headers', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    controller.abort();
    await drainStream(response);
  });

  // =========================================================================
  // Client-side ACK: SSE route delegates ACK to the browser
  // =========================================================================

  it('does NOT call message.ack() server-side', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    // Wait for subscriber to be registered
    await new Promise((r) => setTimeout(r, 50));

    const msg = makeMockMessage(
      { thread: 'unify_message_outbound', event: { content: 'Hello', contact_id: 42 } },
      { ackId: 'ack-should-not-happen' }
    );

    // Find the subscription emitter and emit a message
    const subEmitter = [...mockSubscriptionInstances.values()][0];
    subEmitter?.emit('message', msg);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const allData = await drainStream(response);
    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBe(1);

    // message.ack() should NOT have been called
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it('includes __ackId in SSE payload for client-side ACK', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));

    const msg = makeMockMessage(
      { thread: 'unify_message_outbound', event: { content: 'Hello from assistant', contact_id: 42 } },
      { ackId: 'ack-for-client', id: 'msg-server-1' }
    );

    const subEmitter = [...mockSubscriptionInstances.values()][0];
    subEmitter?.emit('message', msg);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const allData = await drainStream(response);
    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBe(1);

    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.__ackId).toBe('ack-for-client');
    expect(parsed.event.content).toBe('Hello from assistant');
    expect(parsed.id).toBe('msg-server-1');
    expect(parsed.publishTime).toBeTruthy();
  });

  it('closes the gRPC subscriber on connection abort (un-acked messages redeliver)', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));

    const subEmitter = [...mockSubscriptionInstances.values()][0];
    expect(subEmitter?.listenerCount('message')).toBe(1);

    controller.abort();
    await drainStream(response);

    // After abort: subscriber is closed and listeners removed.
    // Pub/Sub will redeliver un-acked messages when the next subscriber opens.
    expect((subEmitter as any).close).toHaveBeenCalled();
    expect(subEmitter?.listenerCount('message')).toBe(0);
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

    const { GET } = await import('@/app/api/assistant/[assistantId]/events/route');

    const req = new NextRequest(makeUrl(TEST_ASSISTANT_ID, TEST_CONTACT_ID), {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    expect(createdSubscriptions[0].name).toContain(`unity-${TEST_ASSISTANT_ID}-staging`);
  });

  // =========================================================================
  // ACK endpoint (still uses REST — unchanged)
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
