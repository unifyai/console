/**
 * Resolving which assistant a caller may read.
 *
 * Three properties carry the weight. The question is asked with the *caller's
 * own* key, so Orchestra reports their real scope and the answer cannot be
 * widened by asking differently. The org-wide listing is tried first: without
 * `list_all_org` Orchestra answers the creator-scoped question, which would
 * refuse every member of an organization who did not create the assistant —
 * while the shell's own roster shows it to them. And an answer is only
 * remembered when Orchestra actually gave one, so an outage cannot pin a
 * refusal in place.
 *
 * Each test loads the module fresh, because the cache is module state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Declared through `vi.hoisted` because `vi.mock` factories are lifted above
// ordinary top-level consts, which cannot then be referenced inside them.
const mocks = vi.hoisted(() => ({
  orchestraGet: vi.fn(),
  createdWith: vi.fn(),
}));

vi.mock('@/lib/orchestra/client', () => ({
  createOrchestraClient: (apiKey: string) => {
    mocks.createdWith(apiKey);
    return { GET: (...args: unknown[]) => mocks.orchestraGet(...args) };
  },
}));

const { orchestraGet, createdWith } = mocks;

const ASSISTANT = '4211';
const CALLER_KEY = 'caller-key';

function load() {
  return import('@/lib/assistants/assistantAccess');
}

function ok(payload: unknown) {
  return { data: payload, response: { status: 200 } };
}

function forbidden() {
  return { error: { detail: 'assistant:read required' }, response: { status: 403 } };
}

function failed(status = 500) {
  return { error: { detail: 'boom' }, response: { status } };
}

describe('readableAssistantRow', () => {
  beforeEach(() => {
    orchestraGet.mockReset();
    createdWith.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('asks for the org-wide list with the caller’s own key', async () => {
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    await readableAssistantRow(CALLER_KEY, ASSISTANT);

    expect(createdWith).toHaveBeenCalledWith(CALLER_KEY);
    expect(orchestraGet).toHaveBeenCalledTimes(1);
    expect(orchestraGet).toHaveBeenCalledWith('/v0/assistant', {
      params: { query: { list_all_org: true } },
    });
  });

  it('returns the matching row from an info-wrapped list', async () => {
    orchestraGet.mockResolvedValue(
      ok({ info: [{ agent_id: 9 }, { agent_id: 4211, name: 'Ada' }] })
    );
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toEqual({
      agent_id: 4211,
      name: 'Ada',
    });
  });

  it('accepts a bare array as well as an info-wrapped list', async () => {
    // `listAssistants` accepts both shapes, so this must too or the answer would
    // depend on which one Orchestra happened to return.
    orchestraGet.mockResolvedValue(ok([{ agent_id: 4211 }]));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toEqual({ agent_id: 4211 });
  });

  it('accepts the simulation adapter’s camelCase rows', async () => {
    // Simulation mode answers this same call through its own handler, so demo and
    // test scenarios must not start failing closed.
    orchestraGet.mockResolvedValue(ok({ info: [{ agentId: '4211' }] }));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toEqual({ agentId: '4211' });
  });

  it('returns null when the caller cannot see that assistant', async () => {
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 77 }] }));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
  });

  it('falls back to the creator-scoped list when the org-wide one is refused', async () => {
    // An org member without `assistant:read` still sees the assistants they
    // created, and the shell's roster falls back the same way.
    orchestraGet.mockResolvedValueOnce(forbidden());
    orchestraGet.mockResolvedValueOnce(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toEqual({ agent_id: 4211 });
    expect(orchestraGet).toHaveBeenNthCalledWith(2, '/v0/assistant', {});
  });

  it('returns null when the fallback list also refuses', async () => {
    orchestraGet.mockResolvedValueOnce(forbidden());
    orchestraGet.mockResolvedValueOnce(failed(403));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
  });

  it('does not retry an error that is not a permission refusal', async () => {
    // Retrying a transport failure would mask it as an access answer.
    orchestraGet.mockResolvedValue(failed());
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
    expect(orchestraGet).toHaveBeenCalledTimes(1);
  });

  it('fails closed when Orchestra cannot be reached at all', async () => {
    orchestraGet.mockRejectedValue(new Error('network down'));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
  });
});

describe('readableAssistantRow caching', () => {
  beforeEach(() => {
    orchestraGet.mockReset();
    createdWith.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('asks Orchestra once for repeated checks in the same window', async () => {
    // The desktop pane re-resolves every few seconds for as long as it is open.
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    const first = await readableAssistantRow(CALLER_KEY, ASSISTANT);
    const second = await readableAssistantRow(CALLER_KEY, ASSISTANT);

    expect(second).toEqual(first);
    expect(orchestraGet).toHaveBeenCalledTimes(1);
  });

  it('remembers a refusal, since those are the polls that never end', async () => {
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 77 }] }));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
    expect(orchestraGet).toHaveBeenCalledTimes(1);
  });

  it('does not remember an answer Orchestra never gave', async () => {
    // Holding a transient failure would lock a legitimate viewer out for the
    // whole window rather than for one poll.
    orchestraGet.mockResolvedValueOnce(failed());
    orchestraGet.mockResolvedValueOnce(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toBeNull();
    expect(await readableAssistantRow(CALLER_KEY, ASSISTANT)).toEqual({ agent_id: 4211 });
  });

  it('re-asks once the remembered answer has lapsed', async () => {
    vi.useFakeTimers();
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    await readableAssistantRow(CALLER_KEY, ASSISTANT);
    vi.advanceTimersByTime(61_000);
    await readableAssistantRow(CALLER_KEY, ASSISTANT);

    expect(orchestraGet).toHaveBeenCalledTimes(2);
  });

  it('keeps callers and assistants apart', async () => {
    // One entry per (caller, assistant): a shared one would hand a second viewer
    // the first viewer's scope.
    orchestraGet.mockResolvedValue(ok({ info: [{ agent_id: 4211 }] }));
    const { readableAssistantRow } = await load();

    await readableAssistantRow(CALLER_KEY, ASSISTANT);
    await readableAssistantRow('other-caller-key', ASSISTANT);
    await readableAssistantRow(CALLER_KEY, '99');

    expect(orchestraGet).toHaveBeenCalledTimes(3);
    expect(createdWith).toHaveBeenNthCalledWith(2, 'other-caller-key');
  });
});

describe('assistantField', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('reads either casing', async () => {
    const { assistantField } = await load();

    expect(assistantField({ user_id: 'owner-1' }, 'user_id', 'userId')).toBe('owner-1');
    expect(assistantField({ userId: 'owner-1' }, 'user_id', 'userId')).toBe('owner-1');
  });

  it('stringifies so a numeric id compares against a path segment', async () => {
    const { assistantField } = await load();

    expect(assistantField({ agent_id: 4211 }, 'agent_id', 'agentId')).toBe('4211');
  });

  it('returns null for an absent or null field rather than the string "null"', async () => {
    const { assistantField } = await load();

    expect(assistantField({}, 'user_id', 'userId')).toBeNull();
    expect(assistantField({ user_id: null }, 'user_id', 'userId')).toBeNull();
  });
});
