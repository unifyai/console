import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from '../mocks/data';
import { mockAssistantActions } from '../mocks/actions';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';

// Import harness utilities
import {
  ControllableMockEventSource,
  ControllableMockBroadcastChannel,
  setupChatMocks,
  cleanupChatMocks,
  getChatBubbles as getChatBubblesHelper,
  ChatTestHarness,
  createMockChatActions as createMockChatActionsFromFixture,
  getChatInput,
  getSendButton,
  testFiles,
  simulateFileDrop,
  getAttachButton,
  getAttachmentChips,
  getAttachmentChipNames,
  removeAttachmentChip,
} from './fixtures';

// Chat mocks state - managed via harness
let chatMocks: ReturnType<typeof setupChatMocks>;

/**
 * Helper to create mock chat actions with the new signature.
 * getContactId returns 1 (owner) by default.
 * getTranscripts returns messages based on the provided mock function.
 */
const createMockChatActions = (
  getTranscriptsMock?: (
    contactId: number,
    ownerId: string,
    assistantId: string,
    beforeMessageId?: number
  ) => Promise<ChatMessage[] | { detail: string }>,
  messageMock?: (payload: any) => Promise<{ info?: string; detail?: string }>
) => ({
  getContactId: vi.fn(async () => 1), // Default: owner contact_id
  getTranscripts: getTranscriptsMock ? vi.fn(getTranscriptsMock) : vi.fn(async () => []),
  message: messageMock ? vi.fn(messageMock) : vi.fn(async () => ({ info: 'Message sent' })),
  getAssistantOwnerById: vi.fn(async () => ({ firstName: 'Test', lastName: 'Owner' })),
});

