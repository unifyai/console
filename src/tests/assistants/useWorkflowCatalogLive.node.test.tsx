import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflowCatalog } from '@/hooks/Workflows/useWorkflowCatalog';
import type { RequirementResolutionContext } from '@/utils/workflows/requirementResolution';
import type { Assistant } from '@/types/assistants/assistant';
import type { IntegrationDefinition } from '@/types/integrations';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockData = vi.hoisted(() => ({ shouldUseMockWorkflows: vi.fn(() => false) }));
vi.mock('@/utils/assistants/workflow-mock-data', () => ({
  shouldUseMockWorkflows: mockData.shouldUseMockWorkflows,
  MOCK_WORKFLOW_GALLERY_ITEMS: [],
}));

const brain = vi.hoisted(() => ({ fetchBrainContext: vi.fn() }));
vi.mock('@/lib/client/brain', () => ({ fetchBrainContext: brain.fetchBrainContext }));

// The catalogue is platform data in the Builtins project, read through its
// own client rather than the per-assistant brain fetch.
const workflowsClient = vi.hoisted(() => ({ fetchWorkflowsCatalog: vi.fn() }));
vi.mock('@/lib/client/workflows', () => ({
  fetchWorkflowsCatalog: workflowsClient.fetchWorkflowsCatalog,
}));

const assistant = { agentId: 123, userId: 'user-1' } as unknown as Assistant;

function page(rows: Record<string, unknown>[]) {
  return { rows, count: rows.length, fields: [] };
}

/** Route every context this hook reads, so a join can be asserted end to end. */
function respondWith({
  catalog = [] as Record<string, unknown>[],
  installations = [] as Record<string, unknown>[],
  tasks = [] as Record<string, unknown>[],
}) {
  workflowsClient.fetchWorkflowsCatalog.mockResolvedValue(catalog);
  brain.fetchBrainContext.mockImplementation(async (_a: unknown, context: string) => {
    if (context === 'Workflows') return page(installations);
    if (context === 'Tasks') return page(tasks);
    return page([]);
  });
}

const CATALOG_ROW = {
  slug: 'daily-briefing',
  name: 'Daily briefing',
  version: '1.2.0',
  category: 'comms',
  iconId: 'briefing',
  description: 'Before stand-up.',
  requirements: [{ slug: 'notion', name: 'Notion' }],
  sets: { tasks: [{ name: 'Daily briefing', schedule: 'Every weekday at 08:30' }] },
};

async function renderLive(requirementContext?: RequirementResolutionContext) {
  const rendered = renderHook(() => useWorkflowCatalog('123', { assistant, requirementContext }));
  await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));
  return rendered;
}

