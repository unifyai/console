import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantList } from '../AssistantList';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import type { SpaceSummary } from '@/types/spaces/space';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: TestResizeObserver,
});

function assistant(agentId: string, firstName: string, surname: string, spaceIds: number[]): Assistant {
  return {
    agentId,
    userId: 'user-1',
    organizationId: null,
    firstName,
    surname,
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
    spaceIds,
    selfContactId: 9,
    bossContactId: 10,
    contactIdentityRoots: [],
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  };
}

function space(spaceId: number, name: string, description: string | null = null): SpaceSummary {
  return {
    spaceId,
    name,
    description,
    organizationId: null,
    status: 'active',
  };
}

function renderAssistantList(
  assistants: Assistant[],
  options: {
    isFolded?: boolean;
    spacesById?: Record<number, SpaceSummary>;
  } = {}
) {
  return render(
    <AssistantList
      assistants={assistants}
      assistantStatuses={new Map<string, AssistantStatus | null>()}
      assistantError={null}
      isLoading={false}
      error={null}
      profileAssistantId={null}
      onShowProfile={vi.fn()}
      onOpenHireDialog={vi.fn()}
      onOpenContactManager={vi.fn()}
      onEditAssistant={vi.fn()}
      isFolded={options.isFolded ?? false}
      activeCallAssistantId={null}
      onHangUp={vi.fn()}
      spacesById={options.spacesById ?? {}}
    />
  );
}

describe('AssistantList space grouping', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders space groups under a broad Spaces section', () => {
    renderAssistantList(
      [assistant('1', 'Ava', 'Patch', [3]), assistant('2', 'Bea', 'Region', [7])],
      {
        spacesById: {
          3: space(3, 'Patch Three'),
          7: space(7, 'Region Seven'),
        },
      }
    );

    const spacesSection = screen.getByTestId('assistant-list-section-spaces');
    expect(within(spacesSection).getByRole('button', { name: /Spaces/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Patch Three/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Region Seven/ })).toBeInTheDocument();
  });

  it('keeps spaceless assistants in the flat list with no group header', () => {
    renderAssistantList([assistant('1', 'Solo', 'Assistant', [])]);

    expect(screen.queryByTestId('assistant-list-group-solo')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-list-item-1')).toHaveTextContent('Solo Assistant');
  });

  it('renders Solo as a broad section when spaces are present', () => {
    renderAssistantList(
      [assistant('1', 'Solo', 'Assistant', []), assistant('2', 'Shared', 'Assistant', [3])],
      {
        spacesById: {
          3: space(3, 'Patch Three'),
        },
      }
    );

    const soloSection = screen.getByTestId('assistant-list-section-solo');
    expect(within(soloSection).getByRole('button', { name: /^Solo1$/ })).toBeInTheDocument();
    expect(within(soloSection).getByText('Solo Assistant')).toBeVisible();
  });

  it('uses an explicit multi-space cue instead of dimming duplicate listings', async () => {
    const user = userEvent.setup();
    renderAssistantList([assistant('42', 'Mina', 'Multi', [3, 7])], {
      spacesById: {
        3: space(3, 'Patch Three'),
        7: space(7, 'Patch Seven'),
      },
    });

    const primaryGroup = screen.getByTestId('assistant-list-group-space:3');
    const secondaryGroup = screen.getByTestId('assistant-list-group-space:7');

    expect(within(primaryGroup).getByTestId('assistant-list-item-42')).toHaveTextContent(
      'Mina Multi'
    );
    expect(within(secondaryGroup).getByText('Mina Multi')).not.toHaveClass('opacity-60');

    const cue = within(secondaryGroup).getByText('2 spaces');
    expect(cue).toBeVisible();
    await user.hover(cue);
    const tooltipCopies = await screen.findAllByText('Also in Patch Three');
    expect(tooltipCopies.length).toBeGreaterThan(0);
  });

  it('shows space descriptions from the space header tooltip', async () => {
    const user = userEvent.setup();
    renderAssistantList([assistant('1', 'Ava', 'Patch', [3])], {
      spacesById: {
        3: space(3, 'Patch Three', 'Shared work for patch operations.'),
      },
    });

    await user.hover(screen.getByRole('button', { name: /Patch Three/ }));

    const tooltipCopies = await screen.findAllByText('Shared work for patch operations.');
    expect(tooltipCopies.length).toBeGreaterThan(0);
  });

  it('filters assistants inside groups and hides empty groups', async () => {
    const user = userEvent.setup();
    renderAssistantList(
      [assistant('1', 'Alpha', 'Patch', [3]), assistant('2', 'Beta', 'Region', [7])],
      {
        spacesById: {
          3: space(3, 'Patch Three'),
          7: space(7, 'Region Seven'),
        },
      }
    );

    await user.type(screen.getByRole('searchbox'), 'Alpha');

    expect(screen.getByRole('button', { name: /Spaces/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Patch Three/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Region Seven/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-list-item-1')).toHaveTextContent('Alpha Patch');
  });

  it('persists folded group state in localStorage', async () => {
    const user = userEvent.setup();
    const assistants = [assistant('1', 'Ava', 'Patch', [3])];
    const spacesById = { 3: space(3, 'Patch Three') };

    renderAssistantList(assistants, { spacesById });
    await user.click(screen.getByRole('button', { name: /Patch Three/ }));

    const persistedFoldState = JSON.parse(
      window.localStorage.getItem('console:assistants:listGroupFolds') ?? '{}'
    ) as Record<string, boolean>;
    expect(persistedFoldState['space:3']).toBe(true);
    expect(screen.queryByTestId('assistant-list-item-1')).not.toBeInTheDocument();

    cleanup();
    renderAssistantList(assistants, { spacesById });

    await waitFor(() => {
      expect(screen.queryByTestId('assistant-list-item-1')).not.toBeInTheDocument();
    });
  });

  it('collapses folded sidebar mode to the flat icon list', () => {
    renderAssistantList([assistant('42', 'Mina', 'Multi', [3, 7])], {
      isFolded: true,
      spacesById: {
        3: space(3, 'Patch Three'),
        7: space(7, 'Patch Seven'),
      },
    });

    expect(screen.queryByRole('button', { name: /Patch Three/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Patch Seven/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-list-item-42')).toBeInTheDocument();
  });
});
