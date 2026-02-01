/**
 * Connection Stability Tests for AssistantProfileChat SSE Connection
 *
 * These tests stress-test the SSE connection behavior to ensure:
 * 1. Connection state transitions are stable and predictable
 * 2. Rapid state changes don't cause UI flicker or duplicate connections
 * 3. The dependency on contactIdCache Map doesn't cause unnecessary reconnections
 */

import * as React from 'react';
import { render, screen, waitFor, act } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Server Action module before importing components
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello!' }),
}));

import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from '../mocks/data';
import { mockAssistantActions } from '../mocks/actions';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';
import { setupChatMocks, cleanupChatMocks } from './fixtures';

let chatMocks: ReturnType<typeof setupChatMocks>;

// Test wrapper component
const ChatTestWrapper = ({
  initialHistory,
  assistantActionsOverride = {},
  assistantOverride = null,
}: {
  initialHistory?: ChatMessage[];
  assistantActionsOverride?: Partial<AssistantActions>;
  assistantOverride?: Assistant | null;
}) => {
  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        firstName: 'Stability',
        surname: 'Test',
        agentId: 'stability-test-id',
      }),
    []
  );

  const activeAssistant = assistantOverride || defaultAssistant;

  const actions = React.useMemo(
    () => ({
      ...mockAssistantActions,
      ...assistantActionsOverride,
      chat: {
        ...mockAssistantActions.chat,
        ...(assistantActionsOverride.chat || {}),
      },
    }),
    [assistantActionsOverride]
  );

  const initialState = React.useMemo(() => {
    if (initialHistory === undefined) return {};
    return { [activeAssistant.agentId]: initialHistory };
  }, [initialHistory, activeAssistant.agentId]);

  const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>(initialState);

  return (
    <AssistantProfilePanel
      assistant={activeAssistant}
      assistantActions={actions}
      onClose={vi.fn()}
      onDeleteAssistant={vi.fn()}
      onEdit={vi.fn()}
      onOpenContactManager={vi.fn()}
      chatHistories={histories}
      setChatHistories={setHistories}
      userEmail="stability-test@example.com"
      onStartCall={vi.fn()}
      activeCallAssistantId={null}
      isCallConnected={false}
      isConnectingCall={false}
    />
  );
};

describe('SSE Connection Stability', () => {
  beforeEach(() => {
    chatMocks = setupChatMocks();
    vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({})))
    );
  });

  afterEach(() => {
    cleanupChatMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SECTION 1: Single Connection Stability
  // ==========================================================================
  describe('Single Connection Stability', () => {
    it('creates exactly one EventSource after history loads', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);

      await waitFor(() => {
        expect(chatMocks.eventSource).not.toBeNull();
      });

      // Verify only one connection was created
      expect(chatMocks.allEventSources.length).toBe(1);

      // Simulate connection open
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait a bit and verify no new connections were created
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(chatMocks.allEventSources.length).toBe(1);
    });

    it('does not create duplicate connections when receiving messages', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const initialConnectionCount = chatMocks.allEventSources.length;

      // Send multiple messages rapidly
      for (let i = 0; i < 10; i++) {
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: `msg-${i}`,
            publishTime: new Date().toISOString(),
            event: { content: `Message ${i}` },
          });
        });
      }

      // Verify no new connections were created
      expect(chatMocks.allEventSources.length).toBe(initialConnectionCount);
    });

    it('maintains stable connection during rapid state updates', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const initialConnectionCount = chatMocks.allEventSources.length;

      // Rapidly receive messages and trigger state updates
      for (let i = 0; i < 5; i++) {
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: `rapid-msg-${i}`,
            publishTime: new Date().toISOString(),
            event: { content: `Rapid Message ${i}` },
          });
        });
      }

      // Wait for all messages to be displayed
      await waitFor(() => {
        expect(screen.getByText('Rapid Message 4')).toBeInTheDocument();
      });

      // Connection should remain stable throughout
      expect(chatMocks.allEventSources.length).toBe(initialConnectionCount);
    });
  });

  // ==========================================================================
  // SECTION 2: Connection State Consistency
  // ==========================================================================
  describe('Connection State Consistency', () => {
    it('shows correct status during connection lifecycle', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

      // Before open - should show connecting
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument();

      // After open - should show connected (status indicator disappears)
      act(() => chatMocks.eventSource!.simulateOpen());

      await waitFor(() => {
        expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
      });
    });

    it('displays messages received via SSE correctly', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Send a message
      act(() => {
        chatMocks.eventSource!.simulateMessage({
          thread: 'unify_message_outbound',
          id: 'display-test-msg',
          publishTime: new Date().toISOString(),
          event: { content: 'Display Test Message' },
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Display Test Message')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // SECTION 3: Contact ID Cache Stability
  // ==========================================================================
  describe('Contact ID Cache Stability', () => {
    it('does not reconnect when receiving multiple messages', async () => {
      // This test verifies the fix: using currentContactId instead of contactIdCache
      // ensures that caching contact IDs for other assistants doesn't trigger reconnection

      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const initialConnectionCount = chatMocks.allEventSources.length;

      // Receive messages (which should not trigger reconnection)
      for (let i = 0; i < 5; i++) {
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: `stability-msg-${i}`,
            publishTime: new Date().toISOString(),
            event: { content: `Stability Message ${i}` },
          });
        });
      }

      // Wait for messages to be processed
      await waitFor(() => {
        expect(screen.getByText('Stability Message 4')).toBeInTheDocument();
      });

      // Connection count should remain stable
      expect(chatMocks.allEventSources.length).toBe(initialConnectionCount);
    });
  });

  // ==========================================================================
  // SECTION 4: Message Deduplication
  // ==========================================================================
  describe('Message Deduplication', () => {
    it('deduplicates messages with same ID', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const messageId = 'dedup-test-msg';
      const messageContent = 'Deduplicated Message';

      // Send the same message multiple times
      for (let i = 0; i < 3; i++) {
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: messageId,
            publishTime: new Date().toISOString(),
            event: { content: messageContent },
          });
        });
      }

      // Should still have only one instance of the message
      await waitFor(() => {
        const messages = screen.queryAllByText(messageContent);
        expect(messages.length).toBe(1);
      });
    });

    it('does not deduplicate messages with different IDs', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Send multiple messages with different IDs
      for (let i = 0; i < 3; i++) {
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: `unique-msg-${i}`,
            publishTime: new Date().toISOString(),
            event: { content: `Unique Message ${i}` },
          });
        });
      }

      // Should have all three messages
      await waitFor(() => {
        expect(screen.getByText('Unique Message 0')).toBeInTheDocument();
        expect(screen.getByText('Unique Message 1')).toBeInTheDocument();
        expect(screen.getByText('Unique Message 2')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // SECTION 5: Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('shows reconnecting status after error', async () => {
      render(<ChatTestWrapper initialHistory={undefined} />);
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Verify connected
      await waitFor(() => {
        expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
      });

      // Simulate error
      act(() => chatMocks.eventSource!.simulateError());

      // Should show reconnecting
      await waitFor(() => {
        expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
      });
    });
  });
});