describe('useWorkflowCatalog — live reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.shouldUseMockWorkflows.mockReturnValue(false);
  });

  it('reads a never-booted assistant as empty, not an error', async () => {
    // The catalogue publishes on first boot; until then there are no rows.
    respondWith({});
    const { result } = await renderLive();
    expect(result.current.items).toEqual([]);
    expect(result.current.isMock).toBe(false);
  });

  it('reads a catalogue row with no installation as available', async () => {
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive();

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].installation).toBeUndefined();
    expect(result.current.items[0].workflow.sets.tasks).toEqual([
      { name: 'Daily briefing', schedule: 'Every weekday at 08:30' },
    ]);
  });

  it('joins an installation onto its catalogue row by slug', async () => {
    respondWith({
      catalog: [CATALOG_ROW],
      installations: [{ slug: 'daily-briefing', status: 'active', version: '1.0.1' }],
      tasks: [{ taskId: 9, name: 'Daily briefing', lifecycle: 'scheduled', enabled: true }],
    });
    const { result } = await renderLive();

    const item = result.current.items[0];
    expect(item.installation?.status).toBe('active');
    expect(item.installation?.installedVersion).toBe('1.0.1');
    expect(item.installation?.tasks).toHaveLength(1);
  });

  it('filters the task read server-side by the slug that manages them', async () => {
    respondWith({
      catalog: [CATALOG_ROW],
      installations: [{ slug: 'daily-briefing', status: 'active' }],
    });
    await renderLive();

    const taskCall = brain.fetchBrainContext.mock.calls.find(([, context]) => context === 'Tasks');
    expect(taskCall?.[2]).toMatchObject({ filter: 'managed_by == "daily-briefing"' });
  });

  it('derives needs-connection from unmet requirements and holds the jobs', async () => {
    respondWith({
      catalog: [CATALOG_ROW],
      installations: [{ slug: 'daily-briefing', status: 'active' }],
      tasks: [{ taskId: 9, name: 'Daily briefing', lifecycle: 'scheduled', enabled: true }],
    });
    const { result } = await renderLive({
      definitionsBySlug: new Map([
        [
          'notion',
          {
            canonicalSlug: 'notion',
            displayName: 'Notion',
            status: 'not_connected',
            source: 'provider_backed',
            connections: [],
            iconUrl: null,
          },
        ],
      ]) as unknown as Map<string, IntegrationDefinition>,
      secretNames: new Set<string>(),
    });

    const installation = result.current.items[0].installation;
    // Never stored — derived at read time, because connections change without
    // the installation row being touched.
    expect(installation?.status).toBe('pending_requirements');
    expect(installation?.tasks.every((task) => !task.enabled)).toBe(true);
  });

  it('lets a stored partial outrank a derived needs-connection', async () => {
    respondWith({
      catalog: [CATALOG_ROW],
      installations: [{ slug: 'daily-briefing', status: 'partial' }],
    });
    const { result } = await renderLive({
      definitionsBySlug: new Map([
        [
          'notion',
          {
            canonicalSlug: 'notion',
            displayName: 'Notion',
            status: 'not_connected',
            source: 'provider_backed',
            connections: [],
            iconUrl: null,
          },
        ],
      ]) as unknown as Map<string, IntegrationDefinition>,
      secretNames: new Set<string>(),
    });

    expect(result.current.items[0].installation?.status).toBe('partial');
  });

  it('re-resolves requirements when the integrations context arrives late', async () => {
    respondWith({ catalog: [CATALOG_ROW] });
    const rendered = renderHook(
      (props: { requirementContext?: RequirementResolutionContext }) =>
        useWorkflowCatalog('123', { assistant, ...props }),
      { initialProps: {} as { requirementContext?: RequirementResolutionContext } }
    );
    await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));

    // Until the integrations catalogue answers, the requirement is honestly
    // unverified — freezing it here once rendered every app as "Built in".
    expect(rendered.result.current.items[0].workflow.requirements[0]).toMatchObject({
      canonicalSlug: 'notion',
      via: 'unresolved',
      connected: false,
    });

    rendered.rerender({
      requirementContext: {
        definitionsBySlug: new Map([
          [
            'notion',
            {
              canonicalSlug: 'notion',
              displayName: 'Notion',
              status: 'connected',
              source: 'provider_backed',
              connections: [{ id: 'c1', status: 'connected' }],
              iconUrl: null,
            },
          ],
        ]) as unknown as Map<string, IntegrationDefinition>,
        secretNames: new Set<string>(),
      },
    });

    expect(rendered.result.current.items[0].workflow.requirements[0]).toMatchObject({
      via: 'connection',
      connected: true,
    });
  });

  it('resolves against the supplied context rather than reporting unverified', async () => {
    // Regression: the pane once built a requirement context and then passed
    // `undefined` to break a render cycle, so resolution never ran at all and
    // every app — Gmail included — rendered as unverifiable forever.
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive({
      definitionsBySlug: new Map([
        [
          'notion',
          {
            canonicalSlug: 'notion',
            displayName: 'Notion',
            status: 'connected',
            source: 'provider_backed',
            connections: [{ id: 'c1', status: 'connected' }],
            iconUrl: 'https://cdn.example/notion.png',
          },
        ],
      ]) as unknown as Map<string, IntegrationDefinition>,
      secretNames: new Set<string>(),
    });

    const requirement = result.current.items[0].workflow.requirements[0];
    expect(requirement.via).not.toBe('unresolved');
    expect(requirement).toMatchObject({ via: 'connection', connected: true });
    expect(requirement.iconUrl).toBe('https://cdn.example/notion.png');
  });

  it('allows mutations once there is an assistant to record them against', async () => {
    // Mutations persist by recording a Workflows/Requests row for the
    // assistant to carry out, so an assistant is the whole precondition.
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive();
    expect(result.current.canMutate).toBe(true);
  });

  it('refuses mutations with no assistant to record them against', async () => {
    respondWith({ catalog: [CATALOG_ROW] });
    const rendered = renderHook(() => useWorkflowCatalog('123', { assistant: null }));
    expect(rendered.result.current.canMutate).toBe(false);
  });

  it('still short-circuits to the mock catalogue when mock mode is on', async () => {
    mockData.shouldUseMockWorkflows.mockReturnValue(true);
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive();

    expect(result.current.isMock).toBe(true);
    expect(result.current.canMutate).toBe(true);
    expect(brain.fetchBrainContext).not.toHaveBeenCalled();
    expect(workflowsClient.fetchWorkflowsCatalog).not.toHaveBeenCalled();
  });
});
