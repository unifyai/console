import * as React from 'react';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceProvider } from '@/components/Pages/Providers/WorkspaceProvider';
import { AssistantInfoSidePanelContent } from '@/components/Pages/Assistants/Profile/AssistantInfoSidePanelContent';
import { AssistantListItem } from '@/components/Pages/Assistants/List/AssistantListItem';
import { RIGHT_PANE_TABS } from '@/components/Pages/Assistants/RightPaneContainer';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import type { User } from '@/types/user';
import { server } from '@/tests/server';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: TestResizeObserver,
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function assistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agentId: 'coord-1',
    userId: 'user-1',
    organizationId: 10,
    isCoordinator: true,
    firstName: 'Atlas',
    surname: 'Guide',
    jobTitle: null,
    profilePhoto: null,
    profileVideo: null,
    age: null,
    nationality: null,
    about: null,
    phoneCountry: null,
    timezone: null,
    voiceId: null,
    voiceProvider: null,
    email: null,
    phone: null,
    assistantWhatsappNumber: null,
    assistantDiscordBotId: null,
    userPhone: null,
    userWhatsappNumber: null,
    userDiscordId: null,
    weeklyLimit: null,
    maxParallel: null,
    spaceIds: [],
    selfContactId: 1,
    bossContactId: 2,
    contactIdentityRoots: [],
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    ...overrides,
  };
}

function user(roleName: 'Owner' | 'Admin' | 'Member' = 'Owner'): User {
  return {
    id: 'user-1',
    name: 'Casey',
    lastName: 'Owner',
    jobTitle: '',
    bio: '',
    image: '',
    timezone: null,
    email: 'casey@example.com',
    phoneNumber: null,
    whatsappNumber: null,
    discordId: null,
    createdAt: '2026-05-01T10:00:00Z',
    apiKey: 'org-key',
    stripeCustomerId: '',
    organization: {
      name: 'Acme',
      roleId: roleName === 'Owner' ? 1 : roleName === 'Admin' ? 2 : 3,
      roleName,
    },
    organizations: [
      {
        id: 10,
        name: 'Acme',
        ownerId: 'user-1',
        roleId: roleName === 'Owner' ? 1 : roleName === 'Admin' ? 2 : 3,
        roleName,
        apiKey: 'org-key',
      },
    ],
  };
}

function renderWithWorkspace(
  ui: React.ReactElement,
  roleName: 'Owner' | 'Admin' | 'Member' = 'Owner'
) {
  return render(<WorkspaceProvider user={user(roleName)}>{ui}</WorkspaceProvider>);
}

function seedCoordinatorLogs(
  activities: Array<Record<string, unknown>> = [
    {
      activity_id: 'activity-1',
      phase: 'progress',
      stage: 'integration_setup',
      surfaces: ['chat'],
      title: 'Drafting the teammate plan',
      summary: 'Collecting roles and handoff rules.',
      checklist_item_id: 1,
      chat_prompt: 'What roles have you found so far?',
      chat_prompt_label: 'Ask for roles',
      correlation_id: 'corr-1',
      occurred_at: '2026-05-01T10:03:00Z',
      status: 'ok',
      error: null,
    },
  ]
) {
  server.use(
    http.get('/api/logs', ({ request }) => {
      const context = new URL(request.url).searchParams.get('context') ?? '';

      if (context.endsWith('/Coordinator/State')) {
        return HttpResponse.json({
          logs: [
            {
              entries: {
                mode: 'active',
                started_at: '2026-05-01T10:00:00Z',
                ready_at: null,
              },
            },
          ],
          count: 1,
        });
      }

      if (context.endsWith('/Coordinator/Checklist')) {
        return HttpResponse.json({
          logs: [
            {
              entries: {
                item_id: 1,
                title: 'Invite operators',
                description: 'Add the people who receive assignments.',
                kind: 'team_setup',
                status: 'pending',
                created_at: '2026-05-01T10:00:00Z',
                updated_at: '2026-05-01T10:00:00Z',
              },
            },
            {
              entries: {
                item_id: 2,
                title: 'Validate first run',
                description: null,
                kind: null,
                status: 'done',
                created_at: '2026-05-01T10:01:00Z',
                updated_at: '2026-05-01T10:01:00Z',
              },
            },
            {
              entries: {
                item_id: 3,
                title: 'Revisit billing export',
                description: null,
                kind: null,
                status: 'skipped',
                created_at: '2026-05-01T10:02:00Z',
                updated_at: '2026-05-01T10:02:00Z',
              },
            },
          ],
          count: 3,
        });
      }

      if (context.endsWith('/Events/CoordinatorActivity')) {
        return HttpResponse.json({
          logs: activities.map((entries) => ({ entries })),
          count: activities.length,
        });
      }

      return HttpResponse.json({ logs: [], count: 0 });
    })
  );
}

