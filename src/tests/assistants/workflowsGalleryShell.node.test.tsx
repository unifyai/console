import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowsGalleryShell } from '@/components/Workflows/WorkflowsGalleryShell';
import type { Workflow, WorkflowGalleryItem, WorkflowInstallation } from '@/types/workflows';

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
  overrides: Partial<WorkflowInstallation> & Pick<WorkflowInstallation, 'slug' | 'status'>
): WorkflowInstallation {
  return {
    installedVersion: '1.0.0',
    destination: { kind: 'personal' },
    params: {},
    installedAtLabel: 'Today',
    tasks: [],
    ...overrides,
  };
}

const activeItem: WorkflowGalleryItem = {
  workflow: workflow({ slug: 'active-flow', name: 'Active flow', category: 'comms' }),
  installation: installation({ slug: 'active-flow', status: 'active' }),
};
const heldItem: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'held-flow',
    name: 'Held flow',
    category: 'growth',
    requirements: [
      { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
    ],
  }),
  installation: installation({ slug: 'held-flow', status: 'pending_requirements' }),
};
const partialItem: WorkflowGalleryItem = {
  workflow: workflow({ slug: 'partial-flow', name: 'Partial flow', category: 'build' }),
  installation: installation({
    slug: 'partial-flow',
    status: 'partial',
    failures: [{ kind: 'functions', name: 'fn', reason: 'build failed' }],
  }),
};
const availableItem: WorkflowGalleryItem = {
  workflow: workflow({
    slug: 'shelf-flow',
    name: 'Shelf flow',
    category: 'ops',
    requirements: [
      { canonicalSlug: 'slack', displayName: 'Slack', via: 'connection', connected: true },
    ],
  }),
};

function renderShell(items: WorkflowGalleryItem[]) {
  const handlers = {
    onOpen: vi.fn(),
    onInstall: vi.fn(),
    onConnect: vi.fn(),
    onToggleSetup: vi.fn(),
    onRetry: vi.fn(),
  };
  const utils = render(<WorkflowsGalleryShell items={items} {...handlers} />);
  return { ...utils, handlers };
}

describe('WorkflowsGalleryShell', () => {
  it('lands on Installed once installs exist, and on Browse when nothing is installed', () => {
    const { unmount } = renderShell([activeItem, availableItem]);
    expect(screen.getByTestId('installed-workflow-active-flow')).toBeVisible();
    unmount();

    renderShell([availableItem]);
    expect(screen.getByTestId('workflow-card-shelf-flow')).toBeVisible();
  });

  it('sorts installed rows attention-first: partial, then held, then active', () => {
    renderShell([activeItem, heldItem, partialItem]);
    const rows = screen
      .getAllByTestId(/^installed-workflow-/)
      .map((row) => row.getAttribute('data-testid'));
    expect(rows).toEqual([
      'installed-workflow-partial-flow',
      'installed-workflow-held-flow',
      'installed-workflow-active-flow',
    ]);
  });

  it('counts only held and partial installs as needing attention', () => {
    renderShell([activeItem, heldItem, partialItem]);
    expect(screen.getByTestId('workflow-attention-count')).toHaveTextContent('2 need attention');
  });

  it('filters Browse by committed search, matching required app names too', () => {
    renderShell([availableItem, { workflow: workflow({ slug: 'other', name: 'Other flow' }) }]);
    const search = screen.getByTestId('workflow-gallery-search');
    fireEvent.change(search, { target: { value: 'Slack' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(screen.getByTestId('workflow-card-shelf-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-card-other')).not.toBeInTheDocument();
  });

  it('filters Browse by category segment', () => {
    renderShell([
      availableItem,
      { workflow: workflow({ slug: 'growth-flow', name: 'Growth flow', category: 'growth' }) },
    ]);
    fireEvent.click(screen.getByTestId('workflow-category-growth'));
    expect(screen.getByTestId('workflow-card-growth-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-card-shelf-flow')).not.toBeInTheDocument();
  });

  it('offers Browse from the empty Installed state', () => {
    renderShell([availableItem]);
    fireEvent.click(within(screen.getByTestId('workflow-tab-filter')).getByText('Installed'));
    fireEvent.click(screen.getByTestId('workflow-empty-browse'));
    expect(screen.getByTestId('workflow-card-shelf-flow')).toBeVisible();
  });
});
