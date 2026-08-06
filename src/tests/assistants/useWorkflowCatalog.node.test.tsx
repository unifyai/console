import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useWorkflowCatalog } from '@/hooks/Workflows/useWorkflowCatalog';
import type { Workflow, WorkflowGalleryItem, WorkflowInstallation } from '@/types/workflows';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockData = vi.hoisted(() => ({
  items: [] as unknown[],
  shouldUseMockWorkflows: vi.fn(() => true),
}));

vi.mock('@/utils/assistants/workflow-mock-data', () => ({
  shouldUseMockWorkflows: mockData.shouldUseMockWorkflows,
  get MOCK_WORKFLOW_GALLERY_ITEMS() {
    return mockData.items;
  },
}));

function workflow(overrides: Partial<Workflow> & Pick<Workflow, 'slug' | 'name'>): Workflow {
  return {
    category: 'ops',
    description: 'Test workflow.',
    about: '',
    version: '1.0.0',
    iconId: 'briefing',
    requirements: [],
    capabilities: [],
    paramsSchema: [],
    sets: {},
    ...overrides,
  };
}

function installation(
  overrides: Partial<WorkflowInstallation> & Pick<WorkflowInstallation, 'slug'>
): WorkflowInstallation {
  return {
    status: 'active',
    installedVersion: '1.0.0',
    destination: { kind: 'personal' },
    params: {},
    installedAtLabel: 'Today',
    tasks: [],
    ...overrides,
  };
}

/** Clean install: everything connected, one recurring task, no one-shot. */
const alpha: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'alpha',
    name: 'Alpha',
    requirements: [
      { canonicalSlug: 'gmail', displayName: 'Gmail', via: 'connection', connected: true },
    ],
    sets: {
      procedures: [{ name: 'Alpha procedure' }],
      tasks: [{ name: 'Alpha task', schedule: 'Every day at 9:00am' }],
    },
  }),
};

/** Held install: Notion is not connected. */
const bravo: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'bravo',
    name: 'Bravo',
    requirements: [
      { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
    ],
    sets: { tasks: [{ name: 'Bravo task', schedule: 'Every Friday at 4:30pm' }] },
  }),
};

/** Provisioning install: carries a "Once, at install" job. */
const charlie: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'charlie',
    name: 'Charlie',
    requirements: [
      { canonicalSlug: 'gmail', displayName: 'Gmail', via: 'connection', connected: true },
    ],
    sets: {
      tasks: [
        { name: 'Charlie recurring', schedule: 'Every Monday at 7:00am' },
        { name: 'Backfill history', schedule: 'Once, at install', runsOnce: true },
      ],
    },
  }),
};

/** Pre-installed and held on the same missing Notion connection as bravo. */
const echo: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'echo',
    name: 'Echo',
    requirements: [
      { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
    ],
    sets: { tasks: [{ name: 'Echo task', schedule: 'Every day at 8:00am' }] },
  }),
  installation: installation({
    slug: 'echo',
    status: 'pending_requirements',
    tasks: [
      {
        taskId: 'echo-task-0',
        name: 'Echo task',
        enabled: false,
        nextRunLabel: 'Held — waiting on a connection',
        lastRunLabel: 'Never run',
        lastRunOutcome: 'never',
        href: '',
      },
    ],
  }),
};

/** Pre-installed mid-provisioning with a steerable setup pass. */
const foxtrot: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'foxtrot',
    name: 'Foxtrot',
    version: '1.1.0',
    sets: { tasks: [{ name: 'Foxtrot task', schedule: 'Every day at 7:00pm' }] },
  }),
  installation: installation({
    slug: 'foxtrot',
    status: 'provisioning',
    installedVersion: '1.0.0',
    setup: {
      label: 'Backfilling',
      percent: 40,
      detail: 'in flight',
      etaLabel: 'a few minutes left',
      paused: false,
    },
    tasks: [
      {
        taskId: 'foxtrot-task-0',
        name: 'Foxtrot task',
        enabled: false,
        nextRunLabel: 'Arms when setup finishes',
        lastRunLabel: 'Never run',
        lastRunOutcome: 'never',
        href: '',
      },
    ],
  }),
};

/** Pre-installed with two surfaces that failed to plant. */
const golf: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'golf',
    name: 'Golf',
    sets: { functions: [{ name: 'golf_fn' }] },
  }),
  installation: installation({
    slug: 'golf',
    status: 'partial',
    failures: [{ kind: 'functions', name: 'golf_fn', reason: 'build failed' }],
  }),
};

function itemBySlug(result: { items: WorkflowGalleryItem[] }, slug: string) {
  const found = result.items.find((item) => item.workflow.slug === slug);
  if (!found) throw new Error(`no item ${slug}`);
  return found;
}

async function renderCatalog() {
  const rendered = renderHook(() => useWorkflowCatalog('assistant-1'));
  await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));
  return rendered;
}

