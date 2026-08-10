import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowsPane } from '@/components/Pages/Assistants/Workflows/WorkflowsPane';
import type { Assistant } from '@/types/assistants/assistant';
import type { WorkflowGalleryItem } from '@/types/workflows';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const navigateToAssistants = vi.fn();
vi.mock('@/lib/navigation/AppShellRouter', () => ({
  useAppShellNavigation: () => ({ navigateToAssistants }),
}));

const mockData = vi.hoisted(() => ({
  items: [] as unknown[],
  shouldUseMockWorkflows: vi.fn(() => true),
}));
vi.mock('@/utils/assistants/workflow-mock-data', () => ({
  shouldUseMockWorkflows: mockData.shouldUseMockWorkflows,
  mockWorkflowArtifacts: () => [],
  get MOCK_WORKFLOW_GALLERY_ITEMS() {
    return mockData.items;
  },
}));

// The pane test is about the pane's wiring, not the children's DOM — replace
// the heavy presentational children with testid-only stubs that expose the
// callbacks the pane must thread through.
vi.mock('@/components/Workflows/WorkflowsGalleryShell', () => ({
  WorkflowsGalleryShell: ({
    items,
    onOpen,
    onConnect,
    onConnectWorkspace,
    renderDetailSheet,
  }: {
    items: WorkflowGalleryItem[];
    onOpen: (item: WorkflowGalleryItem) => void;
    onConnect: (canonicalSlug: string) => void;
    onConnectWorkspace?: () => void;
    renderDetailSheet?: () => React.ReactNode;
  }) => (
    <div data-testid="workflow-gallery-stub">
      <span data-testid="workflow-gallery-count">{items.length}</span>
      <button data-testid="request-connect-notion" onClick={() => onConnect('notion')}>
        Connect Notion
      </button>
      <button
        data-testid="request-connect-workspace"
        disabled={!onConnectWorkspace}
        onClick={() => onConnectWorkspace?.()}
      >
        Connect Workspace
      </button>
      {items.map((item) => (
        <button
          key={item.workflow.slug}
          data-testid={`open-workflow-${item.workflow.slug}`}
          onClick={() => onOpen(item)}
        >
          {item.workflow.name}
        </button>
      ))}
      {renderDetailSheet?.()}
    </div>
  ),
}));

vi.mock('@/components/Workflows/WorkflowDetailSheet', () => ({
  WorkflowDetailSheet: ({
    item,
    open,
    onNavigate,
    onWatchInActions,
    onUninstall,
  }: {
    item: WorkflowGalleryItem | null;
    open: boolean;
    onNavigate?: (kind: string) => void;
    onWatchInActions?: () => void;
    onUninstall: (item: WorkflowGalleryItem) => void;
  }) =>
    open && item ? (
      <div data-testid={`sheet-${item.workflow.slug}`}>
        <button data-testid="sheet-open-tasks" onClick={() => onNavigate?.('tasks')} />
        <button data-testid="sheet-open-tables" onClick={() => onNavigate?.('tables')} />
        <button data-testid="sheet-watch-actions" onClick={() => onWatchInActions?.()} />
        <button data-testid="sheet-uninstall" onClick={() => onUninstall(item)} />
      </div>
    ) : null,
}));

vi.mock('./../../components/Pages/Assistants/Workflows/WorkflowConnectAppSheet', () => ({
  WorkflowConnectAppSheet: ({
    canonicalSlug,
    open,
    onConnected,
  }: {
    canonicalSlug: string | null;
    open: boolean;
    onConnected: (slug: string) => void;
  }) =>
    open && canonicalSlug ? (
      <button
        data-testid={`connect-sheet-${canonicalSlug}`}
        onClick={() => onConnected(canonicalSlug)}
      >
        Connect
      </button>
    ) : null,
}));

vi.mock('@/components/Workflows/UninstallWorkflowDialog', () => ({
  UninstallWorkflowDialog: ({
    item,
    open,
    onConfirm,
  }: {
    item: WorkflowGalleryItem | null;
    open: boolean;
    onConfirm: (options: { keepData: boolean }) => void;
  }) =>
    open && item ? (
      <button data-testid="confirm-uninstall" onClick={() => onConfirm({ keepData: true })}>
        Uninstall
      </button>
    ) : null,
}));

