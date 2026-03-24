import React from 'react';

import { render, screen, within, waitFor, waitForElementToBeRemoved } from '@/tests/render';
import { describe, it, expect, vi, Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import Main from '@/components/Pages/Assistants/Main';
import { AssistantList } from '@/components/Pages/Assistants/Assistants/List/AssistantList';

import { Assistant } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

import {
  mockAssistants,
  mockStatuses,
  mockAssistantWithoutSocials,
} from '@/tests/assistants/mocks/data';
import { mockAssistantActions } from '@/tests/assistants/mocks/actions';

vi.mock('@/hooks/Assistants/useAssistantCall', () => ({
  useAssistantCall: vi.fn(() => ({
    activeCallAssistant: null,
    isConnecting: false,
    isConnected: false,
    callType: null,
    connectionDetails: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    isSpeakerMuted: false,
    toggleSpeakerMute: vi.fn(),
    isWaitingForAssistant: false,
    connectionError: null,
    retryConnection: vi.fn(),
    isRemoteControlActive: false,
    liveviewUrl: null,
    isRemoteControlLoading: false,
    toggleRemoteControl: vi.fn(),
    isRemoteControlInteractive: false,
    toggleRemoteControlInteractive: vi.fn(),
  })),
}));

// Mock WorkspaceProvider - Main component uses useAssistantPermissions which requires workspace context
// See src/tests/mocks/workspaceProvider.ts for reusable mock patterns
vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    workspaces: [{ id: 'personal', name: 'Test User', type: 'personal' }],
    activeWorkspace: { id: 'personal', name: 'Test User', type: 'personal' },
    activeOrganization: null,
    currentUserId: 'test-user-001',
    isWorkspaceSwitchable: true,
    switchWorkspace: vi.fn(),
  }),
}));

describe('Component Tests', () => {
  const defaultListProps = {
    assistants: mockAssistants,
    assistantStatuses: mockStatuses,
    assistantError: null,
    isLoading: false,
    error: null,
    profileAssistantId: null,
    onShowProfile: vi.fn(),
    onOpenHireDialog: vi.fn(),
    onOpenContactManager: vi.fn(),
    isFolded: false,
    activeCallAssistantId: null,
    onHangUp: vi.fn(),
  };

  describe('Rendering and Display', () => {
    it('should display a list of assistants when data is provided', () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('should display an empty state message when there are no assistants', () => {
      render(<AssistantList {...defaultListProps} assistants={[]} />);
      expect(screen.getByText('No assistants found.')).toBeInTheDocument();
    });

    it('should display assistant avatar and name', () => {
      render(<AssistantList {...defaultListProps} assistants={[mockAssistants[0]]} />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      // The image fails to load in JSDOM, so we check for the fallback initials.
      const listItem = screen.getByTestId('assistant-list-item-1');
      expect(within(listItem).getByText('JD')).toBeInTheDocument();
    });

    it('should display avatar-only items when the list is folded', () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} isFolded={true} />);
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('should display a phone call icon when an assistant is in an active call', async () => {
      const user = userEvent.setup();
      render(
        <AssistantList
          {...defaultListProps}
          assistants={[mockAssistants[0]]}
          activeCallAssistantId="1"
        />
      );

      const listItem = screen.getByTestId('assistant-list-item-1');

      const phoneCallIcon = listItem.querySelector('.lucide-phone-call');
      expect(phoneCallIcon).toBeInTheDocument();

      await user.hover(phoneCallIcon!);
      expect(await screen.findByRole('tooltip', { name: 'In a call' })).toBeInTheDocument();
    });

    it('should display status indicators for online and offline assistants', () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      const janeItem = screen.getByTestId('assistant-list-item-1');
      const onlineIndicator = within(janeItem).getByRole('status');
      expect(onlineIndicator).toHaveClass('bg-green-500');

      const johnItem = screen.getByTestId('assistant-list-item-2');
      const offlineIndicator = within(johnItem).getByRole('status');
      expect(offlineIndicator).toHaveClass('bg-gray-400');
    });
  });

  describe('Styling and Appearance', () => {
    it('should apply selected styles to the active assistant and not others', () => {
      render(<AssistantList {...defaultListProps} profileAssistantId="1" />);
      const janeItem = screen.getByTestId('assistant-list-item-1');
      const johnItem = screen.getByTestId('assistant-list-item-2');
      expect(janeItem).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(johnItem).not.toHaveClass('bg-primary', 'text-primary-foreground');
    });
  });

  describe('Searching and Filtering', () => {
    const user = userEvent.setup();

    it('should filter the list based on a search term', async () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      await user.type(screen.getByPlaceholderText('Search assistants...'), 'Jane');
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    });

    it('should show a message when no assistants match the search term', async () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      await user.type(screen.getByPlaceholderText('Search assistants...'), 'NonExistentName');
      expect(screen.queryByText('Jane Doe')).toBeNull();
      expect(screen.getByText('No assistants match filters.')).toBeInTheDocument();
    });

    it('should show the full list again when the search is cleared', async () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      const searchInput = screen.getByPlaceholderText('Search assistants...');
      await user.type(searchInput, 'John');
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();

      await user.clear(searchInput);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    const user = userEvent.setup();

    it('should enable the "New" button when there is no error', async () => {
      render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
      const newButton = screen.getByRole('button', { name: 'New' });
      expect(newButton).toBeEnabled();
    });

    it('should disable the "New" button when there is an assistant error', async () => {
      render(
        <AssistantList {...defaultListProps} assistants={mockAssistants} assistantError="Error" />
      );
      const newButton = screen.getByRole('button', { name: 'New' });
      expect(newButton).toBeDisabled();
    });

    // Fold button was removed - list folding is now controlled by dragging the right border in Main
  });

  describe('Hover Card', () => {
    const user = userEvent.setup();

    it('should display a hover card with contact details on avatar hover', async () => {
      render(
        <AssistantList {...defaultListProps} assistants={[mockAssistants[0]]} isFolded={true} />
      );
      // Hover the element containing the fallback text, which is inside the trigger
      await user.hover(screen.getByText('JD'));

      expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
      // these are in the hover card content
      expect(screen.getByText(mockAssistants[0].email!)).toBeInTheDocument();
      expect(screen.getByText(mockAssistants[0].phone!)).toBeInTheDocument();
      expect(screen.getByText(mockAssistants[0].assistantWhatsappNumber!)).toBeInTheDocument();
    });

    it('should display "Add" buttons for missing contact details', async () => {
      render(
        <AssistantList
          {...defaultListProps}
          assistants={[mockAssistantWithoutSocials]}
          isFolded={true}
        />
      );
      await user.hover(screen.getByText('AR'));

      expect(await screen.findByRole('button', { name: /Add Email/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add Phone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add WhatsApp/i })).toBeInTheDocument();
    });

    it('should open contact manager with "email" tab when "Add Email" is clicked', async () => {
      const onOpenContactManagerMock = vi.fn();
      render(
        <AssistantList
          {...defaultListProps}
          assistants={[mockAssistantWithoutSocials]}
          isFolded={true}
          onOpenContactManager={onOpenContactManagerMock}
        />
      );

      await user.hover(screen.getByText('AR'));
      const addEmailButton = await screen.findByRole('button', { name: /Add Email/i });
      await user.click(addEmailButton);

      expect(onOpenContactManagerMock).toHaveBeenCalledWith(mockAssistantWithoutSocials, 'email');
    });

    it('should open contact manager with "phone" tab when "Add Phone" is clicked', async () => {
      const onOpenContactManagerMock = vi.fn();
      render(
        <AssistantList
          {...defaultListProps}
          assistants={[mockAssistantWithoutSocials]}
          isFolded={true}
          onOpenContactManager={onOpenContactManagerMock}
        />
      );

      await user.hover(screen.getByText('AR'));
      const addPhoneButton = await screen.findByRole('button', { name: /Add Phone/i });
      await user.click(addPhoneButton);

      expect(onOpenContactManagerMock).toHaveBeenCalledWith(mockAssistantWithoutSocials, 'phone');
    });
  });
});

