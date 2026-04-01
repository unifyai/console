import React from 'react';
import { render, screen, waitFor } from '@/tests/render';
import { describe, it, expect, vi } from 'vitest';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Profile/AssistantProfile';
import { AssistantProfileInfoPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileInfoPanel';
import { AssistantSecretsManager } from '@/components/Pages/Assistants/Profile/AssistantSecretsManager';

import { createMockAssistant, mockStatuses } from '@/tests/assistants/mocks/data';
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

const currentUserId = 'user-123';
const otherUserId = 'user-456';

const myAssistant = createMockAssistant({
  agentId: 'asst-1',
  userId: currentUserId,
  firstName: 'My',
  surname: 'Assistant',
  organizationId: 1,
});

const otherUserAssistant = createMockAssistant({
  agentId: 'asst-2',
  userId: otherUserId,
  firstName: 'Other',
  surname: 'Assistant',
  organizationId: 1,
});

describe('Assistant Permissions - Behavior Tests', () => {
  describe('AssistantList - canHire prop', () => {
    const defaultListProps = {
      assistants: [myAssistant],
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

    it('should show hire button when canHire=true', () => {
      render(<AssistantList {...defaultListProps} canHire={true} />);
      expect(screen.getByRole('button', { name: /New/i })).toBeInTheDocument();
    });

    it('should hide hire button when canHire=false', () => {
      render(<AssistantList {...defaultListProps} canHire={false} />);
      expect(screen.queryByRole('button', { name: /New/i })).not.toBeInTheDocument();
    });

    it('should hide hire button in folded mode when canHire=false', () => {
      render(<AssistantList {...defaultListProps} canHire={false} isFolded={true} />);
      // In folded mode the button uses an icon, look for UserPlus icon container
      const addButtons = screen.queryAllByRole('button');
      const userPlusButton = addButtons.find((btn) => btn.querySelector('.lucide-user-plus'));
      expect(userPlusButton).toBeUndefined();
    });
  });

  describe('AssistantProfilePanel - canWrite prop', () => {
    const defaultProfileProps = {
      assistant: myAssistant,
      assistantActions: mockAssistantActions,
      onClose: vi.fn(),
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

    it('should show edit button when canWrite=true', async () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={true} />);
      // Edit button is in the Profile accordion header - look for button with PenLine icon
      const editButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-pen-line'));
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should hide edit button when canWrite=false', () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={false} />);
      const editButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-pen-line'));
      expect(editButtons.length).toBe(0);
    });

    // Note: canDelete is now tested through the AssistantEdit dialog, not the profile panel.
    // The "End contract" button was moved from the profile panel footer to the edit dialog footer.
  });

  describe('AssistantProfileInfoPanel - canWrite prop', () => {
    const defaultInfoProps = {
      assistant: myAssistant,
      onEdit: vi.fn(),
    };

    it('should make bio and timezone clickable when canWrite=true', async () => {
      const onEditMock = vi.fn();
      render(
        <AssistantProfileInfoPanel {...defaultInfoProps} canWrite={true} onEdit={onEditMock} />
      );

      // Find the About section and click it
      const aboutSection = screen.getByText(/About Me/i).parentElement;
      const aboutContent = aboutSection?.querySelector('.prose');
      expect(aboutContent).toHaveClass('cursor-pointer');
    });

    it('should make bio and timezone non-clickable when canWrite=false', async () => {
      const onEditMock = vi.fn();
      render(
        <AssistantProfileInfoPanel {...defaultInfoProps} canWrite={false} onEdit={onEditMock} />
      );

      // Find the About section
      const aboutSection = screen.getByText(/About Me/i).parentElement;
      const aboutContent = aboutSection?.querySelector('.prose');
      expect(aboutContent).not.toHaveClass('cursor-pointer');
    });
  });

  describe('AssistantSecretsManager - canWrite prop', () => {
    const mockSecretActions = {
      get: vi.fn(async (_assistantId: string, _ownerId: string) => [
        { logId: 1, name: 'API_KEY', description: 'Test key' },
      ]),
      create: vi.fn(async () => ({ info: 'Created' })),
      update: vi.fn(async () => ({ info: 'Updated' })),
      delete: vi.fn(async () => ({ info: 'Deleted' })),
    };

    const defaultSecretsProps = {
      isOpen: true,
      onClose: vi.fn(),
      userId: 'test-user-id',
      ownerId: 'test-owner-id',
      assistantId: 'test-assistant-id',
      secretActions: mockSecretActions,
    };

    it('should show New button when canWrite=true', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={true} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /New/i })).toBeInTheDocument();
      });
    });

    it('should hide New button when canWrite=false', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={false} />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /New/i })).not.toBeInTheDocument();
      });
    });

    it('should show delete button for secrets when canWrite=true', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={true} />);
      await waitFor(() => {
        const deleteButtons = screen
          .getAllByRole('button')
          .filter((btn) => btn.querySelector('.lucide-trash2'));
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    it('should hide delete button for secrets when canWrite=false', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={false} />);
      await waitFor(() => {
        expect(screen.getByText('API_KEY')).toBeInTheDocument();
      });
      const deleteButtons = screen
        .queryAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-trash2'));
      expect(deleteButtons.length).toBe(0);
    });

    it('should still show secrets list when canWrite=false (read-only)', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={false} />);
      await waitFor(() => {
        expect(screen.getByText('API_KEY')).toBeInTheDocument();
      });
    });
  });
});