describe('Coordinator workspace panel', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders Coordinator onboarding and contact info tabs while regular assistants keep the normal panel', async () => {
    seedCoordinatorLogs();
    const user = userEvent.setup();
    const seedChatDraft = vi.fn();
    const onOpenContactManager = vi.fn();
    const coordinator = assistant();

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={coordinator}
        onOpenContactManager={onOpenContactManager}
        onSeedChatDraft={seedChatDraft}
      />
    );

    expect(screen.getByTestId('assistant-info-tab-onboarding')).toHaveTextContent('Onboarding');
    expect(screen.getByTestId('assistant-info-tab-contact')).toHaveTextContent('Contact info');
    expect(await screen.findByTestId('coordinator-workspace-panel')).toBeInTheDocument();
    expect(screen.getByTestId('coordinator-logo-avatar')).toBeInTheDocument();
    expect(screen.queryByText('Setup progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coordinator-setup-progress-count')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Coordinator setup progress' })).toBeNull();
    expect(screen.getByText('Setup plan')).toBeInTheDocument();
    expect(screen.getByTestId('coordinator-workspace-refresh')).toBeInTheDocument();
    const currentWorkCard = screen.getByTestId('coordinator-current-work-card');
    expect(currentWorkCard).toHaveTextContent('Drafting the teammate plan');
    expect(currentWorkCard).toHaveTextContent('Integration setup');
    expect(
      within(currentWorkCard).getByTestId('coordinator-current-work-loader')
    ).toBeInTheDocument();
    expect(screen.getByText('Invite operators')).toBeInTheDocument();
    expect(screen.queryByTestId('coordinator-show-activity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-info-contact-grid')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('assistant-info-tab-contact'));
    const coordinatorContactInfo = screen.getByTestId('assistant-info-contact-grid');
    expect(coordinatorContactInfo).toHaveTextContent('Contact info');
    expect(
      within(coordinatorContactInfo).getByLabelText('Manage contact details')
    ).toBeInTheDocument();
    expect(within(coordinatorContactInfo).getByText('Add phone')).toBeInTheDocument();
    expect(within(coordinatorContactInfo).getByText('Add email')).toBeInTheDocument();
    expect(within(coordinatorContactInfo).getByText('Add whatsapp')).toBeInTheDocument();
    expect(within(coordinatorContactInfo).getByText('Add discord')).toBeInTheDocument();
    expect(screen.queryByTestId('coordinator-contact-info')).not.toBeInTheDocument();

    await user.click(within(coordinatorContactInfo).getByText('Add email'));
    expect(onOpenContactManager).toHaveBeenLastCalledWith(coordinator, 'email');

    cleanup();

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={assistant({
          agentId: 'regular-1',
          isCoordinator: false,
          firstName: 'Ava',
          surname: 'Regular',
        })}
        onOpenContactManager={vi.fn()}
      />
    );

    expect(screen.getByTestId('assistant-info-contact-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('coordinator-workspace-panel')).not.toBeInTheDocument();
  });

  it('seeds phase and checklist chat prompts without writing Coordinator rows', async () => {
    seedCoordinatorLogs();
    const user = userEvent.setup();
    const seedChatDraft = vi.fn();

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={assistant()}
        onOpenContactManager={vi.fn()}
        onSeedChatDraft={seedChatDraft}
      />
    );

    await user.click(await screen.findByTestId('coordinator-activity-chat-prompt'));
    expect(seedChatDraft).toHaveBeenLastCalledWith('What roles have you found so far?');

    const rows = screen.getAllByTestId('coordinator-checklist-row');

    await user.click(within(rows[0]).getByTestId('coordinator-checklist-chat-prompt'));
    expect(seedChatDraft).toHaveBeenLastCalledWith('Help me with: Invite operators');

    await user.click(within(rows[1]).getByTestId('coordinator-checklist-chat-prompt'));
    expect(seedChatDraft).toHaveBeenLastCalledWith(
      'Tell me where we landed on: Validate first run'
    );

    await user.click(within(rows[2]).getByTestId('coordinator-checklist-chat-prompt'));
    expect(seedChatDraft).toHaveBeenLastCalledWith(
      'Reopen this - I want to revisit Revisit billing export'
    );
  });

  it('does not fetch Coordinator logs when the admin gate blocks access', async () => {
    const requestUrls: string[] = [];
    server.use(
      http.get('/api/logs', ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json({ logs: [], count: 0 });
      })
    );

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={assistant({ userId: 'owner-user' })}
        onOpenContactManager={vi.fn()}
        onSeedChatDraft={vi.fn()}
      />,
      'Member'
    );

    expect(await screen.findByTestId('coordinator-workspace-panel')).toBeInTheDocument();
    expect(requestUrls).toHaveLength(0);
  });

  it('falls back to the checklist when the latest lifecycle row is completed', async () => {
    seedCoordinatorLogs([
      {
        activity_id: 'activity-older',
        phase: 'progress',
        stage: 'implementation',
        surfaces: ['chat'],
        title: 'Creating workspace',
        summary: 'Still running.',
        checklist_item_id: 1,
        chat_prompt: 'Any update?',
        chat_prompt_label: 'Ask for update',
        correlation_id: 'same-run',
        occurred_at: '2026-05-01T10:03:00Z',
        status: 'ok',
        error: null,
      },
      {
        activity_id: 'activity-newer',
        phase: 'completed',
        stage: 'implementation',
        surfaces: ['chat'],
        title: 'Created workspace',
        summary: 'Workspace is ready.',
        checklist_item_id: 1,
        chat_prompt: null,
        chat_prompt_label: null,
        correlation_id: 'same-run',
        occurred_at: '2026-05-01T10:04:00Z',
        status: 'ok',
        error: null,
      },
    ]);

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={assistant()}
        onOpenContactManager={vi.fn()}
        onSeedChatDraft={vi.fn()}
      />
    );

    expect(await screen.findByTestId('coordinator-now-checklist')).toHaveTextContent(
      'Invite operators'
    );
    expect(screen.queryByTestId('coordinator-current-work-loader')).not.toBeInTheDocument();
    expect(screen.queryByText('Creating workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('Created workspace')).not.toBeInTheDocument();
  });

  it('keeps failed Coordinator activity visible for troubleshooting', async () => {
    seedCoordinatorLogs([
      {
        activity_id: 'activity-failed',
        phase: 'failed',
        stage: 'implementation',
        surfaces: ['chat'],
        title: 'Workspace creation failed',
        summary: 'The workspace service returned an error.',
        checklist_item_id: 1,
        chat_prompt: 'Help me troubleshoot the workspace failure.',
        chat_prompt_label: 'Troubleshoot',
        correlation_id: 'failed-run',
        occurred_at: '2026-05-01T10:04:00Z',
        status: 'error',
        error: 'Workspace service unavailable',
      },
    ]);
    const user = userEvent.setup();
    const seedChatDraft = vi.fn();

    renderWithWorkspace(
      <AssistantInfoSidePanelContent
        assistant={assistant()}
        onOpenContactManager={vi.fn()}
        onSeedChatDraft={seedChatDraft}
      />
    );

    const currentWorkCard = await screen.findByTestId('coordinator-current-work-card');
    expect(currentWorkCard).toHaveTextContent('Workspace creation failed');
    expect(screen.queryByTestId('coordinator-current-work-loader')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('coordinator-activity-chat-prompt'));
    expect(seedChatDraft).toHaveBeenLastCalledWith('Help me troubleshoot the workspace failure.');
  });

  it('does not add a setup right-pane tab', () => {
    expect(RIGHT_PANE_TABS.map((tab) => tab.id)).not.toContain('setup');
  });
});

