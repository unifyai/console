import React from 'react';

import { render, screen, within, waitFor, waitForElementToBeRemoved } from '@/tests/render';
import { describe, it, expect, vi, Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import Main from '@/components/Pages/Assistants/Main';
import { AssistantList } from '@/components/Pages/Assistants/Assistants/List/AssistantList';

import { Assistant } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

import { mockAssistants, mockStatuses, mockAssistantWithoutSocials } from '@/tests/assistants/mocks/data';
import { mockActivityLogActions, mockAssistantActions, mockTaskActions } from '@/tests/assistants/mocks/actions';

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

vi.mock('@/components/UI/avatar', () => ({
    Avatar: ({ children, className }: { children: React.ReactNode, className: string }) => <div data-testid="avatar" className={className}>{children}</div>,
    AvatarImage: ({ src, alt }: { src: string, alt: string }) => <img src={src} alt={alt} data-testid="avatar-image" />,
    AvatarFallback: ({ children }: { children: React.ReactNode }) => <div data-testid="avatar-fallback">{children}</div>,
}));

vi.mock('lucide-react', async (importOriginal) => {
    const original = await importOriginal<typeof import('lucide-react')>();
    return {
        ...original,
        Search: () => <div data-testid="search-icon" />,
        UserPlus: () => <div data-testid="user-plus-icon" />,
        WifiOff: () => <div data-testid="wifi-off-icon" />,
        PanelLeftClose: () => <div data-testid="panel-left-close-icon" />,
        PanelLeft: () => <div data-testid="panel-left-icon" />,
        Mail: () => <div data-testid="mail-icon" />,
        Phone: () => <div data-testid="phone-icon" />,
        PhoneCall: () => <div data-testid="phone-call-icon" />,
        Check: () => <div data-testid="check-icon" />,
        User: () => <div data-testid="user-icon" />,
    };
});

vi.mock('@mui/icons-material', () => ({
    WhatsApp: () => <div data-testid="whatsapp-icon" />,
}));

describe('Component Tests', () => {

    const defaultListProps = {
        assistants: mockAssistants,
        assistantStatuses: mockStatuses,
        assistantError: null,
        isLoading: false,
        error: null,
        profileAssistantId: null,
        activityLogAssistantId: null,
        onShowProfile: vi.fn(),
        onShowActivityLog: vi.fn(),
        onOpenHireDialog: vi.fn(),
        onOpenContactManager: vi.fn(),
        isFolded: false,
        onToggleFold: vi.fn(),
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
            const avatarImage = screen.getByTestId('avatar-image');
            expect(avatarImage).toHaveAttribute('src', mockAssistants[0].profile_photo);
        });

        it('should display avatar-only items when the list is folded', () => {
            render(<AssistantList {...defaultListProps} assistants={mockAssistants} isFolded={true} />);
            expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
            expect(screen.getAllByTestId('avatar-image').length).toBe(2);
        });

        it('should display a phone call icon when an assistant is in an active call', () => {
            render(<AssistantList {...defaultListProps} assistants={[mockAssistants[0]]} activeCallAssistantId="1" />);
            expect(screen.getByTestId('phone-call-icon')).toBeInTheDocument();
        });
        
        it('should display status indicators for online and offline assistants', () => {
            render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
            const onlineIndicator = screen.getByTestId('status-indicator-1');
            expect(onlineIndicator).toHaveClass('bg-green-500');

            const offlineIndicator = screen.getByTestId('status-indicator-2');
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
        
        it('should disable the "New" button and show a tooltip if assistant limit is reached', async () => {
            render(<AssistantList {...defaultListProps} assistants={mockAssistants} />);
            const newButton = screen.getByRole('button', { name: 'New' });
            expect(newButton).toBeDisabled();

            await user.hover(newButton.closest('span')!);
            const tooltip = await screen.findByRole('tooltip', { name: /More assistant hires available soon/i });
            expect(tooltip).toBeInTheDocument();
        });

        it('should enable the "New" button when below the assistant limit', async () => {
            render(<AssistantList {...defaultListProps} assistants={[mockAssistants[0]]} />);
            const newButton = screen.getByRole('button', { name: 'New' });
            expect(newButton).toBeEnabled();
        });

        it('should toggle list folding when clicking on fold button', async () => {
            render(<AssistantList {...defaultListProps} />);
            const foldButton = screen.getByTestId('panel-left-close-icon').closest('button');
            await user.click(foldButton!);
            expect(defaultListProps.onToggleFold).toHaveBeenCalledTimes(1);
        });
    });

    describe('Hover Card', () => {
        const user = userEvent.setup();

        it("should display a hover card with contact details on avatar hover", async () => {
            render(<AssistantList {...defaultListProps} assistants={[mockAssistants[0]]} isFolded={true} />);
            await user.hover(screen.getAllByTestId('avatar')[0]);
            
            expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
            expect(screen.getByText(mockAssistants[0].email!)).toBeInTheDocument();
            expect(screen.getByText(mockAssistants[0].phone!)).toBeInTheDocument();
            expect(screen.getByText(mockAssistants[0].assistant_whatsapp_number!)).toBeInTheDocument();
        });

        it('should display "Add" buttons for missing contact details', async () => {
            render(<AssistantList {...defaultListProps} assistants={[mockAssistantWithoutSocials]} isFolded={true} />);
            await user.hover(screen.getAllByTestId('avatar')[0]);
            
            expect(await screen.findByRole('button', { name: /Add Email/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Add Phone/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Add WhatsApp/i })).toBeInTheDocument();
        });

        it('should open contat manager with "email" tab when "Add Email" is clicked', async () => {
            const onOpenContactManagerMock = vi.fn();
            render(
                <AssistantList 
                    {...defaultListProps} 
                    assistants={[mockAssistantWithoutSocials]} 
                    isFolded={true} 
                    onOpenContactManager={onOpenContactManagerMock}
                />
            );
            
            await user.hover(screen.getAllByTestId('avatar')[0]);
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
            
            await user.hover(screen.getAllByTestId('avatar')[0]);
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
            taskActions: mockTaskActions,
            activityLogActions: mockActivityLogActions,
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
                expect(screen.getAllByRole('list-item-skeleton').length).toBeGreaterThan(0);
            });
            expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
        });

        it('should display an error message if assitants fail to load', { meta: { alias: 'Assistants-API-Error' }}, async () => {
            const errorActions = {
                ...mockAssistantActions,
                assistant: {
                    ...mockAssistantActions.assistant,
                    list: vi.fn(async () => ({ detail: 'Internal Server Error' })),
                },
            };
            renderMain({ assistantActions: errorActions });
            expect(await screen.findByText('Could not load assistants.')).toBeInTheDocument();
        });

        it('should display the list of assistants when successfully fetched', { meta: { alias: 'Assistants-API-Success' }}, async () => {
            renderMain();
            expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
            expect(await screen.findByText('John Smith')).toBeInTheDocument();
        });

        it('should remove an assistant and show success toast on successful deletion', { meta: { alias: 'Assistants-DeleteSuccess' }}, async () => {
            const user = userEvent.setup();
            const deleteMock = vi.fn(async () => ({ info: "Success" }));
            const actionsWithMockedDelete = {
                ...mockAssistantActions,
                assistant: { ...mockAssistantActions.assistant, delete: deleteMock },
            };
            renderMain({ assistantActions: actionsWithMockedDelete });
        
            const janeListItem = await screen.findByTestId('assistant-list-item-1');
            await user.click(janeListItem);
            expect(await screen.findByText("Jane's Profile")).toBeInTheDocument();
        
            const deleteButton = await screen.findByRole('button', { name: /End contract/i });
            await user.click(deleteButton);
            const dialog = await screen.findByRole('alertdialog');
            expect(within(dialog).getByText(/Jane Doe/)).toBeInTheDocument();
        
            const confirmButton = within(dialog).getByRole('button', { name: /Proceed/i });
            await user.click(confirmButton);
        
            expect(deleteMock).toHaveBeenCalledWith('1');
            expect(await screen.findByText('Jane Doe removed from team.')).toBeInTheDocument();
            await waitForElementToBeRemoved(() => screen.queryByText("Jane's Profile"));
        
            expect(screen.queryByTestId('assistant-list-item-1')).not.toBeInTheDocument();
            expect(screen.getByText('John Smith')).toBeInTheDocument();
        });

        it('should show an error toast and not remove assistant if deletion fails', async () => {
            const user = userEvent.setup();
            const deleteMock = vi.fn(async () => ({ detail: "Server error" }));
            const actionsWithMockedDelete = {
                ...mockAssistantActions,
                assistant: { ...mockAssistantActions.assistant, delete: deleteMock },
            };
            renderMain({ assistantActions: actionsWithMockedDelete });
        
            await user.click(await screen.findByText('Jane Doe'));
            await user.click(await screen.findByRole('button', { name: /End contract/i }));
            
            const dialog = await screen.findByRole('alertdialog');
            const confirmButton = within(dialog).getByRole('button', { name: /Proceed/i });
            await user.click(confirmButton);
        
            expect(deleteMock).toHaveBeenCalledWith('1');
            expect(await screen.findByText('Failed to remove Jane Doe')).toBeInTheDocument();
            await waitForElementToBeRemoved(dialog);
        
            const janeListItem = screen.getByTestId('assistant-list-item-1');
            expect(within(janeListItem).getByText('Jane Doe')).toBeInTheDocument();
            expect(screen.getByText("Jane's Profile")).toBeInTheDocument();
        });
    });

    describe('Interactions With Other Blocks', () => {
        it('should open hire dialog when "New" assistant button is clicked', { meta: { alias: 'Assistants-OpenHireDialog' }}, async () => {
            const user = userEvent.setup();
            const oneAssistantActions = { ...mockAssistantActions, assistant: { ...mockAssistantActions.assistant, list: vi.fn(async () => [mockAssistants[0]]) } };
            renderMain({ assistantActions: oneAssistantActions });
 
            const newButton = await screen.findByRole('button', { name: 'New' });
            expect(newButton).toBeEnabled();
            await user.click(newButton);
            expect(await screen.findByRole('heading', { name: /Hire Assistant/i })).toBeInTheDocument();
        });

        it('should open the assistant profile panel when a list item is clicked', { meta: { alias: 'Assistants-OpenProfile' }}, async () => {
            const user = userEvent.setup();
            renderMain();

            const janeItem = await screen.findByText('Jane Doe');
            await user.click(janeItem);

            expect(await screen.findByText("Jane's Profile")).toBeInTheDocument();
        });
        
        it('should close the profile panel when the same assistant is clicked again', { meta: { alias: 'Assistants-CloseProfile' }}, async () => {
            const user = userEvent.setup();
            renderMain();
    
            const janeItem = await screen.findByText('Jane Doe');
            await user.click(janeItem);
            expect(await screen.findByText("Jane's Profile")).toBeInTheDocument();
    
            await user.click(janeItem);
            
            await waitForElementToBeRemoved(() => screen.queryByText("Jane's Profile"));
        });
    
        it('should switch profile panels when a different assistant is clicked', { meta: { alias: 'Assistants-SwitchProfile' }}, async () => {
            const user = userEvent.setup();
            renderMain();
    
            await user.click(await screen.findByText('Jane Doe'));
            expect(await screen.findByText("Jane's Profile")).toBeInTheDocument();
    
            await user.click(await screen.findByText('John Smith'));
            
            await waitForElementToBeRemoved(() => screen.queryByText("Jane's Profile"));
            expect(await screen.findByText("John's Profile")).toBeInTheDocument();
        });

    });
});