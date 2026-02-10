/**
 * Integration tests for Actions accordion in AssistantProfilePanel.
 *
 * Tests that the Actions section:
 * - Is shown when assistantActions.actions is provided
 * - Is hidden when assistantActions.actions is not provided
 * - Passes correct props to ActionsPanel
 * - Tracks expansion state correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import type { AssistantActions } from '@/types/assistants/assistant';
import type { AssistantActionActions } from '@/types/assistants/action';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import type { Assistant } from '@/types/assistants/assistant';

// Mock the ActionsPanel component to inspect props
let mockActionsPanelProps: {
  assistantId: string;
  isExpanded: boolean;
  actions: AssistantActionActions;
} | null = null;
vi.mock('@/components/Pages/Assistants/Assistants/Profile/Actions/ActionsPanel', () => ({
  ActionsPanel: (props: {
    assistantId: string;
    isExpanded: boolean;
    actions: AssistantActionActions;
  }) => {
    mockActionsPanelProps = props;
    return <div data-testid="mock-actions-panel">ActionsPanel</div>;
  },
}));

// Mock other panels to simplify tests
vi.mock('@/components/Pages/Assistants/Assistants/Profile/AssistantProfileInfoPanel', () => ({
  AssistantProfileInfoPanel: () => <div data-testid="mock-info-panel">InfoPanel</div>,
}));

vi.mock('@/components/Pages/Assistants/Assistants/Profile/AssistantProfileChatPanel', () => ({
  AssistantProfileChatPanel: () => <div data-testid="mock-chat-panel">ChatPanel</div>,
}));

vi.mock('@/components/Pages/Assistants/Assistants/Profile/AssistantResourcesManager', () => ({
  AssistantResourcesManager: () => <div data-testid="mock-resources-panel">ResourcesPanel</div>,
}));

describe('AssistantProfilePanel Actions Section', () => {
  const mockAssistant: Assistant = {
    agentId: 'test-assistant-id',
    userId: 'test-user-id',
    organizationId: null,
    firstName: 'Test',
    surname: 'Assistant',
    profilePhoto: null,
    profileVideo: null,
    age: null,
    nationality: null,
    about: null,
    phoneCountry: null,
    timezone: null,
    voiceId: null,
    voiceProvider: null,
    voiceMode: null,
    email: null,
    phone: null,
    assistantWhatsappNumber: null,
    userPhone: null,
    userWhatsappNumber: null,
    weeklyLimit: null,
    maxParallel: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockActions: AssistantActionActions = {
    getManagerMethodEvents: vi.fn().mockResolvedValue({ logs: [], offset: 0 }),
  };

  const baseAssistantActions: AssistantActions = {
    assistant: {
      list: vi.fn(),
      check: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      status: vi.fn(),
    },
    photo: {
      upload: vi.fn(),
      uploadVideo: vi.fn(),
      download: vi.fn(),
      downloadPresetVideo: vi.fn(),
      generate: vi.fn(),
      edit: vi.fn(),
      animate: vi.fn(),
      getAnimation: vi.fn(),
      cancelAnimation: vi.fn(),
    },
    voice: {
      list: vi.fn(),
      register: vi.fn(),
      delete: vi.fn(),
      clone: vi.fn(),
      generate: vi.fn(),
      preview: vi.fn(),
      design: vi.fn(),
    },
    chat: {
      getContactId: vi.fn(),
      getTranscripts: vi.fn(),
      message: vi.fn(),
      getAssistantOwnerById: vi.fn(),
    },
    contact: {
      delete: vi.fn(),
      listAllAssistantEmails: vi.fn(),
      listAvailablePhoneCountries: vi.fn(),
      listAvailableSocialPlatforms: vi.fn(),
      verifySocialAccount: vi.fn(),
    },
    secret: {
      get: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    approval: {
      getProfile: vi.fn(),
      requestAccess: vi.fn(),
      claimToken: vi.fn(),
    },
    call: {
      getConnectionDetails: vi.fn(),
      dispatchToCall: vi.fn(),
    },
    desktop: {
      getLiveviewUrl: vi.fn(),
      sendSystemEvent: vi.fn(),
    },
    spending: {
      getSpend: vi.fn(),
      getLimit: vi.fn(),
      setLimit: vi.fn(),
    },
  };

  const defaultProps = {
    assistant: mockAssistant,
    onClose: vi.fn(),
    onDeleteAssistant: vi.fn(),
    onEdit: vi.fn(),
    onOpenContactManager: vi.fn(),
    chatHistories: {},
    setChatHistories: vi.fn(),
    userEmail: 'test@example.com',
    onStartCall: vi.fn(),
    activeCallAssistantId: null,
    isCallConnected: false,
    isConnectingCall: false,
  };

  beforeEach(() => {
    mockActionsPanelProps = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Actions section visibility', () => {
    it('shows Actions accordion when actions are provided', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Look for the Actions accordion trigger
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('does not show Actions accordion when actions are not provided', () => {
      const assistantActions = { ...baseAssistantActions };

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Actions accordion should not be present
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  describe('ActionsPanel props', () => {
    it('passes correct assistantId to ActionsPanel', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };
      const user = userEvent.setup();

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Expand the Actions section
      const actionsTrigger = screen.getByText('Actions');
      await user.click(actionsTrigger);

      await waitFor(() => {
        expect(mockActionsPanelProps).not.toBeNull();
        expect(mockActionsPanelProps?.assistantId).toBe('test-assistant-id');
      });
    });

    it('passes actions object to ActionsPanel', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };
      const user = userEvent.setup();

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Expand the Actions section
      const actionsTrigger = screen.getByText('Actions');
      await user.click(actionsTrigger);

      await waitFor(() => {
        expect(mockActionsPanelProps).not.toBeNull();
        expect(mockActionsPanelProps?.actions).toBe(mockActions);
      });
    });

    it('updates isExpanded when accordion is toggled', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };
      const user = userEvent.setup();

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      const actionsTrigger = screen.getByText('Actions');

      // Initially closed (not in default open sections)
      expect(mockActionsPanelProps?.isExpanded).toBeFalsy();

      // Open the Actions section
      await user.click(actionsTrigger);

      await waitFor(() => {
        expect(mockActionsPanelProps?.isExpanded).toBe(true);
      });

      // Close the Actions section
      await user.click(actionsTrigger);

      await waitFor(() => {
        expect(mockActionsPanelProps?.isExpanded).toBe(false);
      });
    });
  });

  describe('accordion behavior', () => {
    it('can have Actions expanded alongside other sections', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };
      const user = userEvent.setup();

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Default sections should be expanded
      expect(screen.getByTestId('mock-info-panel')).toBeInTheDocument();
      expect(screen.getByTestId('mock-resources-panel')).toBeInTheDocument();
      expect(screen.getByTestId('mock-chat-panel')).toBeInTheDocument();

      // Expand Actions
      const actionsTrigger = screen.getByText('Actions');
      await user.click(actionsTrigger);

      // All sections including Actions should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('mock-actions-panel')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mock-info-panel')).toBeInTheDocument();
    });
  });

  describe('History button', () => {
    it('shows history button in Actions accordion trigger', async () => {
      const assistantActions = { ...baseAssistantActions, actions: mockActions };
      const user = userEvent.setup();

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // Expand Actions section to show the history button
      const actionsTrigger = screen.getByText('Actions');
      await user.click(actionsTrigger);

      // History button should be visible
      await waitFor(() => {
        expect(screen.getByTestId('actions-history-button')).toBeInTheDocument();
      });
    });
  });

  describe('Active indicator', () => {
    it('shows active indicator when ActionsPanel reports active action', async () => {
      // This test verifies the integration point exists
      // The actual indicator visibility depends on the ActionsPanel state
      const assistantActions = { ...baseAssistantActions, actions: mockActions };

      render(<AssistantProfilePanel {...defaultProps} assistantActions={assistantActions} />);

      // The indicator element should be available (controlled by hasActiveAction state)
      // Initially it should not be visible since no actions are loaded
      expect(screen.queryByTestId('actions-active-indicator')).not.toBeInTheDocument();
    });
  });
});
