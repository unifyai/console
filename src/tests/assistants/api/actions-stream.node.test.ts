/**
 * Tests for the Actions SSE stream route.
 *
 * Validates ephemeral per-connection Pub/Sub subscription lifecycle:
 * - Each SSE connection creates its own subscription (fan-out to multiple viewers)
 * - Subscriptions are cleaned up when the connection closes
 * - Messages are correctly shaped and streamed as SSE events
 * - Excluded managers are filtered out
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

const mockDeleteFn = vi.fn(async () => {});

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

const TEST_ASSISTANT_ID = 'assistant-abc-123';
const TEST_PROJECT_ID = 'my-gcp-project';
const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

function makeMockMessage(payload: Record<string, unknown>, opts: { ackId?: string } = {}) {
  return {
    data: Buffer.from(JSON.stringify({ event: payload })),
    id: 'msg-1',
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

describe('Actions SSE Stream Route', () => {
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

  it('creates a unique ephemeral subscription per connection', async () => {
    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req1 = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: ctrl1.signal }
    );
    const req2 = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
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
      expect(sub.name).toContain('-actions-sse-');
    }

    ctrl1.abort();
    ctrl2.abort();
    await Promise.all([drainStream(res1), drainStream(res2)]);
  });

  it('creates subscription with correct config', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    const opts = createdSubscriptions[0].opts;
    expect(opts.expirationPolicy.ttl.seconds).toBe(86400);
    expect(opts.messageRetentionDuration.seconds).toBe(600);
  });

  it('deletes the ephemeral subscription when the stream ends', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    // Give async cleanup a moment
    await new Promise((r) => setTimeout(r, 50));

    expect(deletedSubscriptions.length).toBeGreaterThanOrEqual(1);
    expect(deletedSubscriptions[0]).toContain('-actions-sse-');
  });

  // =========================================================================
  // SSE response shape
  // =========================================================================

  it('returns proper SSE headers', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    controller.abort();
    await drainStream(response);
  });

  it('streams messages as correctly shaped SSE data lines', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));

    const msg = makeMockMessage({
      type: 'ManagerMethod',
      row_id: 42,
      event_timestamp: '2026-03-05T12:00:00Z',
      calling_id: 'call-1',
      event_id: 'evt-1',
      manager: 'ContactManager',
      method: 'ask',
      phase: 'incoming',
      hierarchy: ['seg1'],
      display_label: 'ContactManager.ask',
    });

    const subEmitter = [...mockSubscriptionInstances.values()][0];
    subEmitter?.emit('message', msg);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const allData = await drainStream(response);
    expect(allData).toContain(': connected');

    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBeGreaterThanOrEqual(1);

    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.type).toBe('ManagerMethod');
    expect(parsed.data.id).toBe(42);
    expect(parsed.data.entries.callingId).toBe('call-1');
    expect(parsed.data.entries.manager).toBe('ContactManager');
    expect(parsed.data.entries.phase).toBe('incoming');

    // Actions route ACKs server-side
    expect(msg.ack).toHaveBeenCalled();
  });

  // =========================================================================
  // Filtering
  // =========================================================================

  it('filters out excluded managers', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));

    const excludedMsg = makeMockMessage(
      { type: 'ManagerMethod', row_id: 1, manager: 'MemoryManager', phase: 'incoming', calling_id: 'mem-1' },
      { ackId: 'ack-excluded' }
    );
    const includedMsg = makeMockMessage(
      { type: 'ManagerMethod', row_id: 2, manager: 'ContactManager', phase: 'incoming', calling_id: 'contact-1' },
      { ackId: 'ack-included' }
    );

    const subEmitter = [...mockSubscriptionInstances.values()][0];
    subEmitter?.emit('message', excludedMsg);
    subEmitter?.emit('message', includedMsg);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const allData = await drainStream(response);
    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));

    expect(dataLines.length).toBe(1);
    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.data.entries.manager).toBe('ContactManager');

    // Both should be ACKed (excluded just gets acked without sending)
    expect(excludedMsg.ack).toHaveBeenCalled();
    expect(includedMsg.ack).toHaveBeenCalled();
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('falls back to local event bus when credentials are missing', async () => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', '');

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const controller = new AbortController();
    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const response = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    // Actions stream falls back to in-memory local event bus (200, not 500)
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    controller.abort();
    await drainStream(response);
  });

  it('returns 400 when assistantId is empty', async () => {
    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(`http://localhost/api/assistant//actions/stream`, {
      method: 'GET',
    });
    const response = await GET(req, { params: { assistantId: '' } });

    expect(response.status).toBe(400);
  });

  // =========================================================================
  // Staging suffix
  // =========================================================================

  it('uses staging suffix when ORCHESTRA_URL contains staging', async () => {
    vi.stubEnv('ORCHESTRA_URL', 'https://api-staging.unify.ai');
    const controller = new AbortController();

    const { GET } = await import('@/app/api/assistant/[assistantId]/actions/stream/route');

    const req = new NextRequest(
      `http://localhost/api/assistant/${TEST_ASSISTANT_ID}/actions/stream`,
      { method: 'GET', signal: controller.signal }
    );
    const res = await GET(req, { params: { assistantId: TEST_ASSISTANT_ID } });

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    expect(createdSubscriptions[0].name).toContain(`unity-${TEST_ASSISTANT_ID}-staging`);
  });
});
