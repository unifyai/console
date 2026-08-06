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
  const onSupplySecret = vi.fn();
  render(
    <WorkflowRequirementList
      workflow={workflow(requirements)}
      onConnect={onConnect}
      onSupplySecret={onSupplySecret}
    />
  );
  return { onConnect, onSupplySecret };
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
