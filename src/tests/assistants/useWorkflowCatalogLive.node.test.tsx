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
  brain.fetchBrainContext.mockImplementation(async (_a: unknown, context: string) => {
    if (context === 'Workflows/Catalog') return page(catalog);
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

    expect(result.current.items[0].installation?.status).toBe('failed');
  });

  it('reports mutations as non-persisting outside mock mode', async () => {
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive();
    expect(result.current.canMutate).toBe(false);
  });

  it('still short-circuits to the mock catalogue when mock mode is on', async () => {
    mockData.shouldUseMockWorkflows.mockReturnValue(true);
    respondWith({ catalog: [CATALOG_ROW] });
    const { result } = await renderLive();

    expect(result.current.isMock).toBe(true);
    expect(result.current.canMutate).toBe(true);
    expect(brain.fetchBrainContext).not.toHaveBeenCalled();
  });
});