describe('Coordinator sidebar chrome', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses the product logo/name for Coordinators while regular assistants keep initials', async () => {
    const user = userEvent.setup();
    const status: AssistantStatus = { running: true, jobName: 'job-1' };

    render(
      <AssistantListItem
        assistant={assistant()}
        status={status}
        isSelected={false}
        onShowProfile={vi.fn()}
        onOpenContactManager={vi.fn()}
        onEditAssistant={vi.fn()}
        onEndContract={vi.fn()}
        isFolded={false}
        isCallActive={false}
      />
    );

    expect(screen.getAllByText('Coordinator')).toHaveLength(1);
    expect(screen.getByTestId('coordinator-logo-avatar')).toBeInTheDocument();

    await user.hover(screen.getByTestId('assistant-list-item-coord-1'));
    await user.click(screen.getByTestId('assistant-menu-coord-1'));
    expect(screen.queryByTestId('menu-end-contract')).not.toBeInTheDocument();

    cleanup();

    const onShowProfile = vi.fn();
    render(
      <AssistantListItem
        assistant={assistant()}
        status={status}
        isSelected={false}
        onShowProfile={onShowProfile}
        onOpenContactManager={vi.fn()}
        onEditAssistant={vi.fn()}
        onEndContract={vi.fn()}
        isFolded
        isCallActive={false}
      />
    );

    const foldedCoordinator = screen.getByRole('button', { name: 'Coordinator' });
    foldedCoordinator.focus();
    await user.keyboard('{Enter}');
    expect(onShowProfile).toHaveBeenCalledTimes(1);
    onShowProfile.mockClear();
    await user.keyboard(' ');
    expect(onShowProfile).toHaveBeenCalledTimes(1);

    cleanup();

    render(
      <AssistantListItem
        assistant={assistant({
          agentId: 'regular-1',
          isCoordinator: false,
          firstName: 'Ava',
          surname: 'Flow',
        })}
        status={status}
        isSelected={false}
        onShowProfile={vi.fn()}
        onOpenContactManager={vi.fn()}
        onEditAssistant={vi.fn()}
        onEndContract={vi.fn()}
        isFolded={false}
        isCallActive={false}
      />
    );

    expect(screen.getByText('Ava Flow')).toBeInTheDocument();
    expect(screen.getByText('AF')).toBeInTheDocument();
    expect(screen.queryByTestId('coordinator-logo-avatar')).not.toBeInTheDocument();
  });
});
