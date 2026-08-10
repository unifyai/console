import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflowCatalog, workflowRequestCopy } from '@/hooks/Workflows/useWorkflowCatalog';
import type { Assistant } from '@/types/assistants/assistant';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const mockData = vi.hoisted(() => ({ shouldUseMockWorkflows: vi.fn(() => false) }));
vi.mock('@/utils/assistants/workflow-mock-data', () => ({
  shouldUseMockWorkflows: mockData.shouldUseMockWorkflows,
  MOCK_WORKFLOW_GALLERY_ITEMS: [],
}));

const brain = vi.hoisted(() => ({ fetchBrainContext: vi.fn() }));
vi.mock('@/lib/client/brain', () => ({ fetchBrainContext: brain.fetchBrainContext }));

const client = vi.hoisted(() => ({
  fetchWorkflowsCatalog: vi.fn(),
  fetchWorkflowInstallations: vi.fn(),
  submitWorkflowRequest: vi.fn(),
  fetchWorkflowRequests: vi.fn(),
}));
vi.mock('@/lib/client/workflows', () => client);

const assistant = { agentId: 123, userId: 'user-1' } as unknown as Assistant;

const CATALOG_ROW = {
  slug: 'daily-briefing',
  name: 'Daily briefing',
  version: '1.2.0',
  category: 'comms',
  iconId: 'briefing',
  description: 'Before stand-up.',
  requirements: [],
  sets: { tasks: [{ name: 'Daily briefing', schedule: 'Every weekday at 08:30' }] },
};

async function renderLive() {
  const rendered = renderHook(() => useWorkflowCatalog('123', { assistant }));
  await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));
  return rendered;
}

/**
 * The shelf records an intent and the assistant carries it out. Everything
 * between those two facts used to be a local animation that settled green no
 * matter what happened, so a claimed-and-failing install was indistinguishable
 * from a successful one. These pin the row as the source of truth.
 */
describe('useWorkflowCatalog — recorded request state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.shouldUseMockWorkflows.mockReturnValue(false);
    client.fetchWorkflowsCatalog.mockResolvedValue([CATALOG_ROW]);
    client.fetchWorkflowInstallations.mockResolvedValue([]);
    client.fetchWorkflowRequests.mockResolvedValue([]);
    brain.fetchBrainContext.mockResolvedValue({ rows: [], count: 0, fields: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks a dispatched install as pending, not as an installation', async () => {
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-1', dispatched: true });
    const { result } = await renderLive();

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });

    await waitFor(() =>
      expect(result.current.requests['daily-briefing']).toMatchObject({
        requestId: 'req-1',
        action: 'install',
        status: 'pending',
        dispatched: true,
      })
    );
    // Nothing is claimed installed until the assistant says so.
    expect(result.current.items[0].installation).toBeUndefined();
  });

  it('says "queued" when the row is durable but nobody was woken', async () => {
    // The honest reading of a missing ORCHESTRA_ADMIN_KEY or an unreachable
    // Orchestra: the change will happen, just not now.
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-2', dispatched: false });
    const { result } = await renderLive();

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });

    await waitFor(() => expect(result.current.requests['daily-briefing'].status).toBe('queued'));
    expect(workflowRequestCopy(result.current.requests['daily-briefing'])).toContain(
      'next time they wake up'
    );
  });

  it('reads a failure off the row, with the reason the assistant recorded', async () => {
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-3', dispatched: true });
    const { result } = await renderLive();

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });
    await waitFor(() => expect(result.current.requests['daily-briefing']).toBeDefined());

    client.fetchWorkflowRequests.mockResolvedValue([
      {
        requestId: 'req-3',
        slug: 'daily-briefing',
        status: 'failed',
        error: JSON.stringify({ tasks: 'schedule rejected by the scheduler' }),
      },
    ]);

    await waitFor(
      () =>
        expect(result.current.requests['daily-briefing']).toMatchObject({
          status: 'failed',
          error: 'tasks: schedule rejected by the scheduler',
        }),
      { timeout: 6000 }
    );
    expect(workflowRequestCopy(result.current.requests['daily-briefing'])).toBe(
      'tasks: schedule rejected by the scheduler'
    );
  });

  it('re-reads the catalogue once the assistant reports the change landed', async () => {
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-4', dispatched: true });
    const { result } = await renderLive();
    const readsBefore = client.fetchWorkflowsCatalog.mock.calls.length;

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });
    await waitFor(() => expect(result.current.requests['daily-briefing']).toBeDefined());

    client.fetchWorkflowRequests.mockResolvedValue([
      { requestId: 'req-4', slug: 'daily-briefing', status: 'succeeded', error: '{}' },
    ]);

    // The assistant's own installation rows replace the optimistic copy.
    await waitFor(
      () => expect(client.fetchWorkflowsCatalog.mock.calls.length).toBeGreaterThan(readsBefore),
      { timeout: 6000 }
    );
  });

  it('stops polling once nothing is in flight', async () => {
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-5', dispatched: true });
    const { result } = await renderLive();

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });
    await waitFor(() => expect(result.current.requests['daily-briefing']).toBeDefined());

    client.fetchWorkflowRequests.mockResolvedValue([
      { requestId: 'req-5', slug: 'daily-briefing', status: 'succeeded', error: '{}' },
    ]);
    await waitFor(
      () => expect(result.current.requests['daily-briefing'].status).toBe('succeeded'),
      { timeout: 6000 }
    );

    const readsAfterSettle = client.fetchWorkflowRequests.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 3200));
    expect(client.fetchWorkflowRequests.mock.calls.length).toBe(readsAfterSettle);
    // Real intervals: a settle plus a full quiet period is longer than the
    // default per-test budget, and faking timers here would stop asserting
    // the thing that matters — that the interval is actually torn down.
  }, 20_000);

  it('lets a settled request be dismissed so the card returns to its own state', async () => {
    client.submitWorkflowRequest.mockResolvedValue({ requestId: 'req-6', dispatched: false });
    const { result } = await renderLive();

    await act(async () => {
      result.current.install('daily-briefing', {}, { kind: 'personal' });
    });
    await waitFor(() => expect(result.current.requests['daily-briefing']).toBeDefined());

    act(() => result.current.dismissRequest('daily-briefing'));
    expect(result.current.requests['daily-briefing']).toBeUndefined();
  });
});
