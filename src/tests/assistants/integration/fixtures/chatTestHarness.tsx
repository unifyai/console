/**
 * Chat Test Harness
 *
 * Provides reusable test utilities, mocks, and wrapper components
 * for testing chat-related functionality in the Assistant Profile.
 *
 * @example
 * ```tsx
 * import { ChatTestHarness, mockEventSource, mockBroadcastChannel } from './fixtures/chatTestHarness';
 *
 * // In your test:
 * const { eventSource, broadcastChannel } = setupChatMocks();
 * render(<ChatTestHarness initialHistory={[]} />);
 *
 * // Simulate SSE messages
 * eventSource.simulateOpen();
 * eventSource.simulateMessage({ type: 'message', content: 'Hello' });
 * ```
 */
import * as React from 'react';
import { vi } from 'vitest';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from '../../mocks/data';
import { mockAssistantActions } from '../../mocks/actions';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

// =============================================================================
// MOCK EVENT SOURCE
// =============================================================================

/**
 * Controllable EventSource mock for testing SSE connections.
 * Allows simulating connection states, messages, and errors.
 */
export class ControllableMockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  readyState = 0;
  url: string;
  closeSpy = vi.fn();

  constructor(url: string) {
    this.url = url;
    this.readyState = ControllableMockEventSource.CONNECTING;
    // Track instances for test assertions
    eventSourceInstances.push(this);
    currentEventSource = this;
  }

  close() {
    this.readyState = ControllableMockEventSource.CLOSED;
    this.closeSpy();
  }

  /** Simulate the connection opening */
  simulateOpen() {
    this.readyState = ControllableMockEventSource.OPEN;
    if (this.onopen) this.onopen();
  }

  /** Simulate a connection error */
  simulateError() {
    this.readyState = ControllableMockEventSource.CONNECTING;
    if (this.onerror) this.onerror(new Event('error'));
  }

  /** Simulate receiving a message from the server */
  simulateMessage(data: object | string) {
    if (this.onmessage && this.readyState === ControllableMockEventSource.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage(new MessageEvent('message', { data: payload }));
    }
  }
}

// Track EventSource instances
let eventSourceInstances: ControllableMockEventSource[] = [];
let currentEventSource: ControllableMockEventSource | null = null;

// =============================================================================
// MOCK BROADCAST CHANNEL
// =============================================================================

/**
 * Controllable BroadcastChannel mock for testing cross-tab communication.
 */
export class ControllableMockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
    broadcastChannelInstances.push(this);
  }

  /** Simulate receiving a message from another tab */
  simulateIncomingMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }
}

// Track BroadcastChannel instances
let broadcastChannelInstances: ControllableMockBroadcastChannel[] = [];

// =============================================================================
// SETUP / TEARDOWN HELPERS
// =============================================================================

const originalEventSource = typeof window !== 'undefined' ? window.EventSource : undefined;
const originalBroadcastChannel =
  typeof window !== 'undefined' ? window.BroadcastChannel : undefined;

/**
 * Setup chat-related mocks (EventSource, BroadcastChannel).
 * Call this in beforeEach.
 *
 * @returns Object with getters for the current mock instances
 */
export function setupChatMocks() {
  // Reset instance tracking
  eventSourceInstances = [];
  broadcastChannelInstances = [];
  currentEventSource = null;

  // Install mocks
  if (typeof window !== 'undefined') {
    window.EventSource = ControllableMockEventSource as unknown as typeof EventSource;
    window.BroadcastChannel =
      ControllableMockBroadcastChannel as unknown as typeof BroadcastChannel;
  }

  return {
    /** Get the most recently created EventSource instance */
    get eventSource() {
      return currentEventSource;
    },
    /** Get all EventSource instances created during the test */
    get allEventSources() {
      return eventSourceInstances;
    },
    /** Get all BroadcastChannel instances created during the test */
    get allBroadcastChannels() {
      return broadcastChannelInstances;
    },
    /** Get the first BroadcastChannel instance */
    get broadcastChannel() {
      return broadcastChannelInstances[0] ?? null;
    },
  };
}

/**
 * Cleanup chat-related mocks.
 * Call this in afterEach.
 */
export function cleanupChatMocks() {
  if (typeof window !== 'undefined') {
    if (originalEventSource) window.EventSource = originalEventSource;
    if (originalBroadcastChannel) window.BroadcastChannel = originalBroadcastChannel;
  }
  eventSourceInstances = [];
  broadcastChannelInstances = [];
  currentEventSource = null;
}

// =============================================================================
// MOCK CHAT ACTIONS FACTORY
// =============================================================================