describe('useWorkflowCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.shouldUseMockWorkflows.mockReturnValue(true);
    mockData.items = [alpha, bravo, charlie, echo, foxtrot, golf];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves the mock catalog when mock mode is active and flags it', async () => {
    const { result } = await renderCatalog();
    expect(result.current.isMock).toBe(true);
    expect(result.current.items).toHaveLength(6);
  });

  it('stays loading on the live path until an assistant is available to read', async () => {
    // Reading the catalogue needs an assistant to scope the contexts to.
    // Reporting "loaded" without one would flash an empty shelf at a user
    // whose workflows are about to appear. Live reads are covered in
    // useWorkflowCatalogLive.node.test.tsx.
    mockData.shouldUseMockWorkflows.mockReturnValue(false);
    const { result } = renderHook(() => useWorkflowCatalog('assistant-1'));
    await act(async () => {});

    expect(result.current.isMock).toBe(false);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('does not load while disabled, then loads once enabled', async () => {
    const rendered = renderHook(
      ({ enabled }: { enabled: boolean }) => useWorkflowCatalog('assistant-1', { enabled }),
      { initialProps: { enabled: false } }
    );
    expect(rendered.result.current.hasLoaded).toBe(false);
    expect(rendered.result.current.items).toHaveLength(0);

    rendered.rerender({ enabled: true });
    await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));
    expect(rendered.result.current.items).toHaveLength(6);
  });

  describe('install settles into the documented states', () => {
    async function installAndSettle(slug: string, surfaceCount: number) {
      vi.useFakeTimers();
      const rendered = renderHook(() => useWorkflowCatalog('assistant-1'));
      await act(async () => {});
      expect(rendered.result.current.hasLoaded).toBe(true);

      act(() => {
        rendered.result.current.install(slug, { mailbox: 'a@unify.ai' }, { kind: 'personal' });
      });
      for (let step = 0; step <= surfaceCount; step += 1) {
        act(() => {
          vi.advanceTimersByTime(620);
        });
        await act(async () => {});
      }
      expect(rendered.result.current.provisioning).toBeNull();
      return rendered;
    }

    it('goes active with armed tasks when every requirement is met', async () => {
      const rendered = await installAndSettle('alpha', 2);
      const installed = itemBySlug(rendered.result.current, 'alpha').installation;
      expect(installed?.status).toBe('active');
      expect(installed?.params).toEqual({ mailbox: 'a@unify.ai' });
      expect(installed?.tasks[0]).toMatchObject({ enabled: true, nextRunLabel: 'As scheduled' });
    });

    it('plants held when a required app is unconnected', async () => {
      const rendered = await installAndSettle('bravo', 1);
      const installed = itemBySlug(rendered.result.current, 'bravo').installation;
      expect(installed?.status).toBe('pending_requirements');
      expect(installed?.tasks[0]).toMatchObject({
        enabled: false,
        nextRunLabel: 'Held — waiting on a connection',
      });
    });

    it('enters provisioning when the manifest carries a once-at-install job', async () => {
      const rendered = await installAndSettle('charlie', 1);
      const installed = itemBySlug(rendered.result.current, 'charlie').installation;
      expect(installed?.status).toBe('provisioning');
      expect(installed?.setup).toMatchObject({ label: 'Backfill history', percent: 4 });
      expect(installed?.tasks.every((task) => !task.enabled)).toBe(true);
    });
  });

  describe('connect loop', () => {
    it('arms every held installation whose requirements are now met, and says so', async () => {
      const { result } = await renderCatalog();
      act(() => {
        result.current.connect('notion');
      });

      const armed = itemBySlug(result.current, 'echo').installation;
      expect(armed?.status).toBe('active');
      expect(armed?.tasks[0]).toMatchObject({ enabled: true, nextRunLabel: 'As scheduled' });
      // bravo is not installed — connecting just marks its requirement met.
      expect(itemBySlug(result.current, 'bravo').workflow.requirements[0].connected).toBe(true);
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Notion connected — any held jobs are now armed.'
      );
    });

    it('confirms a connect that armed nothing with the plain toast', async () => {
      const { result } = await renderCatalog();
      act(() => {
        result.current.connect('gmail');
      });
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Gmail connected.');
    });
  });

  describe('setup steering', () => {
    it('pause toggles only the paused flag; stop keeps results and arms tasks', async () => {
      const { result } = await renderCatalog();

      act(() => {
        result.current.toggleSetup('foxtrot');
      });
      expect(itemBySlug(result.current, 'foxtrot').installation?.setup?.paused).toBe(true);
      expect(itemBySlug(result.current, 'foxtrot').installation?.status).toBe('provisioning');

      act(() => {
        result.current.stopSetup('foxtrot');
      });
      const stopped = itemBySlug(result.current, 'foxtrot').installation;
      expect(stopped?.status).toBe('active');
      expect(stopped?.setup).toBeUndefined();
      expect(stopped?.tasks[0]).toMatchObject({ enabled: true, nextRunLabel: 'As scheduled' });
    });
  });

  it('retry clears the failures and reactivates', async () => {
    const { result } = await renderCatalog();
    act(() => {
      result.current.retry('golf');
    });
    const retried = itemBySlug(result.current, 'golf').installation;
    expect(retried?.status).toBe('active');
    expect(retried?.failures).toBeUndefined();
  });

  it('update moves the installed version to the catalog version and keeps settings', async () => {
    const { result } = await renderCatalog();
    act(() => {
      result.current.saveParams('foxtrot', { sheet: 'Expenses' });
      result.current.update('foxtrot');
    });
    const updated = itemBySlug(result.current, 'foxtrot').installation;
    expect(updated?.installedVersion).toBe('1.1.0');
    expect(updated?.params).toEqual({ sheet: 'Expenses' });
  });

  it('uninstall removes the installation and keeps the catalog entry', async () => {
    const { result } = await renderCatalog();
    act(() => {
      result.current.uninstall('echo', { keepData: true });
    });
    expect(itemBySlug(result.current, 'echo').installation).toBeUndefined();
    expect(result.current.items).toHaveLength(6);
  });
});