const installedItem: WorkflowGalleryItem = {
  workflow: {
    slug: 'alpha',
    name: 'Alpha',
    category: 'ops',
    description: 'Test workflow.',
    about: '',
    version: '1.0.0',
    iconId: 'briefing',
    requirements: [],
    capabilities: [],
    paramsSchema: [],
    sets: { tasks: [{ name: 'Alpha task', schedule: 'Every day' }] },
  },
  installation: {
    slug: 'alpha',
    status: 'active',
    installedVersion: '1.0.0',
    destination: { kind: 'personal' },
    params: {},
    installedAtLabel: 'Today',
    tasks: [],
  },
};
const shelfItem: WorkflowGalleryItem = {
  workflow: { ...installedItem.workflow, slug: 'bravo', name: 'Bravo' },
};

async function renderPane() {
  const utils = render(<WorkflowsPane ownerId="owner-1" assistantId="assistant-1" />);
  await waitFor(() => expect(screen.getByTestId('workflow-gallery-count')).toHaveTextContent('2'));
  return utils;
}

describe('WorkflowsPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.shouldUseMockWorkflows.mockReturnValue(true);
    mockData.items = [installedItem, shelfItem];
  });

  it('summarises install state in the footer as "N of M workflows installed"', async () => {
    await renderPane();
    expect(screen.getByTestId('workflows-footer')).toHaveTextContent('1 of 2 workflows installed');
  });

  it('routes manifest link-outs to the rail section where each surface lives', async () => {
    await renderPane();
    fireEvent.click(screen.getByTestId('open-workflow-alpha'));
    fireEvent.click(screen.getByTestId('sheet-open-tasks'));
    expect(navigateToAssistants).toHaveBeenCalledWith({ sectionId: 'tasks' });

    fireEvent.click(screen.getByTestId('sheet-open-tables'));
    expect(navigateToAssistants).toHaveBeenCalledWith({ sectionId: 'data' });

    fireEvent.click(screen.getByTestId('sheet-watch-actions'));
    expect(navigateToAssistants).toHaveBeenCalledWith({ sectionId: 'actions' });
  });

  it('uninstalls through the confirm dialog and closes both overlays', async () => {
    await renderPane();
    fireEvent.click(screen.getByTestId('open-workflow-alpha'));
    fireEvent.click(screen.getByTestId('sheet-uninstall'));
    fireEvent.click(screen.getByTestId('confirm-uninstall'));

    await waitFor(() =>
      expect(screen.getByTestId('workflows-footer')).toHaveTextContent('0 of 2 workflows installed')
    );
    expect(screen.queryByTestId('sheet-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-uninstall')).not.toBeInTheDocument();
  });

  it('connects a required app in place rather than navigating to Integrations', async () => {
    await renderPane();
    fireEvent.click(screen.getByTestId('request-connect-notion'));

    // The provider drawer opens over the shelf; nothing navigates away.
    expect(screen.getByTestId('connect-sheet-notion')).toBeInTheDocument();
    expect(navigateToAssistants).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('connect-sheet-notion'));
    await waitFor(() =>
      expect(screen.queryByTestId('connect-sheet-notion')).not.toBeInTheDocument()
    );
    expect(navigateToAssistants).not.toHaveBeenCalled();
  });

  it('opens the workspace manager for a workspace requirement, not the provider drawer', async () => {
    // Connecting a Workspace has to be the same act as connecting one from
    // the profile or onboarding panes: the page's own manager, not a
    // Workflows-local imitation and not the integrations gallery.
    const onConnectWorkspace = vi.fn();
    const assistant = { agentId: 'assistant-1', userId: 'owner-1' } as Assistant;
    render(
      <WorkflowsPane
        ownerId="owner-1"
        assistantId="assistant-1"
        assistant={assistant}
        onConnectWorkspace={onConnectWorkspace}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('workflow-gallery-count')).toHaveTextContent('2')
    );

    fireEvent.click(screen.getByTestId('request-connect-workspace'));
    expect(onConnectWorkspace).toHaveBeenCalledWith(assistant);
    expect(navigateToAssistants).not.toHaveBeenCalled();
    expect(screen.queryByTestId('connect-sheet-google_workspace')).not.toBeInTheDocument();
  });

  it('offers no workspace affordance when the page supplies no opener', async () => {
    await renderPane();
    expect(screen.getByTestId('request-connect-workspace')).toBeDisabled();
  });

  it('does not fetch the catalog while hidden', async () => {
    render(<WorkflowsPane ownerId="owner-1" assistantId="assistant-1" isVisible={false} />);
    expect(screen.getByTestId('workflow-gallery-count')).toHaveTextContent('0');
    expect(mockData.shouldUseMockWorkflows).not.toHaveBeenCalled();
  });
});
