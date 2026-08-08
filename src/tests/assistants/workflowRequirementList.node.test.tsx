import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowRequirementList } from '@/components/Workflows/WorkflowRequirementList';
import type { Workflow, WorkflowRequirement } from '@/types/workflows';

function workflow(requirements: WorkflowRequirement[]): Workflow {
  return {
    slug: 'alpha',
    name: 'Alpha',
    category: 'ops',
    description: 'Test workflow.',
    about: '',
    version: '1.0.0',
    iconId: 'briefing',
    requirements,
    capabilities: [],
    paramsSchema: [],
    sets: {},
  };
}

function renderList(requirements: WorkflowRequirement[]) {
  const onConnect = vi.fn();
  const onConnectWorkspace = vi.fn();
  const onSupplySecret = vi.fn();
  render(
    <WorkflowRequirementList
      workflow={workflow(requirements)}
      onConnect={onConnect}
      onConnectWorkspace={onConnectWorkspace}
      onSupplySecret={onSupplySecret}
    />
  );
  return { onConnect, onConnectWorkspace, onSupplySecret };
}

/**
 * The affordance follows the connection route. Offering OAuth for an app
 * gated on a secret sends the user somewhere that cannot help them, which is
 * worse than offering nothing — so each route is pinned separately.
 */
describe('WorkflowRequirementList', () => {
  it('offers connect, and no secret prompt, for an unconnected provider-backed app', () => {
    const { onConnect, onSupplySecret } = renderList([
      { canonicalSlug: 'notion', displayName: 'Notion', via: 'connection', connected: false },
    ]);

    expect(screen.queryByTestId('workflow-requirement-secret-notion')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workflow-requirement-connect-notion'));
    expect(onConnect).toHaveBeenCalledWith('notion');
    expect(onSupplySecret).not.toHaveBeenCalled();
  });

  it('names the missing secrets, and offers no OAuth, for a secret-gated app', () => {
    const { onConnect, onSupplySecret } = renderList([
      {
        canonicalSlug: 'google_drive',
        displayName: 'Google Drive',
        via: 'secret',
        connected: false,
        missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
      },
    ]);

    expect(
      screen.queryByTestId('workflow-requirement-connect-google_drive')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('workflow-requirement-google_drive')).toHaveTextContent(
      'Needs GOOGLE_REFRESH_TOKEN'
    );

    fireEvent.click(screen.getByTestId('workflow-requirement-secret-google_drive'));
    expect(onSupplySecret).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('sends a workspace requirement to the workspace manager, never to secrets', () => {
    // Workspace is connected in the manager the profile pane and the
    // onboarding checklist open. It used to fall through to "Add secrets",
    // which named the refresh token the connection happens to write and
    // routed nowhere at all.
    const { onConnect, onConnectWorkspace, onSupplySecret } = renderList([
      {
        canonicalSlug: 'google_workspace',
        displayName: 'Google Workspace',
        via: 'workspace',
        connected: false,
        missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
      },
    ]);

    expect(
      screen.queryByTestId('workflow-requirement-secret-google_workspace')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('workflow-requirement-google_workspace')).toHaveTextContent(
      'No workspace connected'
    );

    fireEvent.click(screen.getByTestId('workflow-requirement-workspace-google_workspace'));
    expect(onConnectWorkspace).toHaveBeenCalledTimes(1);
    expect(onSupplySecret).not.toHaveBeenCalled();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('reads a connected workspace as met, with nothing left to do', () => {
    renderList([
      {
        canonicalSlug: 'google_workspace',
        displayName: 'Google Workspace',
        via: 'workspace',
        connected: true,
      },
    ]);

    expect(screen.getByTestId('workflow-requirement-met-google_workspace')).toHaveTextContent(
      'Connected'
    );
    expect(
      screen.queryByTestId('workflow-requirement-workspace-google_workspace')
    ).not.toBeInTheDocument();
  });

  it('treats a native package the same way, naming every secret it waits on', () => {
    renderList([
      {
        canonicalSlug: 'employmenthero',
        displayName: 'Employment Hero',
        via: 'native_package',
        connected: false,
        missingSecrets: ['EMPLOYMENT_HERO_CLIENT_ID', 'EMPLOYMENT_HERO_CLIENT_SECRET'],
      },
    ]);

    const row = screen.getByTestId('workflow-requirement-employmenthero');
    expect(row).toHaveTextContent('EMPLOYMENT_HERO_CLIENT_ID');
    expect(row).toHaveTextContent('EMPLOYMENT_HERO_CLIENT_SECRET');
    expect(
      screen.queryByTestId('workflow-requirement-connect-employmenthero')
    ).not.toBeInTheDocument();
  });

  it('reads a connection-satisfied app as met even with a secret outstanding', () => {
    renderList([
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        connected: true,
        accountLabel: 'haris@unify.ai',
        missingSecrets: ['GOOGLE_REFRESH_TOKEN'],
      },
    ]);

    expect(screen.getByTestId('workflow-requirement-met-gmail')).toHaveTextContent('Connected');
    expect(screen.queryByTestId('workflow-requirement-secret-gmail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-requirement-connect-gmail')).not.toBeInTheDocument();
  });

  it('renders an undeclared requirement as built in, with nothing to do', () => {
    renderList([
      { canonicalSlug: 'web', displayName: 'Web browsing', via: 'undeclared', connected: false },
    ]);

    expect(screen.getByTestId('workflow-requirement-met-web')).toHaveTextContent('Built in');
    expect(screen.queryByTestId('workflow-requirement-connect-web')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-requirement-secret-web')).not.toBeInTheDocument();
  });

  it('renders an unresolved requirement as unverified — never a green check', () => {
    renderList([
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'unresolved',
        connected: false,
      },
    ]);

    expect(screen.getByTestId('workflow-requirement-unresolved-gmail')).toHaveTextContent(
      'Unverified'
    );
    expect(screen.getByText("Couldn't check this app — see the Integrations gallery")).toBeTruthy();
    expect(screen.queryByTestId('workflow-requirement-met-gmail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-requirement-connect-gmail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-requirement-secret-gmail')).not.toBeInTheDocument();
  });
});

/**
 * The skeletons exist; what regressed is them never being reached.
 *
 * `WorkflowDetailSheet` destructured `requirementsResolving` and never
 * passed it on, so every requirement rendered its greyed "Unverified" row
 * for as long as the catalogue took — the skeleton branch below was dead
 * code the whole time. A prop dropped between a parent and its child is
 * invisible to a test of either one alone, so this renders the sheet.
 */
describe('WorkflowDetailSheet — while requirements are unresolved', () => {
  const item = {
    workflow: {
      ...workflow([
        { canonicalSlug: 'gmail', displayName: 'Gmail', via: 'unresolved', connected: false },
      ]),
      paramsSchema: [],
    },
  };

  it('shows placeholders rather than a verdict, and holds the install button', async () => {
    const { WorkflowDetailSheet } = await import('@/components/Workflows/WorkflowDetailSheet');
    render(
      <WorkflowDetailSheet
        item={item}
        open
        requirementsResolving
        onOpenChange={vi.fn()}
        onConnect={vi.fn()}
        onInstall={vi.fn()}
        onSaveParams={vi.fn()}
        onUninstall={vi.fn()}
        onToggleSetup={vi.fn()}
        onStopSetup={vi.fn()}
        onRetry={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    // No "Unverified", no grey letter-plate standing in for a logo.
    expect(screen.queryByTestId('workflow-requirement-unresolved-gmail')).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't check this app/)).not.toBeInTheDocument();
    // And nothing installable on a verdict we do not have.
    expect(screen.getByRole('button', { name: /install/i })).toBeDisabled();
  });

  it('states the verdict once there is one', async () => {
    const { WorkflowDetailSheet } = await import('@/components/Workflows/WorkflowDetailSheet');
    render(
      <WorkflowDetailSheet
        item={item}
        open
        requirementsResolving={false}
        onOpenChange={vi.fn()}
        onConnect={vi.fn()}
        onInstall={vi.fn()}
        onSaveParams={vi.fn()}
        onUninstall={vi.fn()}
        onToggleSetup={vi.fn()}
        onStopSetup={vi.fn()}
        onRetry={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId('workflow-requirement-unresolved-gmail')).toBeInTheDocument();
  });
});
