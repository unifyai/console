import React from 'react';
import { render, screen, within, waitFor } from '@/tests/render';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { AssistantList } from '@/components/Pages/Assistants/Assistants/List/AssistantList';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { AssistantProfileInfoPanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfileInfoPanel';
import { AssistantSecretsManager } from '@/components/Pages/Assistants/Assistants/Profile/AssistantSecretsManager';
import { TaskListItem } from '@/components/Pages/Assistants/Tasks/List/TaskListItem';

import { createMockAssistant, mockStatuses } from '@/tests/assistants/mocks/data';
import { mockAssistantActions, mockTaskActions } from '@/tests/assistants/mocks/actions';
import { Accordion } from '@/components/UI/accordion';
import { Task, Status, Priority } from '@/types/assistants/task';

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
      onToggleFold: vi.fn(),
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

  describe('AssistantProfilePanel - canWrite/canDelete props', () => {
    const defaultProfileProps = {
      assistant: myAssistant,
      assistantActions: mockAssistantActions,
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

    it('should show edit button when canWrite=true', async () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={true} canDelete={true} />);
      // Edit button is in the Profile accordion header
      const editButton = screen.getByRole('button', { name: '' }); // PenLine icon button
      // Use a more specific query - look for button with PenLine icon
      const editButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-pen-line'));
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should hide edit button when canWrite=false', () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={false} canDelete={true} />);
      const editButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-pen-line'));
      expect(editButtons.length).toBe(0);
    });

    it('should show delete button when canDelete=true', () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={true} canDelete={true} />);
      expect(screen.getByRole('button', { name: /End contract/i })).toBeInTheDocument();
    });

    it('should hide delete button when canDelete=false', () => {
      render(<AssistantProfilePanel {...defaultProfileProps} canWrite={true} canDelete={false} />);
      expect(screen.queryByRole('button', { name: /End contract/i })).not.toBeInTheDocument();
    });
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
      get: vi.fn(async () => [
        { logId: 1, name: 'API_KEY', value: 'secret123', description: 'Test key' },
      ]),
      create: vi.fn(async () => ({ info: 'Created' })),
      delete: vi.fn(async () => ({ info: 'Deleted' })),
    };

    const defaultSecretsProps = {
      isOpen: true,
      onClose: vi.fn(),
      assistantContext: 'TestAssistant',
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
          .filter((btn) => btn.querySelector('.lucide-trash-2'));
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
        .filter((btn) => btn.querySelector('.lucide-trash-2'));
      expect(deleteButtons.length).toBe(0);
    });

    it('should still show secrets list when canWrite=false (read-only)', async () => {
      render(<AssistantSecretsManager {...defaultSecretsProps} canWrite={false} />);
      await waitFor(() => {
        expect(screen.getByText('API_KEY')).toBeInTheDocument();
      });
    });
  });

  describe('TaskListItem - canEditTask prop', () => {
    const mockTask: Task = {
      taskId: 1,
      logId: 1,
      name: 'Test Task',
      description: 'Test description',
      status: Status.queued,
      priority: Priority.normal,
      deadline: undefined,
      schedule: {},
      assistantId: myAssistant.agentId,
    };

    const defaultTaskProps = {
      task: mockTask,
      assistant: myAssistant,
      updateTask: mockTaskActions.update,
      onTaskUpdate: vi.fn(),
    };

    it('should enable textarea when canEditTask=true', async () => {
      const user = userEvent.setup();
      render(
        <Accordion type="multiple" defaultValue={['1']}>
          <TaskListItem {...defaultTaskProps} canEditTask={true} />
        </Accordion>
      );

      const textarea = screen.getByPlaceholderText('Task description...');
      expect(textarea).not.toBeDisabled();
      expect(textarea).not.toHaveAttribute('readonly');
    });

    it('should disable textarea when canEditTask=false', async () => {
      render(
        <Accordion type="multiple" defaultValue={['1']}>
          <TaskListItem {...defaultTaskProps} canEditTask={false} />
        </Accordion>
      );

      const textarea = screen.getByPlaceholderText('Task description...');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveAttribute('readonly');
    });

    it('should not show save/discard buttons when editing with canEditTask=false', async () => {
      const user = userEvent.setup();
      render(
        <Accordion type="multiple" defaultValue={['1']}>
          <TaskListItem {...defaultTaskProps} canEditTask={false} />
        </Accordion>
      );

      // The save and discard buttons should not appear even if somehow text changes
      const saveButtons = screen
        .queryAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-save'));
      const discardButtons = screen
        .queryAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-undo-2'));

      expect(saveButtons.length).toBe(0);
      expect(discardButtons.length).toBe(0);
    });
  });
});