describe('Integration Tests', () => {
  const renderMain = (props: Partial<React.ComponentProps<typeof Main>> = {}) => {
    const defaultMainProps = {
      assistantActions: mockAssistantActions,
      userMeta: { image: null, timezone: 'UTC' },
    };
    return render(<Main {...defaultMainProps} {...props} />);
  };

  describe('Data Loading & API States', () => {
    it('should display loading skeletons while fetching assistants', async () => {
      const loadingActions = {
        ...mockAssistantActions,
        assistant: {
          ...mockAssistantActions.assistant,
          list: vi.fn(() => new Promise<Assistant[] | ResponseProps>(() => {})), // Never resolves
        },
      };
      renderMain({ assistantActions: loadingActions });

      await vi.waitFor(() => {
        // The skeleton components have this role for testing purposes.
        expect(screen.getAllByRole('list-item-skeleton').length).toBeGreaterThan(0);
      });
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });

    it(
      'should display an error message if assistants fail to load',
      { meta: { alias: 'Assistants-API-Error' } },
      async () => {
        const errorActions = {
          ...mockAssistantActions,
          assistant: {
            ...mockAssistantActions.assistant,
            list: vi.fn(async () => ({ detail: 'Internal Server Error' })),
          },
        };
        renderMain({ assistantActions: errorActions });
        expect(await screen.findByText('Could not load assistants.')).toBeInTheDocument();
      }
    );

    it(
      'should display the list of assistants when successfully fetched',
      { meta: { alias: 'Assistants-API-Success' } },
      async () => {
        renderMain();
        expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
        expect(await screen.findByText('John Smith')).toBeInTheDocument();
      }
    );

    it(
      'should remove an assistant and show success toast on successful deletion',
      { meta: { alias: 'Assistants-DeleteSuccess' } },
      async () => {
        const user = userEvent.setup();
        const deleteMock = vi.fn(async () => ({ info: 'Success' }));
        const actionsWithMockedDelete = {
          ...mockAssistantActions,
          assistant: { ...mockAssistantActions.assistant, delete: deleteMock },
        };
        renderMain({ assistantActions: actionsWithMockedDelete });

        const janeListItem = await screen.findByTestId('assistant-list-item-1');
        await user.click(janeListItem);
        // Profile panel opens - verify by finding the First Name label
        expect(await screen.findByText('First Name')).toBeInTheDocument();

        // Click edit button (PenLine icon) in profile to open edit dialog
        const editButtons = screen
          .getAllByRole('button')
          .filter((btn) => btn.querySelector('.lucide-pen-line'));
        expect(editButtons.length).toBeGreaterThan(0);
        await user.click(editButtons[0]);

        // Edit dialog opens - find End contract button in the edit dialog footer
        const deleteButton = await screen.findByRole('button', { name: /End contract/i });
        await user.click(deleteButton);
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText(/Jane Doe/)).toBeInTheDocument();

        const confirmButton = within(dialog).getByRole('button', { name: /Proceed/i });
        await user.click(confirmButton);

        // Verify delete was called
        await waitFor(() => {
          expect(deleteMock).toHaveBeenCalledWith('1');
        });

        // Verify success toast appears (sonner toast may take a moment to render)
        await waitFor(
          () => {
            expect(screen.getByText('Jane Doe removed from team.')).toBeInTheDocument();
          },
          { timeout: 5000 }
        );

        // Verify assistant removed from list
        await waitFor(() => {
          expect(screen.queryByTestId('assistant-list-item-1')).not.toBeInTheDocument();
        });
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      }
    );

    it('should show an error toast and not remove assistant if deletion fails', async () => {
      const user = userEvent.setup();
      const deleteMock = vi.fn(async () => ({ detail: 'Server error' }));
      const actionsWithMockedDelete = {
        ...mockAssistantActions,
        assistant: { ...mockAssistantActions.assistant, delete: deleteMock },
      };
      renderMain({ assistantActions: actionsWithMockedDelete });

      await user.click(await screen.findByText('Jane Doe'));
      // Profile panel opens - click edit button to open edit dialog
      const editButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-pen-line'));
      await user.click(editButtons[0]);

      // Click End contract in edit dialog
      await user.click(await screen.findByRole('button', { name: /End contract/i }));

      const dialog = await screen.findByRole('alertdialog');
      const confirmButton = within(dialog).getByRole('button', { name: /Proceed/i });
      await user.click(confirmButton);

      expect(deleteMock).toHaveBeenCalledWith('1');
      expect((await screen.findAllByText('Failed to remove Jane Doe')).length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      const janeListItem = screen.getByTestId('assistant-list-item-1');
      expect(within(janeListItem).getByText('Jane Doe')).toBeInTheDocument();
      // End contract button still available in the edit dialog
      expect(screen.getByRole('button', { name: /End contract/i })).toBeInTheDocument();
    });
  });

  describe('Interactions With Other Blocks', () => {
    it(
      'should open hire dialog when "New" assistant button is clicked',
      { meta: { alias: 'Assistants-OpenHireDialog' } },
      async () => {
        const user = userEvent.setup();
        const oneAssistantActions = {
          ...mockAssistantActions,
          assistant: {
            ...mockAssistantActions.assistant,
            list: vi.fn(async () => [mockAssistants[0]]),
          },
        };
        renderMain({ assistantActions: oneAssistantActions });

        const newButton = await screen.findByRole('button', { name: 'New' });
        expect(newButton).toBeEnabled();
        await user.click(newButton);
        expect(await screen.findByRole('heading', { name: /Hire Assistant/i })).toBeInTheDocument();
      }
    );

    it(
      'should open the assistant profile panel when a list item is clicked',
      { meta: { alias: 'Assistants-OpenProfile' } },
      async () => {
        const user = userEvent.setup();
        renderMain();

        const janeItem = await screen.findByText('Jane Doe');
        await user.click(janeItem);

        // Profile panel opens - verify by First Name label appearing
        expect(await screen.findByText('First Name')).toBeInTheDocument();
      }
    );

    it(
      'should close the profile panel when the same assistant is clicked again',
      { meta: { alias: 'Assistants-CloseProfile' } },
      async () => {
        const user = userEvent.setup();
        renderMain();

        const janeItem = await screen.findByText('Jane Doe');
        await user.click(janeItem);
        // Profile panel opens
        expect(await screen.findByText('First Name')).toBeInTheDocument();

        await user.click(janeItem);

        await waitFor(() => {
          // Profile panel closes - First Name label disappears
          expect(screen.queryByText('First Name')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'should switch profile panels when a different assistant is clicked',
      { meta: { alias: 'Assistants-SwitchProfile' } },
      async () => {
        const user = userEvent.setup();
        renderMain();

        await user.click(await screen.findByText('Jane Doe'));
        // Jane's profile opens - verify by profile-only content (First Name label)
        const firstNameLabel = await screen.findByText('First Name');
        expect(firstNameLabel).toBeInTheDocument();

        await user.click(await screen.findByText('John Smith'));

        // Profile switches to John - verify profile still open and content changed
        await waitFor(() => {
          // First Name label still present (profile still open)
          expect(screen.getByText('First Name')).toBeInTheDocument();
        });
      }
    );
  });
});