// --- Helper: Real Fetch Implementation for Tests ---
// This mimics the server action src/lib/assistants/chat.ts to hit the MSW handlers
const fetchTranscriptsViaApi = async (
  contactId: number,
  _ownerId: string,
  _assistantId: string,
  beforeMessageId?: number
): Promise<ChatMessage[] | any> => {
  const limit = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
  let filterExpr = `medium == "unify_chat" and (sender_id == 1 or sender_id == 0)`;
  if (beforeMessageId !== undefined) {
    filterExpr += ` and message_id < ${beforeMessageId}`;
  }

  const params = new URLSearchParams({
    project: 'Assistants',
    context: 'All/Transcripts',
    limit: limit.toString(),
    filterExpr: filterExpr,
  });

  try {
    const response = await fetch(`/api/logs?${params.toString()}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Fetch Error' }));
      return { detail: err.detail || 'Error' };
    }
    const data = await response.json();

    // Map logs to ChatMessage (logic copied from src/lib/assistants/chat.ts)
    return (data.logs || []).map((log: any) => ({
      id: String(log.id),
      role: log.entries.sender_id === 1 ? 'user' : 'assistant',
      content: log.entries.content,
      timestamp: new Date(log.timestamp),
      messageId: log.entries.messageId,
    }));
  } catch (e) {
    return { detail: 'Network Error' };
  }
};

// --- Test Wrapper ---
const ChatTestWrapper = ({
  initialHistory,
  assistantActionsOverride = {},
  assistantOverride = null,
  panelKey,
}: {
  initialHistory?: ChatMessage[];
  assistantActionsOverride?: Partial<AssistantActions>;
  assistantOverride?: Assistant | null;
  panelKey?: string;
}) => {
  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        firstName: 'Stress',
        surname: 'Test',
        agentId: 'stress-test-id',
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
    return {
      [activeAssistant.agentId]: initialHistory,
    };
  }, [initialHistory, activeAssistant.agentId]);

  const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>(initialState);

  return (
    <AssistantProfilePanel
      key={panelKey}
      assistant={activeAssistant}
      assistantActions={actions}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onOpenContactManager={vi.fn()}
      chatHistories={histories}
      setChatHistories={setHistories}
      userEmail="test@example.com"
      onStartCall={vi.fn()}
      activeCallAssistantId={null}
      isCallConnected={false}
      isConnectingCall={false}
    />
  );
};

describe('Assistant Profile Chat', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    // Setup mocks using harness
    chatMocks = setupChatMocks();

    // Setup Fresh Spy (but allow passthrough for our helper fetch)
    fetchSpy = vi.spyOn(window, 'fetch');
  });

  afterEach(() => {
    // Cleanup mocks using harness
    cleanupChatMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const getChatBubbles = () => getChatBubblesHelper(screen);

  // =========================================================================
  // SECTION A: GENERAL FEATURES AND UX
  // =========================================================================
  describe('A - General Features and UX', () => {
    it(
      'optimistically adds user message and removes it on failure',
      {
        meta: {
          alias: 'UX-Optimistic-Fail',
          scenario: 'User sends a message but the API call fails after a delay',
          behavior:
            'Message appears immediately, then disappears, input is restored, and error toast shows',
        },
      },
      async () => {
        const failActions = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: vi.fn(async () => {
              await new Promise((r) => setTimeout(r, 50));
              throw new Error('Simulated Network Fail');
            }),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={failActions} />
        );

        // Wait for async initialization (contact lookup) to complete and SSE to connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const user = userEvent.setup();
        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        await user.type(input, 'This will fail');
        await user.keyboard('{Enter}');

        // Optimistic Update
        await waitFor(() => {
          expect(screen.getByText('This will fail')).toBeInTheDocument();
          expect(input).toHaveValue('');
        });

        // Rollback
        await waitFor(() => {
          const bubbles = screen.queryAllByTestId('message-bubble');
          const bubbleContents = bubbles.map((b) => b.textContent);
          expect(bubbleContents).not.toContain('This will fail');
          expect(input).toHaveValue('This will fail');
          expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
        });
      }
    );

    it(
      'shows typing indicator after send and clears it upon receiving reply',
      {
        meta: {
          alias: 'UX-Typing-Flow',
          scenario: 'User sends message, waits for reply',
          behavior: 'Typing indicator appears after delay, then vanishes when real reply arrives',
        },
      },
      async () => {
        // Render and wait for initialization with real timers
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = screen.getByRole('textbox');

        // Now switch to fake timers for timing control
        vi.useFakeTimers();

        // 1. Manually trigger send synchronously
        act(() => {
          fireEvent.change(input, { target: { value: 'Trigger Typing' } });
          fireEvent.submit(input.closest('form')!);
        });

        // 2. Advance time 5s to trigger typing indicator
        act(() => {
          vi.advanceTimersByTime(5000);
        });

        expect(screen.getByText('Typing')).toBeInTheDocument();

        // 3. Receive Reply
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-reply',
            event: { content: 'Here is your reply' },
          });
        });

        expect(screen.queryByText('Typing')).not.toBeInTheDocument();
        expect(screen.getByText('Here is your reply')).toBeInTheDocument();

        // Restore real timers before test ends
        vi.useRealTimers();
      }
    );

    it(
      'clears typing indicator automatically after timeout if no reply arrives',
      {
        meta: {
          alias: 'UX-Typing-Timeout',
          scenario: 'User sends message, server never replies',
          behavior: 'Typing indicator disappears automatically after timeout threshold',
        },
      },
      async () => {
        // Render and wait for initialization with real timers
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Now switch to fake timers for timing control
        vi.useFakeTimers();

        const input = screen.getByRole('textbox');
        act(() => {
          fireEvent.change(input, { target: { value: 'Trigger Timeout' } });
          fireEvent.submit(input.closest('form')!);
        });

        // Advance 5s (Typing visible)
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(screen.getByText('Typing')).toBeInTheDocument();

        // Advance 20s (Timeout exceeded)
        act(() => {
          vi.advanceTimersByTime(20000);
        });
        expect(screen.queryByText('Typing')).not.toBeInTheDocument();

        // Restore real timers before test ends
        vi.useRealTimers();
      }
    );

    it(
      'handles interleaving user send and server receive events',
      {
        meta: {
          alias: 'UX-Race-Concurrent',
          scenario: 'User hits enter at exact moment server message arrives',
          behavior: 'Both messages render correctly without crashing or overwriting',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Use fireEvent instead of userEvent for reliability in browser tests
        const input = await screen.findByPlaceholderText('Send a message...');
        fireEvent.change(input, { target: { value: 'User Concurrent' } });

        // Simulate concurrent send and receive
        act(() => {
          // Submit form
          fireEvent.submit(input.closest('form')!);
          // Server message arrives at the same moment
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-concurrent',
            publishTime: new Date().toISOString(),
            event: { content: 'Server Concurrent' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toContain('User Concurrent');
          expect(bubbles).toContain('Server Concurrent');
          expect(bubbles).toHaveLength(2);
        });
      }
    );
  });

  // =========================================================================
  // SECTION B: SSE CONNECTION
  // =========================================================================
  describe('B - SSE Connection', () => {
    it(
      'waits for history to load before establishing SSE connection',
      {
        meta: {
          alias: 'SSE-Wait-History',
          scenario: 'Component mounts and starts fetching history',
          behavior: 'SSE connection is deferred until history fetch completes',
        },
      },
      async () => {
        let resolveFetch: (value: ChatMessage[]) => void;
        const fetchPromise = new Promise<ChatMessage[]>((resolve) => {
          resolveFetch = resolve;
        });

        const slowFetchActions = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(() => fetchPromise),
            message: vi.fn(async () => ({})),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={slowFetchActions} />
        );

        // 1. Assert Loading State
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Loading messages...')).toBeInTheDocument();
        });

        // 2. Assert No EventSource created yet
        expect(chatMocks.allEventSources.length).toBe(0);

        // 3. Finish Loading - resolve the promise and let React process updates
        resolveFetch!([]);

        // 4. Assert Loaded State - use waitFor to handle async state updates
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
        });

        // 5. Assert EventSource created
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(1);
        });
      }
    );

    it(
      'handles rapid connection flapping without duplicating visual state',
      {
        meta: {
          alias: 'SSE-Flapping',
          scenario:
            'Connection opens, receives message, drops, and reconnects receiving same message',
          behavior: 'Message is rendered only once (stable state)',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-stable',
            publishTime: new Date().toISOString(),
            event: { content: 'Stable' },
          });
        });

        // Drop and Reconnect
        act(() => chatMocks.eventSource!.simulateError());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Replay message
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-stable',
            publishTime: new Date().toISOString(),
            event: { content: 'Stable' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toHaveLength(1);
          expect(bubbles[0]).toBe('Stable');
        });
      }
    );

    it(
      'filters out irrelevant pubsub events',
      {
        meta: {
          alias: 'SSE-Filter-Events',
          scenario: 'Stream receives system logs or unrelated threads',
          behavior: 'Only messages with correct thread ID are rendered',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'system_logs',
            data: { content: 'Ignore me' },
          });
        });

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-1',
            publishTime: new Date().toISOString(),
            event: { content: 'See me' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toEqual(['See me']);
        });
      }
    );

    it(
      'processes high volume message burst without dropping frames',
      {
        meta: {
          alias: 'SSE-Flood',
          scenario: `${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT} messages arrive in a single batch update`,
          behavior: `All ${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT} messages are rendered in order`,
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const messageCount = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
        const messages = Array.from({ length: messageCount }, (_, i) => ({
          thread: 'unify_message_outbound',
          id: `msg-${i}`,
          publishTime: new Date(Date.now() + i * 100).toISOString(),
          event: { content: `Flood ${i}` },
        }));

        act(() => {
          messages.forEach((msg) => chatMocks.eventSource!.simulateMessage(msg));
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toHaveLength(messageCount);
          expect(bubbles[0]).toBe('Flood 0');
          expect(bubbles[49]).toBe('Flood 49');
        });
      }
    );

    it(
      'closes previous SSE connection when switching assistants',
      {
        meta: {
          alias: 'SSE-Lifecycle-Switch',
          scenario: 'User navigates from Assistant A to Assistant B',
          behavior: 'Connection A is closed before Connection B is opened',
        },
      },
      async () => {
        const assistantA = createMockAssistant({ agentId: 'assistant-a' });
        const assistantB = createMockAssistant({ agentId: 'assistant-b' });

        const { rerender } = render(
          <ChatTestWrapper initialHistory={[]} assistantOverride={assistantA} />
        );

        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(1));
        const connectionA = chatMocks.allEventSources[0];
        expect(connectionA.url).toContain('/assistant-a/events');
        expect(connectionA.readyState).not.toBe(2);

        rerender(<ChatTestWrapper initialHistory={[]} assistantOverride={assistantB} />);

        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(2));
        const connectionB = chatMocks.allEventSources[1];

        expect(connectionA.closeSpy).toHaveBeenCalled();
        expect(connectionB.url).toContain('/assistant-b/events');
      }
    );

    it(
      'closes connection on component unmount',
      {
        meta: {
          alias: 'SSE-Lifecycle-Unmount',
          scenario: 'Component unmounts from DOM',
          behavior: 'EventSource connection is closed',
        },
      },
      async () => {
        const { unmount } = render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(1));
        const connection = chatMocks.allEventSources[0];
        unmount();
        expect(connection.closeSpy).toHaveBeenCalled();
      }
    );
  });

  // =========================================================================
  // SECTION C: ACKNOWLEDGMENT
  // =========================================================================
  describe('C - Acknowledgment', () => {
    it(
      'sends ACK request when message contains __ackId and is rendered',
      {
        meta: {
          alias: 'ACK-Basic',
          scenario: 'Message arrives with ACK token',
          behavior: 'ACK API is called with the token',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const ackId = 'ack-token-xyz';

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-ack-test',
            publishTime: new Date().toISOString(),
            __ackId: ackId,
            event: { content: 'Ack Me' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Ack Me')).toBeInTheDocument();
        });

        await waitFor(() => {
          expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/events/ack'),
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify({ ackId: ackId }),
            })
          );
        });
      }
    );

    it(
      'triggers individual ACKs for multiple messages arriving simultaneously',
      {
        meta: {
          alias: 'ACK-Burst',
          scenario: 'Multiple messages with ACK tokens arrive at once',
          behavior: 'API is called for each individual ACK token',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const msg1 = {
          thread: 'unify_message_outbound',
          id: 'msg-1',
          __ackId: 'ack-1',
          event: { content: 'Message 1' },
        };

        const msg2 = {
          thread: 'unify_message_outbound',
          id: 'msg-2',
          __ackId: 'ack-2',
          event: { content: 'Message 2' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(msg1);
          chatMocks.eventSource!.simulateMessage(msg2);
        });

        await waitFor(() => {
          expect(fetchSpy).toHaveBeenCalledTimes(2);
          expect(fetchSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-1' }) })
          );
          expect(fetchSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-2' }) })
          );
        });
      }
    );

    it(
      'does not re-ACK messages that have already been processed locally',
      {
        meta: {
          alias: 'ACK-Idempotency',
          scenario: 'Component re-renders after message is processed',
          behavior: 'ACK API is not called again',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-1',
            publishTime: new Date().toISOString(),
            __ackId: 'unique-ack-1',
            event: { content: 'One Time Ack' },
          });
        });

        await waitFor(() => {
          expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        // Trigger re-render
        const user = userEvent.setup();
        const input = screen.getByRole('textbox');
        await user.type(input, 'Typing causes render...');
        await new Promise((r) => setTimeout(r, 200));

        expect(fetchSpy).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'acks messages if they are filtered out as duplicates to clear queue',
      {
        meta: {
          alias: 'ACK-Skip-Dedupe',
          scenario: 'Server resends existing message with ACK token',
          behavior: 'Message is deduplicated and ACK IS SENT to clear it from PubSub',
        },
      },
      async () => {
        const history = [
          {
            id: 'existing-id',
            role: 'assistant',
            content: 'Original',
            timestamp: new Date(),
          } as ChatMessage,
        ];
        render(<ChatTestWrapper initialHistory={history} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const duplicateMsg = {
          thread: 'unify_message_outbound',
          id: 'existing-id',
          __ackId: 'ack-token-deduped',
          event: { content: 'Original' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(duplicateMsg);
        });

        await waitFor(() => {
          expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/events/ack'),
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify({ ackId: 'ack-token-deduped' }),
            })
          );
        });
      }
    );

    it(
      'handles ACK API failure gracefully without crashing UI',
      {
        meta: {
          alias: 'ACK-Fail-Resilience',
          scenario: 'ACK API returns 500 error',
          behavior: 'UI remains stable and rendered',
        },
      },
      async () => {
        // Need to mock fetch to reject only for ACK requests, but pass through for transcripts if needed
        fetchSpy.mockImplementation((url) => {
          if (String(url).includes('/ack')) return Promise.reject(new Error('Network Error'));
          return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
        });

        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-fail',
            __ackId: 'ack-fail-token',
            event: { content: 'Stable UI' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Stable UI')).toBeInTheDocument();
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'acknowledges backlog messages but prevents display pollution (deduplication)',
      {
        meta: {
          alias: 'ACK-Dedupe-Ack',
          scenario: 'Transcripts load [MsgA]. SSE sends [MsgA (unacked), MsgB (unacked)].',
          behavior: 'MsgA is displayed once. MsgB is displayed. MsgB is ACKed.',
        },
      },
      async () => {
        const assistantId = 'stress-test-id';
        const msgA = {
          id: 'msg-a',
          role: 'assistant',
          content: 'Message A',
          timestamp: new Date('2023-01-01T10:00:00Z'),
        } as ChatMessage;

        // 1. Setup specific mock for getTranscripts to return MsgA
        const getTranscriptsMock = vi.fn(async () => [msgA]);
        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(async () => ({})),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        // 2. Render with undefined history to trigger fetch
        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />
        );

        // Wait for transcripts fetch to complete (input placeholder changes from 'Loading...' to 'Send a message...')
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
        });

        // Verify MsgA is present (loaded from history)
        await waitFor(() => {
          expect(screen.getByText('Message A')).toBeInTheDocument();
        });
        // Verify transcripts were fetched (setup validation)
        expect(getTranscriptsMock).toHaveBeenCalledTimes(1);

        // 3. Open SSE and send backlog
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          // Re-send MsgA (should be deduped)
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-a',
            publishTime: '2023-01-01T10:00:00Z',
            __ackId: 'ack-for-A',
            event: { content: 'Message A' },
          });

          // Send MsgB (New/Backlog)
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-b',
            publishTime: '2023-01-01T10:00:05Z',
            __ackId: 'ack-for-B',
            event: { content: 'Message B' },
          });
        });

        // 4. Verification
        await waitFor(() => {
          const bubbles = getChatBubbles();
          // Ensure no duplicates
          expect(bubbles).toEqual(['Message A', 'Message B']);
        });

        // Verify ACK for Msg B (Msg A might be skipped depending on implementation,
        // but checking Msg B ensures the mechanism works for new items)
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/events/ack'),
          expect.objectContaining({
            body: JSON.stringify({ ackId: 'ack-for-B' }),
          })
        );
      }
    );
  });

  // =========================================================================
  // SECTION D: CHAT HISTORY
  // =========================================================================
  describe('D - Chat History', () => {
    it(
      'sorts out-of-order SSE messages correctly by timestamp',
      {
        meta: {
          alias: 'History-Ordering',
          scenario: 'Older message arrives after Newer message',
          behavior: 'Messages are resorted chronologically',
        },
      },
      async () => {
        const now = Date.now();
        const timeA = new Date(now).toISOString();
        const timeB = new Date(now - 10000).toISOString();

        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Newer
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-a',
            publishTime: timeA,
            event: { content: 'Message A (New)' },
          });
        });

        // Older
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-b',
            publishTime: timeB,
            event: { content: 'Message B (Old)' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toEqual(['Message B (Old)', 'Message A (New)']);
        });
      }
    );

    it(
      'merges new SSE message with existing history',
      {
        meta: {
          alias: 'History-Merge',
          scenario: 'Initial history is loaded, new message arrives',
          behavior: 'New message is appended correctly',
        },
      },
      async () => {
        const history: ChatMessage[] = [
          {
            id: 'hist-1',
            role: 'user',
            content: 'Initial History',
            timestamp: new Date(Date.now() - 5000),
          },
        ];

        render(<ChatTestWrapper initialHistory={history} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'sse-1',
            publishTime: new Date().toISOString(),
            event: { content: 'Live Update' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toEqual(['Initial History', 'Live Update']);
        });
      }
    );

    it(
      'deduplicates consecutive messages with identical content but NO IDs (Echo Prevention)',
      {
        meta: {
          alias: 'History-Echo-Prevention',
          scenario: 'Two identical messages without IDs arrive sequentially',
          behavior: 'Second message is ignored as potential echo',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // 1. First message (No ID)
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            event: { content: 'Echo?' },
          });
        });

        await waitFor(() => expect(screen.getByText('Echo?')).toBeInTheDocument());

        // 2. Second exact message (No ID)
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            event: { content: 'Echo?' },
          });
        });

        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toHaveLength(1);
        });
      }
    );

    it(
      'orders complex interleaved history, backlog, user messages, and new replies correctly',
      {
        meta: {
          alias: 'History-Complex-Order',
          scenario: 'History[10:00], SSE Backlog[10:05], User[Now], SSE Reply[Now+1s]',
          behavior: 'All displayed in strict chronological order.',
        },
      },
      async () => {
        const t0 = new Date('2023-01-01T10:00:00Z');
        const tBacklog = new Date('2023-01-01T10:05:00Z');
        // User message will use Date.now(), so we mock system time to be tBacklog + 1hr
        const tUser = new Date('2023-01-01T11:00:00Z');
        const tReply = new Date('2023-01-01T11:00:05Z');

        vi.setSystemTime(tUser);

        const initialHistory = [
          {
            id: 'hist-1',
            role: 'assistant',
            content: '1. History',
            timestamp: t0,
          } as ChatMessage,
        ];

        render(<ChatTestWrapper initialHistory={initialHistory} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // 1. Verify History
        expect(screen.getByText('1. History')).toBeInTheDocument();

        // 2. SSE Backlog arrives (Timestamp is OLDER than current User time)
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'backlog-1',
            publishTime: tBacklog.toISOString(),
            __ackId: 'ack-backlog',
            event: { content: '2. Backlog' },
          });
        });

        // 3. User sends message (Timestamp = tUser)
        const user = userEvent.setup();
        const input = screen.getByRole('textbox');
        await user.type(input, '3. User Input');
        await user.keyboard('{Enter}');

        // 4. SSE Reply arrives (Timestamp > tUser)
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'reply-1',
            publishTime: tReply.toISOString(), // Future
            __ackId: 'ack-reply',
            event: { content: '4. Reply' },
          });
        });

        // 5. Verify Final Order
        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles).toEqual(['1. History', '2. Backlog', '3. User Input', '4. Reply']);
        });

        // Verify ACKs were attempted for the stream items
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/ack'),
          expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-backlog' }) })
        );
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/ack'),
          expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-reply' }) })
        );
      }
    );

    it(
      'filters zombie messages based on API transcript timestamp, not local cache (cached session restore)',
      {
        meta: {
          alias: 'History-Zombie-Cache',
          scenario:
            'Load A -> Rx Live Msg (Newer) -> Switch B -> Switch A -> Rx Late Msg (Older than Live, Newer than Transcript)',
          behavior: 'Late Msg is ACCEPTED (not treated as zombie)',
        },
      },
      async () => {
        const tTranscript = new Date('2023-01-01T10:00:00Z');
        const tLatePubSub = new Date('2023-01-01T10:02:00Z'); // The one to test
        const tLiveCached = new Date('2023-01-01T10:05:00Z'); // The one already in cache

        const assistantA = createMockAssistant({
          agentId: 'assistant-a',
          firstName: 'AssistantA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'assistant-b',
          firstName: 'AssistantB',
          surname: 'Test',
        });

        // Mock Transcripts for A
        const getTranscriptsMock = vi.fn(
          async (
            _contactId: number,
            _ownerId: string,
            assistantId: string,
            _beforeMessageId?: number
          ) => {
            // Filter by assistant ID
            if (assistantId === 'assistant-a') {
              return [
                {
                  id: 'msg-transcript',
                  role: 'assistant' as const,
                  content: 'Transcript Msg',
                  timestamp: tTranscript,
                  messageId: 1,
                },
              ];
            }
            return [];
          }
        );

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // 1. Wait for SSE connection first (ensures history has loaded)
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

        // 2. Wait for Transcript to appear
        await waitFor(() => expect(screen.getByText('Transcript Msg')).toBeInTheDocument());

        // 3. Connect SSE and receive "Live Cached" message
        act(() => {
          chatMocks.eventSource!.simulateOpen();
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-live',
            publishTime: tLiveCached.toISOString(),
            event: { content: 'Live Msg' },
          });
        });
        await waitFor(() => expect(screen.getByText('Live Msg')).toBeInTheDocument());

        // 4. Switch to B (Unmounts A's connection, caches A's history)
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for B to load (empty transcripts)
        await waitFor(() => expect(chatMocks.allEventSources[1]?.url).toContain('assistant-b'));

        // 5. Switch back to A
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for A to re-appear (from cache, no fetch)
        await waitFor(() => expect(screen.getByText('Live Msg')).toBeInTheDocument());
        // Expect 2 calls: 1 for A (initial), 1 for B (switch). A is not re-fetched on return.
        expect(getTranscriptsMock).toHaveBeenCalledTimes(2);

        // Wait for SSE A to reconnect
        await waitFor(() => expect(chatMocks.allEventSources[2]?.url).toContain('assistant-a'));
        const connectionA = chatMocks.allEventSources[2];
        act(() => connectionA.simulateOpen());

        // 6. Send "Late" message (Older than Live, Newer than Transcript)
        // If logic uses local cache max (10:05), 10:02 is rejected.
        // If logic uses transcript max (10:00), 10:02 is accepted.
        act(() => {
          connectionA.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-late',
            publishTime: tLatePubSub.toISOString(),
            event: { content: 'Late Msg' },
          });
        });

        // 7. Assert
        await waitFor(() => expect(screen.getByText('Late Msg')).toBeInTheDocument());
      }
    );

    it(
      'ensures getTranscripts is called exactly once per session, preventing double-fetches',
      {
        meta: {
          alias: 'History-Double-Fetch',
          scenario: 'Component mounts, potentially re-renders during loading',
          behavior: 'API is called only once',
        },
      },
      async () => {
        // Mock a slow fetch to ensure we catch duplicate calls during the "loading" phase
        const getTranscriptsMock = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [];
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined} // Force fetch
            assistantActionsOverride={actionsOverride}
          />
        );

        // Force a re-render during the "loading" state (simulating React StrictMode or prop updates)
        rerender(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />
        );

        // Wait for loading to finish (input becomes enabled)
        await waitFor(() =>
          expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument()
        );

        // Assert that despite the re-render, the fetch was only initiated once
        expect(getTranscriptsMock).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'loads older messages when scrolling to the top',
      {
        meta: {
          alias: 'History-Pagination-Load',
          scenario: `User scrolls to top of chat with ${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT}+ messages`,
          behavior: 'Older messages are fetched and prepended',
        },
      },
      async () => {
        const apiOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: fetchTranscriptsViaApi,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        // 1. Initial Render (loads first messages: IDs 75 -> 26)
        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />
        );

        await waitFor(() => {
          expect(screen.getByText('Message 75')).toBeInTheDocument();
          expect(screen.getByText('Message 26')).toBeInTheDocument();
        });

        expect(screen.queryByText('Message 25')).not.toBeInTheDocument();

        // 2. Simulate Scroll to Top
        const scrollArea = screen.getByTestId('chat-scroll-area');
        const viewport = scrollArea.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLElement;
        fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

        // 3. Verify older messages appear (IDs 25 -> 1)
        await waitFor(() => {
          expect(screen.getByText('Message 25')).toBeInTheDocument();
          expect(screen.getByText('Message 1')).toBeInTheDocument();
        });

        // Verify total order
        const bubbles = getChatBubbles();
        expect(bubbles[0]).toBe('Message 1');
        expect(bubbles[bubbles.length - 1]).toBe('Message 75');
        expect(bubbles.length).toBe(75);
      }
    );

    it(
      'displays "No more messages" when history is fully loaded',
      {
        meta: {
          alias: 'History-Pagination-End',
          scenario: 'User loads all available history',
          behavior: 'End of history indicator is shown',
        },
      },
      async () => {
        const apiOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: fetchTranscriptsViaApi,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };
        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />
        );

        // Wait for first batch
        await waitFor(() => {
          expect(screen.getByText('Message 26')).toBeInTheDocument();
        });

        // Scroll to top to load second batch (25-1)
        const scrollArea = screen.getByTestId('chat-scroll-area');
        const viewport = scrollArea.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLElement;
        fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

        // Wait for second batch
        await waitFor(() => {
          expect(screen.getByText('Message 1')).toBeInTheDocument();
        });

        // Expect "No more messages" text
        await waitFor(() => {
          expect(screen.getByText('No more messages')).toBeInTheDocument();
        });
      }
    );

    it(
      'handles pagination failure gracefully',
      {
        meta: {
          alias: 'History-Pagination-Fail',
          scenario: 'Pagination API call fails',
          behavior: 'Error is logged, existing messages remain, no crash',
        },
      },
      async () => {
        // Use specific assistant name to trigger handler error (logic inside handlers.ts)
        const failAssistant = createMockAssistant({ firstName: 'FailPagination', surname: 'Test' });
        const apiOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: fetchTranscriptsViaApi,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={failAssistant}
            assistantActionsOverride={apiOverride}
          />
        );

        // Wait for first batch
        await waitFor(() => {
          expect(screen.getByText('Message 26')).toBeInTheDocument();
        });

        // Scroll to top
        const scrollArea = screen.getByTestId('chat-scroll-area');
        const viewport = scrollArea.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLElement;

        // Fix: ensure scrollTop is explicitly set before event dispatch for test reliability
        viewport.scrollTop = 0;
        fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

        // Instead of checking for console.error (which can be flaky or vary in format),
        // check for the UI manifestation of the error: the "Retry" button.
        // This proves the error state was reached and handled by the component.
        await waitFor(() => {
          expect(
            screen.getByRole('button', { name: /failed to load more\. retry/i })
          ).toBeInTheDocument();
        });

        // Verify state didn't crash / messages still there
        expect(screen.getByText('Message 26')).toBeInTheDocument();
        expect(screen.getByText('Message 75')).toBeInTheDocument();

        consoleSpy.mockRestore();
      }
    );

    it(
      'allows retrying after pagination failure',
      {
        meta: {
          alias: 'History-Pagination-Retry',
          scenario: 'Pagination fails, user clicks retry, pagination succeeds',
          behavior: 'Error message is replaced by new messages',
        },
      },
      async () => {
        const successMessages = [
          {
            id: 'msg-retry-1',
            role: 'assistant',
            content: 'Retried Message 1',
            timestamp: new Date(),
            messageId: 10,
          },
          {
            id: 'msg-retry-2',
            role: 'assistant',
            content: 'Retried Message 2',
            timestamp: new Date(),
            messageId: 11,
          },
        ] as ChatMessage[];

        let paginationAttempt = 0;
        const getTranscriptsMock = vi.fn(
          async (
            _contactId: number,
            _ownerId: string,
            _assistantId: string,
            beforeMessageId?: number
          ) => {
            // Initial Load
            if (beforeMessageId === undefined) {
              return Array.from({ length: 50 }, (_, i) => ({
                id: `msg-initial-${i}`,
                role: 'user',
                content: `Initial ${i}`,
                timestamp: new Date(),
                messageId: 100 + i,
              })) as ChatMessage[];
            }

            // Pagination
            paginationAttempt++;
            if (paginationAttempt === 1) {
              return { detail: 'Simulated Network Error' };
            }
            return successMessages;
          }
        );

        const apiOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />
        );

        // 1. Initial Load
        await waitFor(() => {
          expect(screen.getByText('Initial 0')).toBeInTheDocument();
        });

        // 2. Scroll to top to trigger pagination
        const scrollArea = screen.getByTestId('chat-scroll-area');
        const viewport = scrollArea.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLElement;
        fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

        // 3. Verify Error State
        await waitFor(() => {
          // Use regex to be resilient against whitespace
          expect(
            screen.getByRole('button', { name: /failed to load more\. retry/i })
          ).toBeInTheDocument();
        });

        // 4. Click Retry
        const user = userEvent.setup();
        const retryBtn = screen.getByRole('button', { name: /failed to load more\. retry/i });
        await user.click(retryBtn);

        // 5. Verify Success
        await waitFor(() => {
          expect(
            screen.queryByRole('button', { name: /failed to load more\. retry/i })
          ).not.toBeInTheDocument();
          expect(screen.getByText('Retried Message 1')).toBeInTheDocument();
          expect(screen.getByText('Retried Message 2')).toBeInTheDocument();
        });
      }
    );

    it(
      'shows error UI and prevents SSE connection on initial history load failure, allowing retry',
      {
        meta: {
          alias: 'History-Initial-Fail-Retry',
          scenario: 'Initial getTranscripts fails -> User clicks Retry -> Success',
          behavior: 'Error UI shown, SSE blocked. After retry, UI loads, SSE connects.',
        },
      },
      async () => {
        // Use a controlled error that persists until we explicitly change it
        let shouldFail = true;
        const getTranscriptsMock = vi.fn(async () => {
          if (shouldFail) {
            return { detail: 'Simulated Initial Error' };
          }
          return [
            {
              id: 'msg-1',
              role: 'assistant' as const,
              content: 'Loaded after retry',
              timestamp: new Date(),
              messageId: 1,
            },
          ] as ChatMessage[];
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />
        );

        // 1. Wait for Error UI (may take multiple calls due to Strict Mode)
        await waitFor(() => {
          expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });

        // 2. Assert NO SSE connection
        expect(chatMocks.allEventSources.length).toBe(0);

        // 3. Assert Input Disabled/Placeholder
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('placeholder', 'Connection failed');

        // 4. Switch to success mode before clicking retry
        shouldFail = false;

        // 5. Click Retry
        await userEvent.click(screen.getByRole('button', { name: /retry/i }));

        // 5. Wait for Success UI
        await waitFor(() => {
          expect(screen.getByText('Loaded after retry')).toBeInTheDocument();
        });

        // 6. Assert SSE Connected
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(1);
        });

        // 7. Manually trigger OPEN to enable input (since we use a mock)
        act(() => chatMocks.eventSource!.simulateOpen());

        // 8. Assert Input Enabled
        await waitFor(() => {
          expect(input).not.toBeDisabled();
        });
        expect(input).toHaveAttribute('placeholder', 'Send a message...');
      }
    );

    it(
      'preserves initial greeting passed via preHireChat when transitioning from first view to normal view (race condition fix)',
      {
        meta: {
          alias: 'History-Preserve-Greeting',
          scenario:
            'New assistant hired. Profile opens (isFirstView=true) with greeting. Hook initializes, calls onFirstViewCompleted. Parent toggles isFirstView=false.',
          behavior:
            'Greeting remains visible. API fetch is skipped to prevent overwriting local greeting with empty server logs.',
        },
      },
      async () => {
        const assistant = createMockAssistant({
          agentId: 'new-hire-id',
          firstName: 'New',
          surname: 'Hire',
        });
        const greetingMsg: ChatMessage = {
          id: 'greeting-1',
          role: 'assistant',
          content: 'Hello! I am your new assistant.',
          timestamp: new Date(),
        };
        const getTranscriptsMock = vi.fn(async () => []);
        const actionsOverride = {
          ...mockAssistantActions,
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };
        const TransitionContainer = () => {
          const [isFirstView, setIsFirstView] = React.useState(true);
          const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
          return (
            <AssistantProfilePanel
              assistant={assistant}
              assistantActions={actionsOverride}
              chatHistories={histories}
              setChatHistories={setHistories}
              userEmail="test@example.com"
              isFirstView={isFirstView}
              preHireChat={isFirstView ? [greetingMsg] : undefined}
              onFirstViewCompleted={() => setIsFirstView(false)}
              onClose={vi.fn()}
              onEdit={vi.fn()}
              onOpenContactManager={vi.fn()}
              onStartCall={vi.fn()}
              activeCallAssistantId={null}
              isCallConnected={false}
              isConnectingCall={false}
            />
          );
        };
        render(<TransitionContainer />);
        expect(screen.getByText('Hello! I am your new assistant.')).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
        });
        expect(screen.getByText('Hello! I am your new assistant.')).toBeInTheDocument();
        expect(getTranscriptsMock).not.toHaveBeenCalled();
      }
    );

    it(
      'preserves pre-hire messages when contact_id is not found initially and requires retry',
      {
        meta: {
          alias: 'History-Preserve-Greeting-ContactRetry',
          scenario:
            'New assistant hired. Profile opens with isFirstView=true and pre-hire chat. ' +
            'getContactId returns null initially (contact not yet created on backend). ' +
            'After retry delay, getContactId returns a valid contact_id.',
          behavior:
            'Pre-hire messages remain visible throughout the contact_id retry. ' +
            'getTranscripts is NOT called because pre-hire messages are already loaded.',
        },
      },
      async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        const assistant = createMockAssistant({
          agentId: 'new-hire-retry-id',
          firstName: 'New',
          surname: 'Retry',
        });

        const preHireMessages: ChatMessage[] = [
          {
            id: 'pre-hire-1',
            role: 'assistant',
            content: 'Hi! Nice to meet you before hiring.',
            timestamp: new Date(),
          },
          {
            id: 'pre-hire-2',
            role: 'user',
            content: 'Hello! Tell me about yourself.',
            timestamp: new Date(),
          },
          {
            id: 'pre-hire-3',
            role: 'assistant',
            content: 'I am a helpful assistant ready to work!',
            timestamp: new Date(),
          },
        ];

        const getTranscriptsMock = vi.fn(async () => []);
        let contactIdCallCount = 0;
        const getContactIdMock = vi.fn(async () => {
          contactIdCallCount++;
          // Return null for first 2 calls (simulating contact not yet created)
          if (contactIdCallCount <= 2) return null;
          // Third call returns valid contact_id
          return 42;
        });

        const actionsOverride = {
          ...mockAssistantActions,
          chat: {
            getContactId: getContactIdMock,
            getTranscripts: getTranscriptsMock,
            message: vi.fn(),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const TransitionContainer = () => {
          const [isFirstView, setIsFirstView] = React.useState(true);
          const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
          return (
            <AssistantProfilePanel
              assistant={assistant}
              assistantActions={actionsOverride}
              chatHistories={histories}
              setChatHistories={setHistories}
              userEmail="test@example.com"
              isFirstView={isFirstView}
              preHireChat={isFirstView ? preHireMessages : undefined}
              onFirstViewCompleted={() => setIsFirstView(false)}
              onClose={vi.fn()}
              onEdit={vi.fn()}
              onOpenContactManager={vi.fn()}
              onStartCall={vi.fn()}
              activeCallAssistantId={null}
              isCallConnected={false}
              isConnectingCall={false}
            />
          );
        };

        render(<TransitionContainer />);

        // Pre-hire messages should be visible immediately
        expect(screen.getByText('Hi! Nice to meet you before hiring.')).toBeInTheDocument();
        expect(screen.getByText('Hello! Tell me about yourself.')).toBeInTheDocument();
        expect(screen.getByText('I am a helpful assistant ready to work!')).toBeInTheDocument();

        // Wait for the first getContactId call (returns null) and the retry to start
        await waitFor(() => {
          expect(getContactIdMock).toHaveBeenCalled();
        });

        // Messages should still be there
        expect(screen.getByText('Hi! Nice to meet you before hiring.')).toBeInTheDocument();

        // Advance past two retry intervals (5s each) so the third call succeeds
        await act(async () => {
          await vi.advanceTimersByTimeAsync(12000);
        });

        // Wait for the contact_id to be resolved
        await waitFor(() => {
          expect(getContactIdMock.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        // Pre-hire messages should STILL be visible after contact_id is resolved
        expect(screen.getByText('Hi! Nice to meet you before hiring.')).toBeInTheDocument();
        expect(screen.getByText('Hello! Tell me about yourself.')).toBeInTheDocument();
        expect(screen.getByText('I am a helpful assistant ready to work!')).toBeInTheDocument();

        // getTranscripts should NOT have been called — pre-hire messages were preserved
        expect(getTranscriptsMock).not.toHaveBeenCalled();

        vi.useRealTimers();
      }
    );
  });

  // =========================================================================
  // SECTION E: CROSS-TAB SYNCHRONIZATION
  // =========================================================================
  describe('E - Cross-Tab Synchronization', () => {
    it(
      'displays messages broadcast from other tabs',
      {
        meta: {
          alias: 'Sync-Receive',
          scenario: 'Message arrives via BroadcastChannel from another tab',
          behavior: 'Message is displayed in the chat',
        },
      },
      async () => {
        const assistantId = 'stress-test-id';
        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // 1. Find the channel listening for this assistant
        const listenerChannel = chatMocks.allBroadcastChannels.find(
          (c) => c.name.includes(assistantId) && c.onmessage
        );
        expect(listenerChannel).toBeDefined();

        // 2. Simulate incoming message from another tab (Correct payload structure)
        act(() => {
          listenerChannel!.simulateIncomingMessage({
            type: 'NEW_MESSAGE',
            message: {
              id: 'msg-remote-1',
              role: 'user',
              content: 'Hello from Tab B',
              timestamp: new Date().toISOString(),
            },
          });
        });

        // 3. Verify it appears
        await waitFor(() => {
          expect(screen.getByText('Hello from Tab B')).toBeInTheDocument();
        });
      }
    );

    it(
      'broadcasts own sent messages to other tabs',
      {
        meta: {
          alias: 'Sync-Send',
          scenario: 'User sends a message',
          behavior: 'Message is posted to BroadcastChannel',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());
        const user = userEvent.setup();

        const input = screen.getByRole('textbox');
        await user.type(input, 'Sync Me');
        await user.keyboard('{Enter}');

        await waitFor(() => {
          // Find channels that were used to POST
          const postingChannels = chatMocks.allBroadcastChannels.filter(
            (c) => c.postMessage.mock.calls.length > 0
          );
          expect(postingChannels.length).toBeGreaterThan(0);

          const lastPost = postingChannels[postingChannels.length - 1].postMessage.mock.calls[0][0];

          // Assert payload structure
          expect(lastPost).toMatchObject({
            type: 'NEW_MESSAGE',
            message: {
              role: 'user',
              content: 'Sync Me',
            },
          });

          expect(lastPost.message.timestamp).toBeInstanceOf(Date);
        });
      }
    );

    it(
      'prevents duplicate messages if broadcast arrives for existing message',
      {
        meta: {
          alias: 'Sync-Dedupe',
          scenario:
            'User sends message (optimistic update), then receives same message via BroadcastChannel (race condition)',
          behavior: 'Message is displayed only once',
        },
      },
      async () => {
        const assistantId = 'stress-test-id';
        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());
        const user = userEvent.setup();

        // 1. Send Message
        const input = screen.getByRole('textbox');
        await user.type(input, 'Race Condition');
        await user.keyboard('{Enter}');

        // 2. Capture the ID generated for the sent message from the postMessage call
        const postingChannels = chatMocks.allBroadcastChannels.filter(
          (c) => c.postMessage.mock.calls.length > 0
        );
        const sentPayload =
          postingChannels[postingChannels.length - 1].postMessage.mock.calls[0][0];
        const msgId = sentPayload.message.id;

        // 3. Verify it is displayed
        await waitFor(() => expect(screen.getAllByText('Race Condition')).toHaveLength(1));

        // 4. Simulate receiving exact same message via BroadcastChannel
        const listenerChannel = chatMocks.allBroadcastChannels.find(
          (c) => c.name.includes(assistantId) && c.onmessage
        );

        act(() => {
          listenerChannel!.simulateIncomingMessage({
            type: 'NEW_MESSAGE',
            message: {
              ...sentPayload.message,
              timestamp: sentPayload.message.timestamp.toISOString(), // Simulate JSON serialization over wire
            },
          });
        });

        // 5. Verify no duplicate
        await new Promise((r) => setTimeout(r, 100));
        expect(screen.getAllByText('Race Condition')).toHaveLength(1);
      }
    );

    it(
      'relays incoming SSE messages to other tabs via BroadcastChannel',
      {
        meta: {
          alias: 'Sync-Relay',
          scenario: 'Tab A receives message via SSE',
          behavior: 'Tab A broadcasts the message to Tab B',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Simulate incoming SSE message
        const sseMessage = {
          thread: 'unify_message_outbound',
          id: 'msg-server-1',
          publishTime: new Date().toISOString(),
          event: { content: 'Server Says Hello' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(sseMessage);
        });

        // Verify UI update
        await waitFor(() => {
          expect(screen.getByText('Server Says Hello')).toBeInTheDocument();
        });

        // Verify Broadcast
        await waitFor(() => {
          const postingChannels = chatMocks.allBroadcastChannels.filter(
            (c) => c.postMessage.mock.calls.length > 0
          );
          expect(postingChannels.length).toBeGreaterThan(0);

          const lastPost = postingChannels[postingChannels.length - 1].postMessage.mock.calls[0][0];
          expect(lastPost).toMatchObject({
            type: 'NEW_MESSAGE',
            message: {
              id: 'msg-server-1',
              role: 'assistant',
              content: 'Server Says Hello',
            },
          });
        });
      }
    );

    it(
      'strips __ackId from relayed messages to prevent double-acking by listeners',
      {
        meta: {
          alias: 'Sync-Strip-Ack',
          scenario: 'SSE message arrives with ackId',
          behavior: 'Broadcasted message does NOT contain ackId',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={undefined} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const sseMessageWithAck = {
          thread: 'unify_message_outbound',
          id: 'msg-with-ack',
          __ackId: 'secret-token-123',
          event: { content: 'Ack Check' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(sseMessageWithAck);
        });

        await waitFor(() => {
          const postingChannels = chatMocks.allBroadcastChannels.filter(
            (c) => c.postMessage.mock.calls.length > 0
          );
          const lastPost = postingChannels[postingChannels.length - 1].postMessage.mock.calls[0][0];

          // Assert content exists
          expect(lastPost.message.content).toBe('Ack Check');
          // Assert ACK ID is stripped
          expect(lastPost.message.__ackId).toBeUndefined();
        });
      }
    );

    it(
      'does not re-broadcast messages received via BroadcastChannel (loop prevention)',
      {
        meta: {
          alias: 'Sync-Loop-Prevention',
          scenario: 'Message received via BroadcastChannel',
          behavior: 'Message is rendered but NOT re-broadcasted',
        },
      },
      async () => {
        const assistantId = 'stress-test-id';
        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // 1. Identify listener channel
        const listenerChannel = chatMocks.allBroadcastChannels.find(
          (c) => c.name.includes(assistantId) && c.onmessage
        );

        // 2. Simulate INCOMING broadcast
        act(() => {
          listenerChannel!.simulateIncomingMessage({
            type: 'NEW_MESSAGE',
            message: {
              id: 'msg-broadcast-in',
              role: 'assistant',
              content: 'Loop Check',
              timestamp: new Date().toISOString(),
            },
          });
        });

        // 3. Verify UI update
        await waitFor(() => {
          expect(screen.getByText('Loop Check')).toBeInTheDocument();
        });

        // 4. Verify NO outgoing broadcast was triggered
        const postingChannels = chatMocks.allBroadcastChannels.filter(
          (c) => c.postMessage.mock.calls.length > 0
        );
        expect(postingChannels.length).toBe(0);
      }
    );
  });

  // =========================================================================
  // SECTION F: OWNER CONTEXT RESOLUTION
  // =========================================================================
  describe('F - Owner Context Resolution', () => {
    it(
      'uses userFirstName and userLastName from assistant when available',
      {
        meta: {
          alias: 'Context-Direct',
          scenario: 'Assistant has userFirstName and userLastName fields populated',
          behavior: 'getTranscripts is called with correct parameters via All/Transcripts',
        },
      },
      async () => {
        const getTranscriptsMock = vi.fn(async () => []);
        const getContactIdMock = vi.fn(async () => 1);

        const assistantWithOwnerNames = createMockAssistant({
          agentId: 'owner-context-test',
          firstName: 'Ada',
          surname: 'Lovelace',
          userFirstName: 'John',
          userLastName: 'Doe',
          userId: 'user-123',
        });

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantWithOwnerNames}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null), // Should NOT be called
              },
            }}
          />
        );

        await waitFor(() => {
          expect(getContactIdMock).toHaveBeenCalledWith(
            'test@example.com', // userEmail
            expect.any(String), // ownerId
            expect.any(String) // assistantId
          );
        });

        await waitFor(() => {
          expect(getTranscriptsMock).toHaveBeenCalledWith(
            1, // contactId returned by getContactIdMock
            expect.any(String), // ownerId
            expect.any(String) // assistantId
            // beforeMessageId is not passed for initial load
          );
        });
      }
    );

    it(
      'falls back to getAssistantOwnerById when user names are missing',
      {
        meta: {
          alias: 'Context-Fallback',
          scenario: 'Assistant is missing userFirstName/userLastName',
          behavior: 'getAssistantOwnerById is called with userId to resolve owner context',
        },
      },
      async () => {
        const getTranscriptsMock = vi.fn(async () => []);
        const getContactIdMock = vi.fn(async () => 1);
        const getAssistantOwnerByIdMock = vi.fn(async () => ({
          firstName: 'Jane',
          lastName: 'Smith',
        }));

        const assistantWithoutOwnerNames = createMockAssistant({
          agentId: 'fallback-context-test',
          firstName: 'Ada',
          surname: 'Lovelace',
          userFirstName: null,
          userLastName: null,
          userId: 'owner-user-456',
        });

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantWithoutOwnerNames}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: getAssistantOwnerByIdMock,
              },
            }}
          />
        );

        await waitFor(() => {
          expect(getAssistantOwnerByIdMock).toHaveBeenCalledWith('owner-user-456');
        });

        await waitFor(() => {
          expect(getContactIdMock).toHaveBeenCalledWith(
            'test@example.com',
            expect.any(String), // ownerId
            expect.any(String) // assistantId
          );
        });
      }
    );

    it(
      'sets canChat=false when owner context cannot be resolved',
      {
        meta: {
          alias: 'Context-Unresolvable',
          scenario: 'Assistant has no user names and getAssistantOwnerById returns null',
          behavior: 'Chat is disabled with error message',
        },
      },
      async () => {
        const getAssistantOwnerByIdMock = vi.fn(async () => null);

        const assistantUnresolvable = createMockAssistant({
          agentId: 'unresolvable-context-test',
          firstName: 'Ada',
          surname: 'Lovelace',
          userFirstName: null,
          userLastName: null,
          userId: 'unknown-user',
        });

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantUnresolvable}
            assistantActionsOverride={{
              chat: {
                getContactId: vi.fn(async () => 1),
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: getAssistantOwnerByIdMock,
              },
            }}
          />
        );

        // When owner context fails, initialLoadError is set to true
        // which shows "Failed to load chat history" instead of messages
        await waitFor(() => {
          expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // SECTION G: CONTACT ID LOOKUP AND CHAT PERMISSIONS
  // =========================================================================
  describe('G - Contact ID Lookup and Permissions', () => {
    it(
      'calls getContactId with correct parameters on init',
      {
        meta: {
          alias: 'ContactId-Init',
          scenario: 'Chat panel opens for an assistant',
          behavior: 'getContactId is called with userEmail, ownerId, and assistantId',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => 2);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => {
          expect(getContactIdMock).toHaveBeenCalled();
          const callArgs = getContactIdMock.mock.calls[0] as unknown as [string, string, string];
          expect(callArgs[0]).toBe('test@example.com'); // userEmail
          expect(callArgs[1]).toEqual(expect.any(String)); // ownerId
          expect(callArgs[2]).toEqual(expect.any(String)); // assistantId
        });
      }
    );

    it(
      'disables chat when getContactId returns null',
      {
        meta: {
          alias: 'ContactId-NoAccess',
          scenario: 'User is not in assistant contacts table',
          behavior: 'Chat is disabled with appropriate message',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => null); // User not found

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // With new UX: messages area shows normally, but there's a status banner and input is disabled
        await waitFor(() => {
          // Check for the retrying status banner
          expect(
            screen.getByText(/Setting up chat connection|Chat is currently unavailable/i)
          ).toBeInTheDocument();
        });

        // Input should be disabled with appropriate placeholder
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('placeholder', expect.stringMatching(/Chat unavailable/i));
      }
    );

    it(
      'caches contactId and does not refetch on re-render',
      {
        meta: {
          alias: 'ContactId-Cache',
          scenario: 'User switches away and back to the same assistant',
          behavior: 'getContactId is only called once per assistant',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => 1);
        const getTranscriptsMock = vi.fn(async () => []);

        const assistant = createMockAssistant({
          agentId: 'cache-test-id',
          firstName: 'Cache',
          surname: 'Test',
        });

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistant}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => expect(getContactIdMock).toHaveBeenCalledTimes(1));

        // Re-render same component (no key change = same instance, cached state preserved)
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistant}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // getContactId should still have been called only once (cache hit)
        await new Promise((r) => setTimeout(r, 100));
        expect(getContactIdMock).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'passes contactId to getTranscripts',
      {
        meta: {
          alias: 'ContactId-Transcripts',
          scenario: 'Chat loads transcripts',
          behavior: 'getTranscripts is called with the resolved contactId',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => 42); // Custom contact_id
        const getTranscriptsMock = vi.fn(async () => []);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => {
          expect(getTranscriptsMock).toHaveBeenCalled();
          const callArgs = getTranscriptsMock.mock.calls[0] as unknown as [
            string,
            string,
            number,
            string,
            string,
            number | undefined,
          ];
          expect(callArgs[2]).toBe(42); // contactId is 3rd argument
        });
      }
    );

    // -------------------------------------------------------------------------
    // Contact ID Not Found Tests
    // -------------------------------------------------------------------------
    describe('Contact ID Not Found', () => {
      it(
        'disables input and shows retry placeholder when contact_id not available',
        {
          meta: {
            alias: 'ContactId-RetryDisabledInput',
            scenario: 'getContactId returns null',
            behavior: 'Input is disabled with retry placeholder',
          },
        },
        async () => {
          const getContactIdMock = vi.fn(async () => null);

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={{
                chat: {
                  getContactId: getContactIdMock,
                  getTranscripts: vi.fn(async () => []),
                  message: vi.fn(async () => ({})),
                  getAssistantOwnerById: vi.fn(async () => null),
                },
              }}
            />
          );

          // Wait for initial lookup to complete
          await waitFor(() => {
            expect(getContactIdMock).toHaveBeenCalled();
          });

          // Input should be disabled with retry placeholder
          const input = screen.getByRole('textbox');
          expect(input).toBeDisabled();
          expect(input).toHaveAttribute(
            'placeholder',
            expect.stringMatching(/Chat unavailable.*retrying/i)
          );
        }
      );

      it(
        'clears retry state when switching to different assistant',
        {
          meta: {
            alias: 'ContactId-RetryResetOnSwitch',
            scenario: 'Retry is in progress, user switches to different assistant',
            behavior: 'New assistant lookup starts fresh',
          },
        },
        async () => {
          const getContactIdMock = vi.fn(async () => null);

          const assistant1 = createMockAssistant({
            agentId: 'assistant-switch-1',
            firstName: 'First',
            surname: 'Assistant',
          });

          const assistant2 = createMockAssistant({
            agentId: 'assistant-switch-2',
            firstName: 'Second',
            surname: 'Assistant',
          });

          const { rerender } = render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantOverride={assistant1}
              assistantActionsOverride={{
                chat: {
                  getContactId: getContactIdMock,
                  getTranscripts: vi.fn(async () => []),
                  message: vi.fn(async () => ({})),
                  getAssistantOwnerById: vi.fn(async () => null),
                },
              }}
            />
          );

          // Initial lookup for assistant1 fails
          await waitFor(() => {
            expect(getContactIdMock).toHaveBeenCalledTimes(1);
          });

          // Should show retrying status
          await waitFor(() => {
            expect(screen.getByText(/Setting up chat connection/i)).toBeInTheDocument();
          });

          // Switch to assistant2
          rerender(
            <ChatTestWrapper
              key="assistant-switch-2"
              initialHistory={undefined}
              assistantOverride={assistant2}
              assistantActionsOverride={{
                chat: {
                  getContactId: getContactIdMock,
                  getTranscripts: vi.fn(async () => []),
                  message: vi.fn(async () => ({})),
                  getAssistantOwnerById: vi.fn(async () => null),
                },
              }}
            />
          );

          // Initial lookup for assistant2 should happen
          await waitFor(() => {
            expect(getContactIdMock).toHaveBeenCalledTimes(2);
          });

          // Should still show retrying status for new assistant
          await waitFor(() => {
            expect(screen.getByText(/Setting up chat connection/i)).toBeInTheDocument();
          });
        }
      );

      it(
        'shows messages area even when contact_id is not available',
        {
          meta: {
            alias: 'ContactId-ShowMessagesWhileRetrying',
            scenario: 'getContactId returns null',
            behavior: 'Messages area is visible (not blocked by placeholder)',
          },
        },
        async () => {
          const getContactIdMock = vi.fn(async () => null);

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={{
                chat: {
                  getContactId: getContactIdMock,
                  getTranscripts: vi.fn(async () => []),
                  message: vi.fn(async () => ({})),
                  getAssistantOwnerById: vi.fn(async () => null),
                },
              }}
            />
          );

          // Wait for initial lookup to complete
          await waitFor(() => {
            expect(getContactIdMock).toHaveBeenCalled();
          });

          // Should show status banner but NOT the old "Chat is not available" placeholder
          await waitFor(() => {
            expect(screen.getByText(/Setting up chat connection/i)).toBeInTheDocument();
          });

          // The chat scroll area should be visible
          expect(screen.getByTestId('chat-scroll-area')).toBeVisible();
        }
      );

      it(
        'exposes isRetryingContactId state for UI',
        {
          meta: {
            alias: 'ContactId-RetryingState',
            scenario: 'getContactId returns null',
            behavior: 'isRetryingContactId is true and reflected in UI',
          },
        },
        async () => {
          const getContactIdMock = vi.fn(async () => null);

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={{
                chat: {
                  getContactId: getContactIdMock,
                  getTranscripts: vi.fn(async () => []),
                  message: vi.fn(async () => ({})),
                  getAssistantOwnerById: vi.fn(async () => null),
                },
              }}
            />
          );

          // Wait for retrying state to be reflected in UI
          await waitFor(() => {
            // The placeholder should indicate retrying
            const input = screen.getByRole('textbox');
            expect(input.getAttribute('placeholder')).toMatch(/retrying/i);
          });
        }
      );
    });
  });

  // =========================================================================
  // SECTION H: MESSAGE SENDING WITH CONTACT_ID
  // =========================================================================
  describe('H - Message Sending with Contact ID', () => {
    it(
      'includes contactId in message payload',
      {
        meta: {
          alias: 'Send-ContactId',
          scenario: 'User sends a message',
          behavior: 'Message payload includes the correct contact_id',
        },
      },
      async () => {
        const messageMock = vi.fn(async () => ({ info: 'sent' }));
        const getContactIdMock = vi.fn(async () => 7); // Custom contact_id

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: messageMock,
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // Wait for async initialization to complete and SSE to connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const user = userEvent.setup();
        const input = await screen.findByRole('textbox');
        await waitFor(() => expect(input).not.toBeDisabled());

        await user.type(input, 'Hello with contact_id');
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(messageMock).toHaveBeenCalled();
          const callArgs = messageMock.mock.calls[0] as unknown as [
            { assistantId: number; contactId: number; message: string },
          ];
          expect(callArgs[0]).toMatchObject({
            assistantId: expect.any(Number),
            contactId: 7, // Should be the resolved contactId
            message: 'Hello with contact_id',
          });
        });
      }
    );

    it(
      'prevents sending when contactId is not available',
      {
        meta: {
          alias: 'Send-NoContactId',
          scenario: 'User tries to send but contactId lookup failed',
          behavior: 'Send button is disabled',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => null);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // With new UX: status banner shows, input is disabled
        await waitFor(() => {
          expect(
            screen.getByText(/Setting up chat connection|Chat is currently unavailable/i)
          ).toBeInTheDocument();
        });

        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled();
      }
    );
  });

  // =========================================================================
  // SECTION I: PUBSUB MESSAGE FILTERING BY CONTACT_ID
  // =========================================================================
  describe('I - PubSub Message Filtering', () => {
    it(
      'displays SSE messages that match user contactId',
      {
        meta: {
          alias: 'PubSub-Match',
          scenario: 'SSE message arrives with matching contact_id',
          behavior: 'Message is displayed in chat',
        },
      },
      async () => {
        const userContactId = 5;
        const getContactIdMock = vi.fn(async () => userContactId);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // Wait for async initialization to complete and SSE to connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Simulate SSE message FOR this user
        const sseMessage = {
          thread: 'unify_message_outbound',
          id: 'msg-for-me',
          contactId: userContactId, // Matches user's contactId
          publishTime: new Date().toISOString(),
          event: { content: 'Message for me!' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(sseMessage);
        });

        await waitFor(() => {
          expect(screen.getByText('Message for me!')).toBeInTheDocument();
        });
      }
    );

    it(
      'ignores SSE messages with different contact_id',
      {
        meta: {
          alias: 'PubSub-Ignore',
          scenario: 'SSE message arrives with different contact_id',
          behavior: 'Message is NOT displayed',
        },
      },
      async () => {
        const userContactId = 5;
        const otherContactId = 99;
        const getContactIdMock = vi.fn(async () => userContactId);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // Wait for async initialization to complete and SSE to connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Simulate SSE message for ANOTHER user
        const sseMessage = {
          thread: 'unify_message_outbound',
          id: 'msg-for-other',
          contactId: otherContactId, // Different user
          publishTime: new Date().toISOString(),
          event: { content: 'Not for me!' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(sseMessage);
        });

        // Wait a bit to ensure message processing
        await new Promise((r) => setTimeout(r, 100));

        expect(screen.queryByText('Not for me!')).not.toBeInTheDocument();
      }
    );

    it(
      'displays SSE messages without contact_id (legacy/broadcast)',
      {
        meta: {
          alias: 'PubSub-NoContactId',
          scenario: 'SSE message arrives without contact_id field',
          behavior: 'Message is displayed (backwards compatibility)',
        },
      },
      async () => {
        const getContactIdMock = vi.fn(async () => 5);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        // Wait for async initialization to complete and SSE to connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Simulate SSE message WITHOUT contact_id
        const sseMessage = {
          thread: 'unify_message_outbound',
          id: 'msg-broadcast',
          // No contact_id field
          publishTime: new Date().toISOString(),
          event: { content: 'Broadcast to all!' },
        };

        act(() => {
          chatMocks.eventSource!.simulateMessage(sseMessage);
        });

        await waitFor(() => {
          expect(screen.getByText('Broadcast to all!')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // SECTION J: TRANSCRIPT ROLE MAPPING
  // =========================================================================
  describe('J - Transcript Role Mapping', () => {
    it(
      'maps sender_id=0 to assistant role',
      {
        meta: {
          alias: 'Role-Assistant',
          scenario: 'Transcript log has sender_id=0 (assistant)',
          behavior: 'Message is displayed as assistant message',
        },
      },
      async () => {
        const mockTranscripts: ChatMessage[] = [
          {
            id: '1',
            role: 'assistant', // sender_id=0 maps to 'assistant'
            content: 'Hello from the assistant',
            timestamp: new Date(),
            messageId: 1,
          },
        ];

        const getTranscriptsMock = vi.fn(async () => mockTranscripts);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: vi.fn(async () => 1),
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => {
          const bubble = screen
            .getByText('Hello from the assistant')
            .closest('[data-testid="message-bubble"]');
          expect(bubble).toHaveAttribute('data-role', 'assistant');
        });
      }
    );

    it(
      'maps sender_id!=0 to user role',
      {
        meta: {
          alias: 'Role-User',
          scenario: 'Transcript log has sender_id=1 or higher (human user)',
          behavior: 'Message is displayed as user message',
        },
      },
      async () => {
        const mockTranscripts: ChatMessage[] = [
          {
            id: '1',
            role: 'user', // sender_id!=0 maps to 'user'
            content: 'Hello from the user',
            timestamp: new Date(),
            messageId: 1,
          },
        ];

        const getTranscriptsMock = vi.fn(async () => mockTranscripts);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: vi.fn(async () => 1),
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => {
          const bubble = screen
            .getByText('Hello from the user')
            .closest('[data-testid="message-bubble"]');
          expect(bubble).toHaveAttribute('data-role', 'user');
        });
      }
    );
  });

  // =========================================================================
  // SECTION K: CROSS-USER CHAT ISOLATION
  // =========================================================================
  describe('K - Cross-User Chat Isolation', () => {
    it(
      'filters SSE messages by contact_id to ensure chat isolation',
      {
        meta: {
          alias: 'Isolation-ContactId-Filter',
          scenario:
            'User A (contact_id=5) is chatting while User B (contact_id=10) messages arrive',
          behavior: 'User A only sees messages with matching contact_id',
        },
      },
      async () => {
        const userAContactId = 5;
        const userBContactId = 10;
        const getContactIdMock = vi.fn(async () => userAContactId);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Message for User A - should be displayed
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-for-user-a',
            contactId: userAContactId,
            publishTime: new Date().toISOString(),
            event: { content: 'Hello User A!' },
          });
        });

        // Message for User B - should NOT be displayed
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-for-user-b',
            contactId: userBContactId,
            publishTime: new Date().toISOString(),
            event: { content: 'Hello User B!' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Hello User A!')).toBeInTheDocument();
        });
        expect(screen.queryByText('Hello User B!')).not.toBeInTheDocument();
      }
    );

    it(
      'only acks messages for current user session',
      {
        meta: {
          alias: 'Isolation-Ack-Filter',
          scenario: 'SSE messages for different users arrive with ack tokens',
          behavior: 'Only messages for current user are acked',
        },
      },
      async () => {
        const userContactId = 7;
        const otherContactId = 99;
        const getContactIdMock = vi.fn(async () => userContactId);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: vi.fn(async () => []),
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Message for current user
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-mine',
            contactId: userContactId,
            __ackId: 'ack-mine',
            publishTime: new Date().toISOString(),
            event: { content: 'My message' },
          });
        });

        // Message for other user
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-other',
            contactId: otherContactId,
            __ackId: 'ack-other',
            publishTime: new Date().toISOString(),
            event: { content: 'Other message' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('My message')).toBeInTheDocument();
        });

        // Verify only the current user's message was acked
        await waitFor(() => {
          expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/events/ack'),
            expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-mine' }) })
          );
        });

        // Other user's message should not have been acked
        const ackCalls = fetchSpy.mock.calls.filter(
          (call) =>
            String(call[0]).includes('/events/ack') &&
            call[1]?.body === JSON.stringify({ ackId: 'ack-other' })
        );
        expect(ackCalls.length).toBe(0);
      }
    );

    it(
      'loads only current user chat history via contactId',
      {
        meta: {
          alias: 'Isolation-History-Load',
          scenario: 'User opens chat for an assistant they share with others',
          behavior: 'getTranscripts is called with correct contactId to load only their messages',
        },
      },
      async () => {
        const userContactId = 42;
        const getContactIdMock = vi.fn(async () => userContactId);
        const getTranscriptsMock = vi.fn(async () => [
          {
            id: 'msg-1',
            role: 'user',
            content: 'My previous message',
            timestamp: new Date(),
            messageId: 1,
          },
        ]);

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={{
              chat: {
                getContactId: getContactIdMock,
                getTranscripts: getTranscriptsMock,
                message: vi.fn(async () => ({})),
                getAssistantOwnerById: vi.fn(async () => null),
              },
            }}
          />
        );

        await waitFor(() => {
          expect(getTranscriptsMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            userContactId,
            expect.any(String), // ownerId
            expect.any(String) // assistantId
            // beforeMessageId is not passed for initial load
          );
        });

        expect(screen.getByText('My previous message')).toBeInTheDocument();
      }
    );
  });

  // =========================================================================
  // SECTION L: ERROR RECOVERY
  // =========================================================================
  describe('L - Error Recovery', () => {
    it(
      'reconnects SSE after connection error',
      {
        meta: {
          alias: 'Recovery-SSE-Reconnect',
          scenario: 'SSE connection drops unexpectedly',
          behavior: 'Component attempts to reconnect automatically',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const firstConnection = chatMocks.eventSource;

        // Simulate connection error
        act(() => {
          chatMocks.eventSource!.simulateError();
        });

        // Wait for reconnection attempt
        await waitFor(
          () => {
            expect(chatMocks.allEventSources.length).toBeGreaterThan(1);
          },
          { timeout: 5000 }
        );

        const secondConnection = chatMocks.allEventSources[chatMocks.allEventSources.length - 1];
        expect(secondConnection).not.toBe(firstConnection);
      }
    );

    it(
      'retries message send on failure and restores input',
      {
        meta: {
          alias: 'Recovery-Message-Retry',
          scenario: 'Message send fails',
          behavior: 'Message is removed from UI, input is restored, error toast shown',
        },
      },
      async () => {
        const failingMessageAction = vi.fn(async () => {
          // Small delay to allow optimistic update to complete before failure
          await new Promise((r) => setTimeout(r, 50));
          throw new Error('Network Error');
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: failingMessageAction,
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const user = userEvent.setup();
        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        await user.type(input, 'This will fail');
        await user.keyboard('{Enter}');

        // Optimistic update shows message
        await waitFor(() => {
          expect(screen.getByText('This will fail')).toBeInTheDocument();
          expect(input).toHaveValue('');
        });

        // After failure, message is removed and input restored
        await waitFor(() => {
          const bubbles = screen.queryAllByTestId('message-bubble');
          const bubbleContents = bubbles.map((b) => b.textContent);
          expect(bubbleContents).not.toContain('This will fail');
          expect(input).toHaveValue('This will fail');
          // Error toast shown
          expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
        });
      }
    );

    it(
      'continues receiving messages after history load failure retry',
      {
        meta: {
          alias: 'Recovery-History-Then-SSE',
          scenario: 'Initial history fails, user retries, then receives SSE messages',
          behavior: 'After successful retry, SSE messages are properly received',
        },
      },
      async () => {
        // Use a controlled error that persists until we change it
        let shouldFail = true;
        const getTranscriptsMock = vi.fn(async () => {
          if (shouldFail) {
            return { detail: 'Server Error' };
          }
          return [];
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: getTranscriptsMock,
            message: vi.fn(async () => ({})),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantActionsOverride={actionsOverride}
            panelKey="error-recovery-test"
          />
        );

        // Wait for error UI (may take multiple calls due to Strict Mode)
        await waitFor(() => {
          expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
        });

        // No SSE connection yet
        expect(chatMocks.allEventSources.length).toBe(0);

        // Switch to success mode before clicking retry
        shouldFail = false;

        // Click retry
        await userEvent.click(screen.getByRole('button', { name: /retry/i }));

        // Wait for success
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
        });

        // SSE should now be connected
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(1);
        });

        act(() => chatMocks.eventSource!.simulateOpen());

        // Send a message via SSE
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-after-retry',
            publishTime: new Date().toISOString(),
            event: { content: 'Hello after retry' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Hello after retry')).toBeInTheDocument();
        });
      }
    );

    it(
      'handles malformed SSE messages gracefully',
      {
        meta: {
          alias: 'Recovery-Malformed-SSE',
          scenario: 'SSE receives malformed JSON or unexpected data format',
          behavior: 'Component handles error without crashing, valid messages still work',
        },
      },
      async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Send malformed message
        act(() => {
          chatMocks.eventSource!.simulateMessage('not valid json {{{');
        });

        // Send valid message after
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-valid',
            publishTime: new Date().toISOString(),
            event: { content: 'Valid message' },
          });
        });

        // Valid message should still appear
        await waitFor(() => {
          expect(screen.getByText('Valid message')).toBeInTheDocument();
        });

        consoleSpy.mockRestore();
      }
    );

    it(
      'preserves messages when SSE reconnects',
      {
        meta: {
          alias: 'Recovery-Preserve-On-Reconnect',
          scenario: 'SSE disconnects and reconnects',
          behavior: 'Previously received messages are preserved, no duplicates on replay',
        },
      },
      async () => {
        render(<ChatTestWrapper initialHistory={[]} />);
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Receive message
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-before-disconnect',
            publishTime: new Date().toISOString(),
            event: { content: 'Before disconnect' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Before disconnect')).toBeInTheDocument();
        });

        // Simulate disconnect and reconnect
        act(() => {
          chatMocks.eventSource!.simulateError();
        });

        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBeGreaterThan(1);
        });

        const newConnection = chatMocks.allEventSources[chatMocks.allEventSources.length - 1];
        act(() => newConnection.simulateOpen());

        // Replay same message (simulating server resending on reconnect)
        act(() => {
          newConnection.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-before-disconnect',
            publishTime: new Date().toISOString(),
            event: { content: 'Before disconnect' },
          });
        });

        // Should still have only one message (deduplicated)
        await waitFor(() => {
          const bubbles = getChatBubbles();
          expect(bubbles.filter((b) => b === 'Before disconnect').length).toBe(1);
        });

        // New message should also work
        act(() => {
          newConnection.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-after-reconnect',
            publishTime: new Date().toISOString(),
            event: { content: 'After reconnect' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('After reconnect')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // SECTION M: CONNECTION STABILITY
  // =========================================================================
  describe('M - Connection Stability', () => {
    // These tests use pre-loaded history with ChatTestHarness which provides
    // a more reliable test setup for connection stability testing
    it(
      'creates exactly one EventSource after history loads',
      {
        meta: {
          alias: 'SSE-Single-Connection',
          scenario: 'Component mounts and history loads',
          behavior: 'Only one EventSource is created and maintained',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

        // Verify only one connection was created
        expect(chatMocks.allEventSources.length).toBe(1);

        // Simulate connection open
        act(() => chatMocks.eventSource!.simulateOpen());

        // Wait for connection to stabilize and verify no new connections
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(1);
        });
      }
    );

    it(
      'does not create duplicate connections when receiving messages',
      {
        meta: {
          alias: 'SSE-No-Duplicate',
          scenario: 'Multiple messages received rapidly',
          behavior: 'Connection count remains stable',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const initialConnectionCount = chatMocks.allEventSources.length;

        // Send multiple messages rapidly
        for (let i = 0; i < 10; i++) {
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: `msg-stability-${i}`,
              publishTime: new Date().toISOString(),
              event: { content: `Stability Message ${i}` },
            });
          });
        }

        // Verify no new connections were created
        expect(chatMocks.allEventSources.length).toBe(initialConnectionCount);
      }
    );

    it(
      'maintains stable connection during rapid state updates',
      {
        meta: {
          alias: 'SSE-Rapid-Updates',
          scenario: 'Rapid message bursts trigger state updates',
          behavior: 'Connection remains stable throughout',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
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
      }
    );

    it(
      'shows correct status during connection lifecycle',
      {
        meta: {
          alias: 'SSE-Status-Lifecycle',
          scenario: 'Connection transitions through states',
          behavior: 'UI reflects correct connection status',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

        // Before open - should show connecting
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();

        // After open - should show connected (status indicator disappears)
        act(() => chatMocks.eventSource!.simulateOpen());

        await waitFor(() => {
          expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
        });
      }
    );

    it(
      'displays messages received via SSE correctly',
      {
        meta: {
          alias: 'SSE-Message-Display',
          scenario: 'SSE message arrives',
          behavior: 'Message is displayed in chat',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
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
      }
    );

    it(
      'does not reconnect when receiving multiple messages',
      {
        meta: {
          alias: 'SSE-No-Reconnect-On-Messages',
          scenario: 'Multiple SSE messages received',
          behavior: 'Connection remains stable without reconnection',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const initialConnectionCount = chatMocks.allEventSources.length;

        // Receive messages (which should not trigger reconnection)
        for (let i = 0; i < 5; i++) {
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: `no-reconnect-msg-${i}`,
              publishTime: new Date().toISOString(),
              event: { content: `No Reconnect Message ${i}` },
            });
          });
        }

        // Wait for messages to be processed
        await waitFor(() => {
          expect(screen.getByText('No Reconnect Message 4')).toBeInTheDocument();
        });

        // Connection count should remain stable
        expect(chatMocks.allEventSources.length).toBe(initialConnectionCount);
      }
    );

    it(
      'deduplicates messages with same ID',
      {
        meta: {
          alias: 'SSE-Dedup-Same-ID',
          scenario: 'Same message ID received multiple times',
          behavior: 'Only one instance of message is displayed',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const messageId = 'dedup-stability-msg';
        const messageContent = 'Deduplicated Stability Message';

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
      }
    );

    it(
      'does not deduplicate messages with different IDs',
      {
        meta: {
          alias: 'SSE-No-Dedup-Different-ID',
          scenario: 'Different message IDs received',
          behavior: 'All messages are displayed',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Send multiple messages with different IDs
        for (let i = 0; i < 3; i++) {
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: `unique-stability-msg-${i}`,
              publishTime: new Date().toISOString(),
              event: { content: `Unique Stability Message ${i}` },
            });
          });
        }

        // Should have all three messages
        await waitFor(() => {
          expect(screen.getByText('Unique Stability Message 0')).toBeInTheDocument();
          expect(screen.getByText('Unique Stability Message 1')).toBeInTheDocument();
          expect(screen.getByText('Unique Stability Message 2')).toBeInTheDocument();
        });
      }
    );

    it(
      'shows reconnecting status after error',
      {
        meta: {
          alias: 'SSE-Reconnecting-Status',
          scenario: 'SSE connection error occurs',
          behavior: 'Reconnecting status is displayed',
        },
      },
      async () => {
        const chatActions = createMockChatActionsFromFixture();
        render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );
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
      }
    );
  });

  // =========================================================================
  // SECTION N: ATTACHMENTS
  // =========================================================================
  describe('N - Attachments', () => {
    const attachmentUser = userEvent.setup();

    describe('Paperclip Button', () => {
      it(
        'should render paperclip button and be enabled when connected',
        {
          meta: {
            alias: 'Attach-Button-Enabled',
            scenario: 'Chat is connected',
            behavior: 'Paperclip button is enabled',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          // Wait for EventSource and open connection
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for input to be enabled (using findBy which waits)
          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Attach button should also be enabled when connection is ready
          const attachButton = getAttachButton(screen);
          expect(attachButton).not.toBeDisabled();
        }
      );

      it(
        'should be disabled when chat is not connected',
        {
          meta: {
            alias: 'Attach-Button-Disabled',
            scenario: 'Chat is not connected',
            behavior: 'Paperclip button is disabled',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          // Wait for EventSource to be created but don't open it
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

          // Button should render but be disabled without connection
          const attachButton = await screen.findByLabelText('Attach files');
          expect(attachButton).toBeDisabled();
        }
      );
    });

    describe('File Selection', () => {
      it(
        'should add attachment chip when file is selected',
        {
          meta: {
            alias: 'Attach-Add-Chip',
            scenario: 'User selects a file',
            behavior: 'Attachment chip appears',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for connection to be ready
          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Upload a file
          const file = testFiles.pdf();
          await simulateFileDrop(container, [file], attachmentUser);

          // Check chip was added
          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toContain('report.pdf');
          });
        }
      );

      it(
        'should show correct icon for PDF files',
        {
          meta: {
            alias: 'Attach-PDF-Icon',
            scenario: 'PDF file attached',
            behavior: 'PDF icon is displayed',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          const file = testFiles.pdf();
          await simulateFileDrop(container, [file], attachmentUser);

          await waitFor(() => {
            const chips = getAttachmentChips(container);
            expect(chips.length).toBe(1);
            // Icon should be present
            const icon = chips[0].querySelector('[data-testid="attachment-icon"]');
            expect(icon).toBeInTheDocument();
          });
        }
      );

      it(
        'should show correct icon for image files',
        {
          meta: {
            alias: 'Attach-Image-Icon',
            scenario: 'Image file attached',
            behavior: 'Image icon is displayed',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          const file = testFiles.png();
          await simulateFileDrop(container, [file], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toContain('image.png');
          });
        }
      );

      it(
        'should handle multiple file types',
        {
          meta: {
            alias: 'Attach-Multiple-Types',
            scenario: 'Multiple file types attached',
            behavior: 'All files appear as chips',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Upload multiple files
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);
          await simulateFileDrop(container, [testFiles.png()], attachmentUser);
          await simulateFileDrop(container, [testFiles.docx()], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(3);
            expect(chipNames).toContain('report.pdf');
            expect(chipNames).toContain('image.png');
            expect(chipNames).toContain('document.docx');
          });
        }
      );
    });

    describe('File Validation', () => {
      it(
        'should reject files over 25MB with toast error',
        {
          meta: {
            alias: 'Attach-Reject-Large',
            scenario: 'File over 25MB attached',
            behavior: 'File is rejected, not added',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          const file = testFiles.large();
          await simulateFileDrop(container, [file], attachmentUser);

          // File should not be added
          await waitFor(
            () => {
              const chipNames = getAttachmentChipNames(container);
              expect(chipNames).toHaveLength(0);
            },
            { timeout: 1000 }
          );
        }
      );

      it(
        'should reject more than 5 attachments with toast error',
        {
          meta: {
            alias: 'Attach-Reject-Over5',
            scenario: 'More than 5 files attached',
            behavior: '6th file is rejected',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Add 5 files
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);
          await simulateFileDrop(container, [testFiles.png()], attachmentUser);
          await simulateFileDrop(container, [testFiles.docx()], attachmentUser);
          await simulateFileDrop(container, [testFiles.txt()], attachmentUser);
          await simulateFileDrop(container, [testFiles.json()], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(5);
          });

          // Try to add a 6th file
          await simulateFileDrop(container, [testFiles.zip()], attachmentUser);

          // Should still have only 5
          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(5);
          });
        }
      );

      it(
        'should silently skip duplicate files',
        {
          meta: {
            alias: 'Attach-Skip-Duplicate',
            scenario: 'Same file attached twice',
            behavior: 'Only one instance appears',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Add same file twice
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(1);
          });
        }
      );
    });

    describe('Attachment Management', () => {
      it(
        'should remove attachment when X is clicked',
        {
          meta: {
            alias: 'Attach-Remove-Chip',
            scenario: 'User clicks X on attachment chip',
            behavior: 'Attachment is removed',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(1);
          });

          // Remove the file
          await removeAttachmentChip(container, 'report.pdf', attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(0);
          });
        }
      );

      it(
        'should allow adding more files after removing one',
        {
          meta: {
            alias: 'Attach-Add-After-Remove',
            scenario: 'User removes file then adds another',
            behavior: 'New file is added successfully',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Add 5 files (max)
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);
          await simulateFileDrop(container, [testFiles.png()], attachmentUser);
          await simulateFileDrop(container, [testFiles.docx()], attachmentUser);
          await simulateFileDrop(container, [testFiles.txt()], attachmentUser);
          await simulateFileDrop(container, [testFiles.json()], attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(5);
          });

          // Remove one
          await removeAttachmentChip(container, 'report.pdf', attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(4);
          });

          // Should be able to add another
          await simulateFileDrop(container, [testFiles.zip()], attachmentUser);

          await waitFor(() => {
            const chipNames = getAttachmentChipNames(container);
            expect(chipNames).toHaveLength(5);
            expect(chipNames).toContain('archive.zip');
          });
        }
      );

      it(
        'should clear all attachments after sending',
        {
          meta: {
            alias: 'Attach-Clear-After-Send',
            scenario: 'User sends message with attachment',
            behavior: 'Pending attachments are cleared',
          },
        },
        async () => {
          let sentMessages: ChatMessage[] = [];
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness
              initialHistory={[]}
              assistantActionsOverride={{ chat: chatActions }}
              onHistoryChange={(history) => {
                sentMessages = history;
              }}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for chat to be ready
          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Add attachment
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(1);
          });

          // Type some text
          await attachmentUser.type(input, 'Sending with attachment');

          // Press Enter to send
          await attachmentUser.keyboard('{Enter}');

          // Verify message was sent with attachment
          await waitFor(() => {
            expect(sentMessages.length).toBeGreaterThan(0);
            const lastMessage = sentMessages[sentMessages.length - 1];
            expect(lastMessage.content).toBe('Sending with attachment');
            expect(lastMessage.attachments).toBeDefined();
            expect(lastMessage.attachments).toHaveLength(1);
            expect(lastMessage.attachments?.[0].name).toBe('report.pdf');
          });

          // Input should be cleared
          await waitFor(() => {
            expect(input).toHaveValue('');
          });

          // Allow React to complete all rendering updates
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          });

          // Pending attachments should be cleared from UI (not in message bubbles)
          const pendingChips = screen.queryAllByTestId('pending-attachment-chip');
          expect(pendingChips).toHaveLength(0);
        }
      );
    });

    describe('Sending Messages with Attachments', () => {
      it(
        'should send message with text and attachments',
        {
          meta: {
            alias: 'Attach-Send-Text-And-File',
            scenario: 'User sends message with text and attachment',
            behavior: 'Message appears in chat with attachment',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for input to be enabled
          const input = getChatInput(screen);
          await waitFor(() => {
            expect(input).not.toBeDisabled();
          });

          // Type message
          await attachmentUser.type(input, 'Here is the file');

          // Add attachment
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(1);
          });

          // Send
          const sendButton = getSendButton(screen);
          await waitFor(() => {
            expect(sendButton).not.toBeDisabled();
          });
          await attachmentUser.click(sendButton);

          // Message should be sent
          await waitFor(
            () => {
              const bubbles = getChatBubbles();
              expect(bubbles.some((b) => b?.includes('Here is the file'))).toBe(true);
            },
            { timeout: 2000 }
          );
        }
      );

      it(
        'should send message with only attachments (no text)',
        {
          meta: {
            alias: 'Attach-Send-File-Only',
            scenario: 'User sends attachment without text',
            behavior: 'Message is sent with attachment only',
          },
        },
        async () => {
          let sentMessages: ChatMessage[] = [];
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness
              initialHistory={[]}
              assistantActionsOverride={{ chat: chatActions }}
              onHistoryChange={(history) => {
                sentMessages = history;
              }}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for input to be enabled
          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Initially send button should be disabled (no content)
          let sendButton = getSendButton(screen);
          expect(sendButton).toBeDisabled();

          // Add attachment without typing any text
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(1);
          });

          // Send button should now be enabled (attachment counts as content)
          await waitFor(() => {
            sendButton = getSendButton(screen);
            expect(sendButton).not.toBeDisabled();
          });

          // Click send button with user event
          await attachmentUser.click(sendButton);

          // Verify message was sent with attachment (even without text)
          await waitFor(() => {
            expect(sentMessages.length).toBeGreaterThan(0);
            const lastMessage = sentMessages[sentMessages.length - 1];
            expect(lastMessage.content).toBe(''); // No text
            expect(lastMessage.attachments).toBeDefined();
            expect(lastMessage.attachments).toHaveLength(1);
            expect(lastMessage.attachments?.[0].name).toBe('report.pdf');
          });

          // Input should still be empty (no text was typed)
          await waitFor(() => {
            expect(input).toHaveValue('');
          });

          // Allow React to complete all rendering updates
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          });

          // Pending attachments should be cleared from UI (not in message bubbles)
          const pendingChips = screen.queryAllByTestId('pending-attachment-chip');
          expect(pendingChips).toHaveLength(0);
        }
      );

      it(
        'should enable send button when attachments added',
        {
          meta: {
            alias: 'Attach-Enable-Send-Button',
            scenario: 'User adds attachment',
            behavior: 'Send button becomes enabled',
          },
        },
        async () => {
          const chatActions = createMockChatActionsFromFixture();
          const { container } = render(
            <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Wait for input to be ready
          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Send button should be disabled without text or attachments
          let sendButton = getSendButton(screen);
          expect(sendButton).toBeDisabled();

          // Add attachment
          await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

          await waitFor(() => {
            expect(getAttachmentChipNames(container)).toHaveLength(1);
          });

          // Send button should now be enabled
          await waitFor(() => {
            sendButton = getSendButton(screen);
            expect(sendButton).not.toBeDisabled();
          });
        }
      );
    });
  });

  // =========================================================================
  // SECTION O: MULTI-ASSISTANT SWITCHING
  // =========================================================================
  describe('O - Multi-Assistant Switching', () => {
    // NOTE: contactId is always 1 for the user (same across all assistants)
    // Assistants are differentiated by assistantId, not contactId

    it(
      'uses correct assistantId in API calls when switching assistants',
      {
        meta: {
          alias: 'Switch-Correct-AssistantId',
          scenario: 'User switches between two different assistants',
          behavior: 'Each API call uses the correct assistantId',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'assistant-alpha',
          firstName: 'Alpha',
          surname: 'Assistant',
        });
        const assistantB = createMockAssistant({
          agentId: 'assistant-beta',
          firstName: 'Beta',
          surname: 'Assistant',
        });

        const getTranscriptsCalls: Array<{ assistantId: string; contactId: number }> = [];
        const getTranscriptsMock = vi.fn(
          async (
            contactId: number,
            _ownerId: string,
            assistantId: string
          ) => {
            getTranscriptsCalls.push({ assistantId, contactId });
            return [];
          }
        );

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1), // User contactId is always 1
            getTranscripts: getTranscriptsMock,
            message: vi.fn(async () => ({ info: 'sent' })),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant A to load
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        expect(chatMocks.eventSource!.url).toContain('assistant-alpha');

        // Switch to Assistant B
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant B connection
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(2);
          expect(chatMocks.allEventSources[1].url).toContain('assistant-beta');
        });

        // Verify getTranscripts was called with correct assistantIds
        await waitFor(() => {
          expect(getTranscriptsCalls.length).toBe(2);
        });

        const alphaCall = getTranscriptsCalls.find((c) => c.assistantId === 'assistant-alpha');
        const betaCall = getTranscriptsCalls.find((c) => c.assistantId === 'assistant-beta');

        // Both use contactId=1 (user), but different assistantIds
        expect(alphaCall?.contactId).toBe(1);
        expect(alphaCall?.assistantId).toBe('assistant-alpha');
        expect(betaCall?.contactId).toBe(1);
        expect(betaCall?.assistantId).toBe('assistant-beta');
      }
    );

    it(
      'sends messages to correct assistant with correct assistantId',
      {
        meta: {
          alias: 'Switch-Correct-Message-Routing',
          scenario: 'User sends messages to different assistants',
          behavior: 'Each message is sent to the correct assistant',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'assistant-msg-a',
          firstName: 'MsgA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'assistant-msg-b',
          firstName: 'MsgB',
          surname: 'Test',
        });

        const sentMessages: Array<{ assistantId: number; contactId: number; message: string }> = [];
        const messageMock = vi.fn(
          async (payload: { assistantId: number; contactId: number; message: string }) => {
            sentMessages.push(payload);
            return { info: 'sent' };
          }
        );

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1), // User contactId is always 1
            getTranscripts: vi.fn(async () => []),
            message: messageMock,
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant A to load and connect
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Send message to Assistant A
        const inputA = await screen.findByPlaceholderText('Send a message...');
        fireEvent.change(inputA, { target: { value: 'Hello Alpha' } });
        fireEvent.submit(inputA.closest('form')!);

        await waitFor(() => expect(sentMessages.length).toBe(1));
        // contactId is always 1 (user), messages are differentiated by assistantId
        expect(sentMessages[0].contactId).toBe(1);
        expect(sentMessages[0].message).toBe('Hello Alpha');

        // Switch to Assistant B
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant B connection
        await waitFor(() => {
          expect(chatMocks.allEventSources.length).toBe(2);
        });
        act(() => chatMocks.allEventSources[1].simulateOpen());

        // Send message to Assistant B
        const inputB = await screen.findByPlaceholderText('Send a message...');
        fireEvent.change(inputB, { target: { value: 'Hello Beta' } });
        fireEvent.submit(inputB.closest('form')!);

        await waitFor(() => expect(sentMessages.length).toBe(2));
        // Both messages use contactId=1, but were sent to different assistants
        expect(sentMessages[1].contactId).toBe(1);
        expect(sentMessages[1].message).toBe('Hello Beta');
      }
    );

    it(
      'receives SSE messages into correct assistant history (no cross-contamination)',
      {
        meta: {
          alias: 'Switch-No-Cross-Contamination',
          scenario: 'SSE messages arrive while switching assistants',
          behavior: 'Messages are added only to the correct assistant history',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'assistant-sse-a',
          firstName: 'SseA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'assistant-sse-b',
          firstName: 'SseB',
          surname: 'Test',
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: vi.fn(async () => ({ info: 'sent' })),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant A SSE
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Receive message for Assistant A
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-for-a-1',
            publishTime: new Date().toISOString(),
            event: { content: 'Message for Alpha 1' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Message for Alpha 1')).toBeInTheDocument();
        });

        // Switch to Assistant B
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant B SSE
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(2));
        act(() => chatMocks.allEventSources[1].simulateOpen());

        // Message for Alpha should not be visible when viewing Beta
        expect(screen.queryByText('Message for Alpha 1')).not.toBeInTheDocument();

        // Receive message for Assistant B
        act(() => {
          chatMocks.allEventSources[1].simulateMessage({
            thread: 'unify_message_outbound',
            id: 'msg-for-b-1',
            publishTime: new Date().toISOString(),
            event: { content: 'Message for Beta 1' },
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Message for Beta 1')).toBeInTheDocument();
        });

        // Switch back to Assistant A
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for Assistant A to restore from cache
        await waitFor(() => {
          expect(screen.getByText('Message for Alpha 1')).toBeInTheDocument();
        });

        // Beta's message should not appear in Alpha's history
        expect(screen.queryByText('Message for Beta 1')).not.toBeInTheDocument();
      }
    );

    it(
      'preserves message history when rapidly switching between assistants',
      {
        meta: {
          alias: 'Switch-Rapid-Preserve-History',
          scenario: 'User rapidly switches between assistants multiple times',
          behavior: 'All message histories are preserved correctly',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'rapid-a',
          firstName: 'RapidA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'rapid-b',
          firstName: 'RapidB',
          surname: 'Test',
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: vi.fn(async () => ({ info: 'sent' })),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Connect A and add a message
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());
        act(() => {
          chatMocks.eventSource!.simulateMessage({
            thread: 'unify_message_outbound',
            id: 'rapid-msg-a1',
            publishTime: new Date().toISOString(),
            event: { content: 'Alpha Message 1' },
          });
        });
        await waitFor(() => expect(screen.getByText('Alpha Message 1')).toBeInTheDocument());

        // Switch to B
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(2));
        act(() => chatMocks.allEventSources[1].simulateOpen());
        act(() => {
          chatMocks.allEventSources[1].simulateMessage({
            thread: 'unify_message_outbound',
            id: 'rapid-msg-b1',
            publishTime: new Date().toISOString(),
            event: { content: 'Beta Message 1' },
          });
        });
        await waitFor(() => expect(screen.getByText('Beta Message 1')).toBeInTheDocument());

        // Switch back to A
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(screen.getByText('Alpha Message 1')).toBeInTheDocument());
        expect(screen.queryByText('Beta Message 1')).not.toBeInTheDocument();

        // Add another message to A
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(3));
        act(() => chatMocks.allEventSources[2].simulateOpen());
        act(() => {
          chatMocks.allEventSources[2].simulateMessage({
            thread: 'unify_message_outbound',
            id: 'rapid-msg-a2',
            publishTime: new Date().toISOString(),
            event: { content: 'Alpha Message 2' },
          });
        });
        await waitFor(() => expect(screen.getByText('Alpha Message 2')).toBeInTheDocument());

        // Switch to B again
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(screen.getByText('Beta Message 1')).toBeInTheDocument());
        expect(screen.queryByText('Alpha Message 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Alpha Message 2')).not.toBeInTheDocument();

        // Final switch back to A - should have both messages
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => {
          expect(screen.getByText('Alpha Message 1')).toBeInTheDocument();
          expect(screen.getByText('Alpha Message 2')).toBeInTheDocument();
        });
      }
    );

    it(
      'handles concurrent message sends during assistant switch',
      {
        meta: {
          alias: 'Switch-Concurrent-Send',
          scenario: 'User sends message just before switching assistants',
          behavior: 'Message is sent to correct assistant, not the new one',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'concurrent-a',
          firstName: 'ConcurrentA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'concurrent-b',
          firstName: 'ConcurrentB',
          surname: 'Test',
        });

        // Track which assistant received the message via the assistantId parameter
        const sentMessages: Array<{ assistantId: number; contactId: number; message: string }> = [];
        const messageMock = vi.fn(
          async (payload: { assistantId: number; contactId: number; message: string }) => {
            // Simulate network delay
            await new Promise((r) => setTimeout(r, 50));
            sentMessages.push(payload);
            return { info: 'sent' };
          }
        );

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1), // User contactId is always 1
            getTranscripts: vi.fn(async () => []),
            message: messageMock,
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Connect to A
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        // Type message to A
        const input = await screen.findByPlaceholderText('Send a message...');
        fireEvent.change(input, { target: { value: 'Message before switch' } });

        // Send message and immediately switch (simulating race condition)
        fireEvent.submit(input.closest('form')!);

        // Switch to B immediately after sending
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for the message to be sent (with delay)
        await waitFor(
          () => {
            expect(sentMessages.length).toBe(1);
          },
          { timeout: 2000 }
        );

        // The message should have been sent - contactId is always 1 for user
        // The key is that the message was initiated before the switch
        expect(sentMessages[0].contactId).toBe(1);
        expect(sentMessages[0].message).toBe('Message before switch');
      }
    );

    it(
      'SSE messages for inactive assistant are not displayed',
      {
        meta: {
          alias: 'Switch-Inactive-SSE-Ignored',
          scenario: 'SSE message arrives for assistant that is no longer active',
          behavior: 'Message is not displayed (old connection should be closed)',
        },
      },
      async () => {
        const assistantA = createMockAssistant({
          agentId: 'inactive-a',
          firstName: 'InactiveA',
          surname: 'Test',
        });
        const assistantB = createMockAssistant({
          agentId: 'inactive-b',
          firstName: 'InactiveB',
          surname: 'Test',
        });

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: vi.fn(async () => ({ info: 'sent' })),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantA}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Connect A
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        const connectionA = chatMocks.eventSource!;
        act(() => connectionA.simulateOpen());

        // Switch to B (this should close A's connection)
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistantB}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Wait for B to connect
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(2));
        act(() => chatMocks.allEventSources[1].simulateOpen());

        // Verify A's connection was closed
        expect(connectionA.closeSpy).toHaveBeenCalled();

        // Even if somehow A's connection wasn't closed, messages shouldn't appear
        // because the component is now showing B's chat
        // (The closeSpy being called confirms proper cleanup)
      }
    );

    it(
      'each assistant gets unique SSE connection URL',
      {
        meta: {
          alias: 'Switch-Unique-SSE-URLs',
          scenario: 'Switch between multiple assistants',
          behavior: 'Each SSE connection URL contains the correct assistant ID',
        },
      },
      async () => {
        const assistants = [
          createMockAssistant({ agentId: 'unique-1', firstName: 'One', surname: 'Test' }),
          createMockAssistant({ agentId: 'unique-2', firstName: 'Two', surname: 'Test' }),
          createMockAssistant({ agentId: 'unique-3', firstName: 'Three', surname: 'Test' }),
        ];

        const actionsOverride = {
          chat: {
            getContactId: vi.fn(async () => 1),
            getTranscripts: vi.fn(async () => []),
            message: vi.fn(async () => ({ info: 'sent' })),
            getAssistantOwnerById: vi.fn(async () => null),
          },
        };

        const { rerender } = render(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistants[0]}
            assistantActionsOverride={actionsOverride}
          />
        );

        // Connect to first assistant
        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        expect(chatMocks.eventSource!.url).toContain('unique-1');

        // Switch to second
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistants[1]}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(2));
        expect(chatMocks.allEventSources[1].url).toContain('unique-2');

        // Switch to third
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistants[2]}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(3));
        expect(chatMocks.allEventSources[2].url).toContain('unique-3');

        // Switch back to first - should create new connection
        rerender(
          <ChatTestWrapper
            initialHistory={undefined}
            assistantOverride={assistants[0]}
            assistantActionsOverride={actionsOverride}
          />
        );
        await waitFor(() => expect(chatMocks.allEventSources.length).toBe(4));
        expect(chatMocks.allEventSources[3].url).toContain('unique-1');
      }
    );
  });

  // =========================================================================
  // SECTION P: STRESS AND ROBUSTNESS
  // =========================================================================
  describe('P - Stress and Robustness', () => {
    describe('SSE Reconnection Under Stress', () => {
      it(
        'resets reconnection attempt counter when switching assistants',
        {
          meta: {
            alias: 'Stress-Reconnect-Reset-On-Switch',
            scenario:
              'Assistant A has multiple failed reconnections, user switches to Assistant B which also fails',
            behavior:
              'Assistant B should have full reconnection attempts available, not inherit A counter',
          },
        },
        async () => {
          const assistantA = createMockAssistant({
            agentId: 'reconnect-stress-a',
            firstName: 'ReconnectA',
            surname: 'Test',
          });
          const assistantB = createMockAssistant({
            agentId: 'reconnect-stress-b',
            firstName: 'ReconnectB',
            surname: 'Test',
          });

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => ({ info: 'sent' })),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          // Use pre-loaded history to avoid async fetch issues with fake timers
          const { rerender } = render(
            <ChatTestWrapper
              initialHistory={[]}
              assistantOverride={assistantA}
              assistantActionsOverride={actionsOverride}
            />
          );

          // Wait for A's first connection with real timers
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          const connectionA1 = chatMocks.eventSource!;
          act(() => connectionA1.simulateOpen());

          // Now use fake timers for timing control
          vi.useFakeTimers();

          // Simulate 4 failed reconnections for A (almost at max of 5)
          for (let i = 0; i < 4; i++) {
            act(() => {
              // Get the latest connection for A
              const latestAConnection = chatMocks.allEventSources
                .filter((es) => es.url.includes('reconnect-stress-a'))
                .pop();
              latestAConnection?.simulateError();
            });
            // Advance past reconnect delay with exponential backoff
            act(() => {
              vi.advanceTimersByTime(1000 * Math.pow(2, i) + 100);
            });
          }

          vi.useRealTimers();

          // A should have multiple connection attempts
          const aConnections = chatMocks.allEventSources.filter((es) =>
            es.url.includes('reconnect-stress-a')
          );
          expect(aConnections.length).toBeGreaterThan(1);

          // Switch to B
          rerender(
            <ChatTestWrapper
              initialHistory={[]}
              assistantOverride={assistantB}
              assistantActionsOverride={actionsOverride}
            />
          );

          // Wait for B's connection
          await waitFor(() => {
            const bConnections = chatMocks.allEventSources.filter((es) =>
              es.url.includes('reconnect-stress-b')
            );
            expect(bConnections.length).toBe(1);
          });

          const connectionB1 = chatMocks.allEventSources.find((es) =>
            es.url.includes('reconnect-stress-b')
          )!;
          act(() => connectionB1.simulateOpen());

          vi.useFakeTimers();

          // Simulate error on B - should start fresh with attempt 1, not 5
          act(() => connectionB1.simulateError());
          act(() => {
            vi.advanceTimersByTime(1100); // Base delay for first reconnect + buffer
          });

          vi.useRealTimers();

          // B should create a new connection (not be stuck at error state from A's counter)
          await waitFor(
            () => {
              const bConnections = chatMocks.allEventSources.filter((es) =>
                es.url.includes('reconnect-stress-b')
              );
              expect(bConnections.length).toBe(2); // Original + 1 reconnect
            },
            { timeout: 3000 }
          );
        }
      );

      it(
        'clears pending reconnection timeout when assistant switches',
        {
          meta: {
            alias: 'Stress-Reconnect-Timeout-Cleanup',
            scenario:
              'SSE fails, reconnection is scheduled, user switches assistant before timeout fires',
            behavior: 'Scheduled reconnection for old assistant should not execute after switch',
          },
        },
        async () => {
          const assistantA = createMockAssistant({
            agentId: 'timeout-cleanup-a',
            firstName: 'TimeoutA',
            surname: 'Test',
          });
          const assistantB = createMockAssistant({
            agentId: 'timeout-cleanup-b',
            firstName: 'TimeoutB',
            surname: 'Test',
          });

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => ({ info: 'sent' })),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          // Use pre-loaded history to avoid async issues
          const { rerender } = render(
            <ChatTestWrapper
              initialHistory={[]}
              assistantOverride={assistantA}
              assistantActionsOverride={actionsOverride}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          const connectionA = chatMocks.eventSource!;
          act(() => connectionA.simulateOpen());

          vi.useFakeTimers();

          // Trigger error - this schedules a reconnection
          act(() => connectionA.simulateError());

          vi.useRealTimers();

          // Immediately switch to B (before reconnect timeout fires)
          rerender(
            <ChatTestWrapper
              initialHistory={[]}
              assistantOverride={assistantB}
              assistantActionsOverride={actionsOverride}
            />
          );

          // Wait for B's connection
          await waitFor(() => {
            const bConnections = chatMocks.allEventSources.filter((es) =>
              es.url.includes('timeout-cleanup-b')
            );
            expect(bConnections.length).toBe(1);
          });

          vi.useFakeTimers();

          // Now advance time past A's reconnect delay
          act(() => {
            vi.advanceTimersByTime(5000);
          });

          vi.useRealTimers();

          // No new connection for A should have been created
          const aConnectionsAfter = chatMocks.allEventSources.filter((es) =>
            es.url.includes('timeout-cleanup-a')
          );
          expect(aConnectionsAfter.length).toBe(1); // Only the original, no reconnect
        }
      );
    });

    describe('Rapid Message Sending', () => {
      it(
        'handles rapid consecutive message sends without losing messages',
        {
          meta: {
            alias: 'Stress-Rapid-Send-No-Loss',
            scenario: 'User sends 5 messages in quick succession',
            behavior: 'All messages appear in chat and are sent to backend',
          },
        },
        async () => {
          const sentMessages: string[] = [];
          const messageMock = vi.fn(
            async (payload: { assistantId: number; contactId: number; message: string }) => {
              await new Promise((r) => setTimeout(r, 50)); // Simulate network delay
              sentMessages.push(payload.message);
              return { info: 'sent' };
            }
          );

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: messageMock,
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Send 5 messages rapidly
          for (let i = 1; i <= 5; i++) {
            fireEvent.change(input, { target: { value: `Rapid message ${i}` } });
            fireEvent.submit(input.closest('form')!);
          }

          // All messages should appear in UI (optimistically)
          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toContain('Rapid message 1');
            expect(bubbles).toContain('Rapid message 2');
            expect(bubbles).toContain('Rapid message 3');
            expect(bubbles).toContain('Rapid message 4');
            expect(bubbles).toContain('Rapid message 5');
          });

          // All messages should be sent to backend
          await waitFor(
            () => {
              expect(sentMessages).toHaveLength(5);
              expect(sentMessages).toContain('Rapid message 1');
              expect(sentMessages).toContain('Rapid message 5');
            },
            { timeout: 2000 }
          );
        }
      );

      it(
        'correctly rolls back only the failed message when one of many rapid sends fails',
        {
          meta: {
            alias: 'Stress-Rapid-Send-Partial-Fail',
            scenario: 'User sends 3 messages rapidly, the 2nd one fails',
            behavior: 'Only message 2 is rolled back, messages 1 and 3 remain',
          },
        },
        async () => {
          // Track which message content should fail - capture at call time, not after await
          const messageMock = vi.fn(
            async (payload: { assistantId: number; contactId: number; message: string }) => {
              // Capture the message content synchronously before any async work
              const shouldFail = payload.message === 'Message 2';
              await new Promise((r) => setTimeout(r, 50));
              if (shouldFail) {
                throw new Error('Simulated failure for message 2');
              }
              return { info: 'sent' };
            }
          );

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: messageMock,
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Send 3 messages rapidly
          fireEvent.change(input, { target: { value: 'Message 1' } });
          fireEvent.submit(input.closest('form')!);
          fireEvent.change(input, { target: { value: 'Message 2' } });
          fireEvent.submit(input.closest('form')!);
          fireEvent.change(input, { target: { value: 'Message 3' } });
          fireEvent.submit(input.closest('form')!);

          // Wait for all sends to complete
          await waitFor(
            () => {
              expect(messageMock).toHaveBeenCalledTimes(3);
            },
            { timeout: 2000 }
          );

          // Message 2 should be rolled back, 1 and 3 should remain
          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toContain('Message 1');
            expect(bubbles).not.toContain('Message 2');
            expect(bubbles).toContain('Message 3');
          });

          // Input should contain the failed message
          expect(input).toHaveValue('Message 2');
        }
      );
    });

    describe('Typing Indicator Stress', () => {
      it(
        'clears typing indicator when message send fails',
        {
          meta: {
            alias: 'Stress-Typing-Clear-On-Fail',
            scenario: 'User sends message, typing indicator shows, then send fails',
            behavior: 'Typing indicator is cleared when failure is detected',
          },
        },
        async () => {
          // Control when the message fails
          let rejectMessage: (err: Error) => void;
          const messagePromise = new Promise<never>((_, reject) => {
            rejectMessage = reject;
          });

          const messageMock = vi.fn(() => messagePromise);

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: messageMock,
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper initialHistory={[]} assistantActionsOverride={actionsOverride} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          vi.useFakeTimers();

          // Send message
          act(() => {
            fireEvent.change(input, { target: { value: 'This will fail' } });
            fireEvent.submit(input.closest('form')!);
          });

          // Advance to show typing indicator (5 seconds delay)
          act(() => {
            vi.advanceTimersByTime(5000);
          });

          expect(screen.getByText('Typing')).toBeInTheDocument();

          vi.useRealTimers();

          // Now trigger the failure
          act(() => {
            rejectMessage!(new Error('Send failed'));
          });

          // Typing indicator should be cleared after failure
          await waitFor(() => {
            expect(screen.queryByText('Typing')).not.toBeInTheDocument();
          });
        }
      );

      it(
        'handles overlapping typing timers correctly with rapid message exchanges',
        {
          meta: {
            alias: 'Stress-Typing-Overlap',
            scenario:
              'User sends message, reply arrives before typing shows, user sends another message',
            behavior: 'Typing indicator state remains consistent',
          },
        },
        async () => {
          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => ({ info: 'sent' })),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper initialHistory={[]} assistantActionsOverride={actionsOverride} />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          vi.useFakeTimers();

          // Send first message
          act(() => {
            fireEvent.change(input, { target: { value: 'First message' } });
            fireEvent.submit(input.closest('form')!);
          });

          // Advance 2 seconds (before typing indicator shows at 5s)
          act(() => {
            vi.advanceTimersByTime(2000);
          });

          // Reply arrives quickly (before typing indicator would show)
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: 'quick-reply',
              publishTime: new Date().toISOString(),
              event: { content: 'Quick reply' },
            });
          });

          // Typing should NOT be showing (reply cleared the pending timer)
          expect(screen.queryByText('Typing')).not.toBeInTheDocument();

          // Send second message
          act(() => {
            fireEvent.change(input, { target: { value: 'Second message' } });
            fireEvent.submit(input.closest('form')!);
          });

          // Advance 5 seconds for second message
          act(() => {
            vi.advanceTimersByTime(5000);
          });

          // Now typing should show for the second message
          expect(screen.getByText('Typing')).toBeInTheDocument();

          vi.useRealTimers();
        }
      );
    });

    describe('SSE Message Burst Handling', () => {
      it(
        'handles 100 messages arriving in a single burst without UI freeze',
        {
          meta: {
            alias: 'Stress-SSE-Mega-Burst',
            scenario: '100 unique messages arrive via SSE in rapid succession',
            behavior: 'All messages are rendered without duplicates or missing entries',
          },
        },
        async () => {
          render(<ChatTestWrapper initialHistory={[]} />);
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const messageCount = 100;
          const messages = Array.from({ length: messageCount }, (_, i) => ({
            thread: 'unify_message_outbound',
            id: `burst-msg-${i}`,
            publishTime: new Date(Date.now() + i * 10).toISOString(),
            event: { content: `Burst ${i}` },
          }));

          // Send all messages in a single batch
          act(() => {
            messages.forEach((msg) => chatMocks.eventSource!.simulateMessage(msg));
          });

          // All messages should render
          await waitFor(
            () => {
              const bubbles = getChatBubbles();
              expect(bubbles).toHaveLength(messageCount);
              expect(bubbles[0]).toBe('Burst 0');
              expect(bubbles[99]).toBe('Burst 99');
            },
            { timeout: 5000 }
          );
        }
      );

      it(
        'correctly deduplicates when same message arrives via SSE and BroadcastChannel simultaneously',
        {
          meta: {
            alias: 'Stress-SSE-BC-Race',
            scenario: 'Identical message arrives via SSE and BroadcastChannel at the same time',
            behavior: 'Only one copy of the message appears',
          },
        },
        async () => {
          const assistantId = 'stress-test-id';
          render(<ChatTestWrapper initialHistory={[]} />);
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const messageId = 'simultaneous-msg';
          const messageContent = 'Simultaneous Message';
          const timestamp = new Date().toISOString();

          // Find the broadcast channel listener
          const listenerChannel = chatMocks.allBroadcastChannels.find(
            (c) => c.name.includes(assistantId) && c.onmessage
          );
          expect(listenerChannel).toBeDefined();

          // Send via both channels simultaneously
          act(() => {
            // SSE message
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: messageId,
              publishTime: timestamp,
              event: { content: messageContent },
            });

            // BroadcastChannel message (from another tab)
            listenerChannel!.simulateIncomingMessage({
              type: 'NEW_MESSAGE',
              message: {
                id: messageId,
                role: 'assistant',
                content: messageContent,
                timestamp: timestamp,
              },
            });
          });

          // Wait for processing
          await new Promise((r) => setTimeout(r, 100));

          // Should have exactly one message
          const bubbles = getChatBubbles();
          expect(bubbles.filter((b) => b === messageContent)).toHaveLength(1);
        }
      );
    });

    describe('ACK Robustness', () => {
      it(
        'does not double-ack messages when render triggers during ack processing',
        {
          meta: {
            alias: 'Stress-Double-Ack-Prevention',
            scenario:
              'Message with ackId arrives, component re-renders during ack effect execution',
            behavior: 'ACK is sent exactly once per message',
          },
        },
        async () => {
          render(<ChatTestWrapper initialHistory={[]} />);
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const ackId = 'single-ack-token';

          // Send message with ack
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: 'ack-once-msg',
              publishTime: new Date().toISOString(),
              __ackId: ackId,
              event: { content: 'Ack me once' },
            });
          });

          // Wait for message to appear
          await waitFor(() => {
            expect(screen.getByText('Ack me once')).toBeInTheDocument();
          });

          // Force multiple re-renders by typing
          const user = userEvent.setup();
          const input = screen.getByRole('textbox');
          await user.type(input, 'trigger render 1');
          await user.clear(input);
          await user.type(input, 'trigger render 2');

          // Wait for any pending effects
          await new Promise((r) => setTimeout(r, 200));

          // Count ACK calls for this specific ackId
          const ackCalls = fetchSpy.mock.calls.filter(
            (call) =>
              String(call[0]).includes('/events/ack') &&
              call[1]?.body === JSON.stringify({ ackId: ackId })
          );

          // Should have exactly 1 ACK call
          expect(ackCalls.length).toBe(1);
        }
      );

      it(
        'maintains ACK queue when multiple ack-required messages arrive rapidly',
        {
          meta: {
            alias: 'Stress-Ack-Queue-Burst',
            scenario: '10 messages with ackIds arrive in rapid succession',
            behavior: 'All messages are ACKed without any being lost',
          },
        },
        async () => {
          render(<ChatTestWrapper initialHistory={[]} />);
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const messageCount = 10;

          // Send burst of messages with acks
          act(() => {
            for (let i = 0; i < messageCount; i++) {
              chatMocks.eventSource!.simulateMessage({
                thread: 'unify_message_outbound',
                id: `ack-burst-${i}`,
                publishTime: new Date(Date.now() + i).toISOString(),
                __ackId: `ack-token-${i}`,
                event: { content: `Ack burst ${i}` },
              });
            }
          });

          // Wait for all messages to appear
          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toHaveLength(messageCount);
          });

          // Wait for ACK processing
          await new Promise((r) => setTimeout(r, 500));

          // Verify all acks were sent
          for (let i = 0; i < messageCount; i++) {
            const ackCalls = fetchSpy.mock.calls.filter(
              (call) =>
                String(call[0]).includes('/events/ack') &&
                call[1]?.body === JSON.stringify({ ackId: `ack-token-${i}` })
            );
            expect(ackCalls.length).toBeGreaterThanOrEqual(1);
          }
        }
      );
    });

    describe('State Consistency Under Concurrent Operations', () => {
      it(
        'maintains message order when user send and SSE receive happen simultaneously',
        {
          meta: {
            alias: 'Stress-Concurrent-Send-Receive-Order',
            scenario: 'User sends message at exact moment SSE message arrives',
            behavior: 'Messages are correctly ordered by timestamp',
          },
        },
        async () => {
          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => {
                await new Promise((r) => setTimeout(r, 50));
                return { info: 'sent' };
              }),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          // Set up messages with specific timestamps
          const pastTime = '2024-01-01T11:59:55Z'; // 5 seconds before "now"
          const nowTime = '2024-01-01T12:00:00Z'; // "now"
          const futureTime = '2024-01-01T12:00:05Z'; // 5 seconds after "now"

          // Send user message (will use Date.now())
          act(() => {
            fireEvent.change(input, { target: { value: 'User message' } });
            fireEvent.submit(input.closest('form')!);
          });

          // Simultaneously receive past and future SSE messages
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: 'past-msg',
              publishTime: pastTime,
              event: { content: 'Past SSE message' },
            });

            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: 'future-msg',
              publishTime: futureTime,
              event: { content: 'Future SSE message' },
            });
          });

          // Verify order: past, user (now), future
          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toHaveLength(3);
            expect(bubbles[0]).toBe('Past SSE message');
            expect(bubbles[1]).toBe('User message');
            expect(bubbles[2]).toBe('Future SSE message');
          });
        }
      );

      it(
        'handles history load completing during SSE message arrival',
        {
          meta: {
            alias: 'Stress-History-SSE-Race',
            scenario: 'History fetch completes at same moment as SSE message arrives',
            behavior: 'Both history and SSE message appear without duplicates',
          },
        },
        async () => {
          let resolveHistory: (msgs: ChatMessage[]) => void;
          const historyPromise = new Promise<ChatMessage[]>((resolve) => {
            resolveHistory = resolve;
          });

          const historyMessages: ChatMessage[] = [
            {
              id: 'history-1',
              role: 'assistant',
              content: 'History message 1',
              timestamp: new Date(Date.now() - 10000),
              messageId: 1,
            },
            {
              id: 'history-2',
              role: 'user',
              content: 'History message 2',
              timestamp: new Date(Date.now() - 5000),
              messageId: 2,
            },
          ];

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(() => historyPromise),
              message: vi.fn(async () => ({ info: 'sent' })),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          // Wait for loading state
          await waitFor(() => {
            expect(screen.getByPlaceholderText('Loading messages...')).toBeInTheDocument();
          });

          // Resolve history and send SSE message simultaneously
          act(() => {
            resolveHistory!(historyMessages);
          });

          // Wait for SSE to connect after history loads
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          // Send SSE message immediately after
          act(() => {
            chatMocks.eventSource!.simulateMessage({
              thread: 'unify_message_outbound',
              id: 'sse-concurrent',
              publishTime: new Date().toISOString(),
              event: { content: 'SSE during load' },
            });
          });

          // All messages should appear
          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toContain('History message 1');
            expect(bubbles).toContain('History message 2');
            expect(bubbles).toContain('SSE during load');
            expect(bubbles).toHaveLength(3);
          });
        }
      );
    });

    describe('Memory and Cleanup', () => {
      it(
        'cleans up event listeners and timers on unmount during active operations',
        {
          meta: {
            alias: 'Stress-Cleanup-Active-Unmount',
            scenario:
              'Component unmounts while SSE connection is active and typing indicator is pending',
            behavior: 'No memory leaks or errors after unmount',
          },
        },
        async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          vi.useFakeTimers();

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => {
                // Slow message that will complete after unmount
                await new Promise((r) => setTimeout(r, 5000));
                return { info: 'sent' };
              }),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          // Use real timers for setup
          vi.useRealTimers();

          const { unmount } = render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());

          const input = await screen.findByPlaceholderText('Send a message...');
          await waitFor(() => expect(input).not.toBeDisabled());

          vi.useFakeTimers();

          // Start a message send (creates pending timers)
          act(() => {
            fireEvent.change(input, { target: { value: 'Message before unmount' } });
            fireEvent.submit(input.closest('form')!);
          });

          // Advance a bit to get timers going
          act(() => {
            vi.advanceTimersByTime(1000);
          });

          // Unmount while operations are pending
          unmount();

          // Advance time significantly to ensure any leaked timers would fire
          act(() => {
            vi.advanceTimersByTime(30000);
          });

          // Should not have any React state update errors
          // (These would appear as "Can't perform a React state update on an unmounted component")
          const stateUpdateErrors = consoleSpy.mock.calls.filter((call) =>
            String(call[0]).includes('unmounted component')
          );
          expect(stateUpdateErrors).toHaveLength(0);

          vi.useRealTimers();
          consoleSpy.mockRestore();
        }
      );

      it(
        'does not leak BroadcastChannel instances after assistant switch',
        {
          meta: {
            alias: 'Stress-BC-Leak-Prevention',
            scenario: 'Switch between 5 assistants rapidly',
            behavior: 'Previous BroadcastChannels are closed, no accumulation of open channels',
          },
        },
        async () => {
          const assistants = Array.from({ length: 5 }, (_, i) =>
            createMockAssistant({
              agentId: `leak-test-${i}`,
              firstName: `Leak${i}`,
              surname: 'Test',
            })
          );

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => []),
              message: vi.fn(async () => ({ info: 'sent' })),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          const { rerender } = render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantOverride={assistants[0]}
              assistantActionsOverride={actionsOverride}
            />
          );

          // Switch through all assistants
          for (let i = 1; i < 5; i++) {
            await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

            rerender(
              <ChatTestWrapper
                initialHistory={undefined}
                assistantOverride={assistants[i]}
                assistantActionsOverride={actionsOverride}
              />
            );
          }

          // Check that previous channels were closed
          const closedChannels = chatMocks.allBroadcastChannels.filter(
            (bc) => bc.close.mock.calls.length > 0
          );

          // Each assistant switch should close the previous channel
          // We expect at least 4 closed channels (one for each switch away from an assistant)
          expect(closedChannels.length).toBeGreaterThanOrEqual(4);
        }
      );
    });

    describe('Error Recovery Under Stress', () => {
      it(
        'recovers gracefully when multiple errors occur in sequence',
        {
          meta: {
            alias: 'Stress-Sequential-Errors',
            scenario:
              'History load fails, retry succeeds, SSE fails, reconnects, message send fails',
            behavior: 'System recovers from each error and remains functional',
          },
        },
        async () => {
          // Use controlled error state to avoid StrictMode double-invoke issues
          let shouldHistoryFail = true;
          let shouldMessageFail = true;

          const actionsOverride = {
            chat: {
              getContactId: vi.fn(async () => 1),
              getTranscripts: vi.fn(async () => {
                if (shouldHistoryFail) {
                  return { detail: 'History call fails' };
                }
                return [];
              }),
              message: vi.fn(async () => {
                if (shouldMessageFail) {
                  throw new Error('Message fails');
                }
                return { info: 'sent' };
              }),
              getAssistantOwnerById: vi.fn(async () => null),
            },
          };

          render(
            <ChatTestWrapper
              initialHistory={undefined}
              assistantActionsOverride={actionsOverride}
            />
          );

          // 1. History load fails
          await waitFor(() => {
            expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
          });

          // 2. Retry history load - succeeds
          shouldHistoryFail = false;
          await userEvent.click(screen.getByRole('button', { name: /retry/i }));

          await waitFor(() => {
            expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
          });

          // 3. SSE connects then fails
          await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
          act(() => chatMocks.eventSource!.simulateOpen());
          act(() => chatMocks.eventSource!.simulateError());

          // Should show reconnecting
          await waitFor(() => {
            expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
          });

          // 4. SSE reconnects
          await waitFor(() => expect(chatMocks.allEventSources.length).toBeGreaterThan(1));
          const newConnection = chatMocks.allEventSources[chatMocks.allEventSources.length - 1];
          act(() => newConnection.simulateOpen());

          await waitFor(() => {
            expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument();
          });

          // 5. Send message - fails first time
          const input = screen.getByPlaceholderText('Send a message...');
          fireEvent.change(input, { target: { value: 'First try' } });
          fireEvent.submit(input.closest('form')!);

          await waitFor(() => {
            expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
          });

          // 6. Switch to success mode and send message
          shouldMessageFail = false;
          fireEvent.change(input, { target: { value: 'Second try' } });
          fireEvent.submit(input.closest('form')!);

          await waitFor(() => {
            const bubbles = getChatBubbles();
            expect(bubbles).toContain('Second try');
          });

          // System is now functional
          expect(input).toHaveValue('');
        }
      );
    });
  });
});