export interface MockChatActionsOptions {
  /** Initial contact ID to return (default: 1 for owner) */
  contactId?: number;
  /** Mock implementation for getTranscripts */
  getTranscripts?: (
    ownerContext: string,
    assistantContext: string,
    contactId: number,
    beforeMessageId?: number
  ) => Promise<ChatMessage[] | { detail: string }>;
  /** Mock implementation for message */
  message?: (payload: {
    assistantId: string;
    contactId: number;
    message: string;
  }) => Promise<{ info?: string; detail?: string }>;
}

/**
 * Create mock chat actions with configurable behavior.
 */
export function createMockChatActions(options: MockChatActionsOptions = {}) {
  const { contactId = 1, getTranscripts, message } = options;

  return {
    getContactId: vi.fn(async () => contactId),
    getTranscripts: getTranscripts ? vi.fn(getTranscripts) : vi.fn(async () => [] as ChatMessage[]),
    message: message ? vi.fn(message) : vi.fn(async () => ({ info: 'Message sent' })),
    getAssistantOwnerById: vi.fn(async () => ({ firstName: 'Test', lastName: 'Owner' })),
    triggerContactSync: vi.fn(async () => ({ info: 'Contact sync triggered' })),
  };
}

// =============================================================================
// CHAT MESSAGE FACTORIES
// =============================================================================

let messageIdCounter = 1;

/**
 * Create a mock chat message.
 */
export function createMockChatMessage(
  overrides: Partial<ChatMessage> & { role?: 'user' | 'assistant' } = {}
): ChatMessage {
  const id = messageIdCounter++;
  const { role = 'user', ...rest } = overrides;

  return {
    id: String(id),
    role,
    content: role === 'user' ? 'Hello from user' : 'Hello from assistant',
    timestamp: new Date(),
    messageId: id,
    ...rest,
  };
}

/**
 * Create a list of mock chat messages for history testing.
 */
export function createMockChatHistory(count: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(
      createMockChatMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
      })
    );
  }
  return messages;
}

/**
 * Reset the message ID counter (call in beforeEach for consistent IDs).
 */
export function resetMessageIdCounter() {
  messageIdCounter = 1;
}

// =============================================================================
// CHAT TEST WRAPPER COMPONENT
// =============================================================================

export interface ChatTestHarnessProps {
  /** Initial chat history for the assistant */
  initialHistory?: ChatMessage[];
  /** Override specific assistant actions */
  assistantActionsOverride?: Partial<AssistantActions>;
  /** Override the default assistant */
  assistantOverride?: Assistant | null;
  /** Key to force re-mount */
  panelKey?: string;
  /** User email for chat context */
  userEmail?: string;
  /** Callback when chat history changes */
  onHistoryChange?: (history: ChatMessage[]) => void;
}

/**
 * Test wrapper component for chat functionality.
 * Provides all necessary context and state management.
 */
export function ChatTestHarness({
  initialHistory,
  assistantActionsOverride = {},
  assistantOverride = null,
  panelKey,
  userEmail = 'test@example.com',
  onHistoryChange,
}: ChatTestHarnessProps) {
  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        firstName: 'Test',
        surname: 'Assistant',
        agentId: 'test-assistant-id',
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

  // Notify parent when history changes
  React.useEffect(() => {
    if (onHistoryChange && histories[activeAssistant.agentId]) {
      onHistoryChange(histories[activeAssistant.agentId]);
    }
  }, [histories, activeAssistant.agentId, onHistoryChange]);

  return (
    <AssistantProfilePanel
      key={panelKey}
      assistant={activeAssistant}
      assistantActions={actions}
      onClose={vi.fn()}
      onDeleteAssistant={vi.fn()}
      onEdit={vi.fn()}
      onOpenContactManager={vi.fn()}
      chatHistories={histories}
      setChatHistories={setHistories}
      userEmail={userEmail}
      onStartCall={vi.fn()}
      activeCallAssistantId={null}
      isCallConnected={false}
      isConnectingCall={false}
    />
  );
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Query helper to get chat message bubbles.
 */
export function getChatBubbles(screen: { queryAllByTestId: (id: string) => HTMLElement[] }) {
  return screen.queryAllByTestId('message-bubble').map((el) => el.textContent);
}

/**
 * Query helper to find the chat input field.
 */
export function getChatInput(screen: {
  getByPlaceholderText: (text: string | RegExp) => HTMLElement;
}) {
  return screen.getByPlaceholderText(/type a message/i) as HTMLInputElement;
}

/**
 * Query helper to find the send button.
 */
export function getSendButton(screen: {
  getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
}) {
  return screen.getByRole('button', { name: /send/i });
}
