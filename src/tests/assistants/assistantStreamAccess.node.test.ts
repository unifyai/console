/**
 * Access control on the assistant event streams.
 *
 * These two SSE routes shipped without any caller check. It was an omission rather
 * than a decision: three of the five SSE routes in console authenticate with the
 * same `getApiKeyFromRequest` helper, `app/api/_utils/auth.ts` documents that helper
 * as the enforcement point for API routes precisely because the middleware matcher
 * excludes `/api/*`, and the commit that introduced the actions stream listed its
 * design decisions without mentioning auth. Unlike their siblings, these routes
 * cannot lean on Orchestra to scope the result — they read the assistant's Pub/Sub
 * topic with the platform's own service-account credentials.
 *
 * The ordering assertions matter as much as the status codes: a refused caller must
 * not cause a Pub/Sub subscription to be created, or the check would leak resources
 * and cost while appearing to work.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

// Declared through `vi.hoisted` because `vi.mock` factories are lifted above
// ordinary top-level consts, which cannot then be referenced inside them.
const mocks = vi.hoisted(() => ({
  getApiKeyFromRequest: vi.fn(),
  orchestraGet: vi.fn(),
  /**
   * Guards the assertion that a refusal never reaches Pub/Sub. Calling this is a
   * test failure, so a route touching it is visible rather than silent.
   */
  getPubSubClient: vi.fn(() => {
    throw new Error('Pub/Sub must not be reached for a caller that was refused');
  }),
  localEventBusEnabled: vi.fn(() => false),
}));

const { getApiKeyFromRequest, orchestraGet, getPubSubClient, localEventBusEnabled } = mocks;

vi.mock('@/app/api/_utils/auth', () => ({
  getApiKeyFromRequest: (request: unknown) => mocks.getApiKeyFromRequest(request),
}));

vi.mock('@/lib/orchestra/client', () => ({
  createOrchestraClient: () => ({ GET: (...args: unknown[]) => mocks.orchestraGet(...args) }),
}));

vi.mock('@/lib/pubsub/ephemeral-subscription', () => ({
  getPubSubClient: () => mocks.getPubSubClient(),
  getTopicName: (id: string) => `unity-${id}`,
  EPHEMERAL_EXPIRATION_TTL: '86400',
  MESSAGE_RETENTION_DURATION: '600',
}));

vi.mock('@/lib/pubsub/local-event-bus', () => ({
  localEventBusEnabled: () => mocks.localEventBusEnabled(),
  subscribe: () => () => {},
}));

import { authorizeAssistantStream } from '@/lib/assistants/assistantStreamAccess';
import { GET as ACTIONS_STREAM } from '@/app/api/assistant/[assistantId]/actions/stream/route';

const ASSISTANT = '4211';

function get(assistantId = ASSISTANT) {
  return {
    request: new NextRequest(`http://localhost/api/assistant/${assistantId}/actions/stream`),
    params: Promise.resolve({ assistantId }),
  };
}

describe('authorizeAssistantStream', () => {
  beforeEach(() => {
    getApiKeyFromRequest.mockReset();
    orchestraGet.mockReset();
    getPubSubClient.mockClear();
    localEventBusEnabled.mockReturnValue(false);
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
  });

  it('refuses a caller with no session without asking Orchestra', async () => {
    getApiKeyFromRequest.mockResolvedValue(null);

    const result = await authorizeAssistantStream(get().request, ASSISTANT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.response.status).toBe(401);
    expect(orchestraGet).not.toHaveBeenCalled();
  });

  it('admits an assistant the viewer can see', async () => {
    orchestraGet.mockResolvedValue({ data: { info: [{ agent_id: 4211 }, { agent_id: 9 }] } });

    expect(await authorizeAssistantStream(get().request, ASSISTANT)).toEqual({ ok: true });
  });

  it('admits a bare array as well as an info-wrapped list', async () => {
    // `listAssistants` accepts both shapes, so this must too or the check would
    // depend on which one Orchestra happened to return.
    orchestraGet.mockResolvedValue({ data: [{ agent_id: 4211 }] });

    expect(await authorizeAssistantStream(get().request, ASSISTANT)).toEqual({ ok: true });
  });

  it('admits the simulation adapter camelCase rows', async () => {
    // Simulation mode answers this same call through its own handler, so demo and
    // test scenarios must not start failing closed.
    orchestraGet.mockResolvedValue({ data: { info: [{ agentId: '4211' }] } });

    expect(await authorizeAssistantStream(get().request, ASSISTANT)).toEqual({ ok: true });
  });

  it("refuses an assistant that is not the viewer's", async () => {
    orchestraGet.mockResolvedValue({ data: { info: [{ agent_id: 77 }] } });

    const result = await authorizeAssistantStream(get().request, ASSISTANT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.response.status).toBe(403);
  });

  it('fails closed when access cannot be established', async () => {
    // This route hands out an assistant's whole activity feed, so an inconclusive
    // check must not read as a pass.
    orchestraGet.mockResolvedValue({ error: { detail: 'boom' } });

    const result = await authorizeAssistantStream(get().request, ASSISTANT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.response.status).toBe(503);
  });
});

describe('actions stream route', () => {
  beforeEach(() => {
    getApiKeyFromRequest.mockReset();
    orchestraGet.mockReset();
    getPubSubClient.mockClear();
    localEventBusEnabled.mockReturnValue(false);
  });

  it('refuses an unauthenticated caller before creating a subscription', async () => {
    getApiKeyFromRequest.mockResolvedValue(null);

    const { request, params } = get();
    const response = await ACTIONS_STREAM(request, { params });

    expect(response.status).toBe(401);
    expect(getPubSubClient).not.toHaveBeenCalled();
  });

  it('refuses another tenant before creating a subscription', async () => {
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    orchestraGet.mockResolvedValue({ data: { info: [{ agent_id: 77 }] } });

    const { request, params } = get();
    const response = await ACTIONS_STREAM(request, { params });

    expect(response.status).toBe(403);
    // A leaked ephemeral subscription would keep costing after the refusal.
    expect(getPubSubClient).not.toHaveBeenCalled();
  });

  it('still refuses when the local event bus is the backend', async () => {
    // Self-host and local dev take the in-memory path, and the check has to sit
    // ahead of that branch rather than inside the Pub/Sub one.
    localEventBusEnabled.mockReturnValue(true);
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    orchestraGet.mockResolvedValue({ data: { info: [{ agent_id: 77 }] } });

    const { request, params } = get();
    const response = await ACTIONS_STREAM(request, { params });

    expect(response.status).toBe(403);
  });

  it('opens the stream for a viewer who may see the assistant', async () => {
    localEventBusEnabled.mockReturnValue(true);
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    orchestraGet.mockResolvedValue({ data: { info: [{ agent_id: 4211 }] } });

    const { request, params } = get();
    const response = await ACTIONS_STREAM(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
