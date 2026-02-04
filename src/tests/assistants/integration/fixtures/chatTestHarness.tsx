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
import userEvent from '@testing-library/user-event';
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
    ownerId: string,
    assistantId: string,
    beforeMessageId?: number
  ) => Promise<ChatMessage[] | { detail: string }>;
  /** Mock implementation for message */
  message?: (payload: {
    assistantId: number;
    contactId: number;
    message: string;
  }) => Promise<{ info?: string; detail?: string }>;
}

/**
 * Create mock chat actions with configurable behavior.
 * Returns type-compatible mock for AssistantActions['chat'].
 */
export function createMockChatActions(
  options: MockChatActionsOptions = {}
): AssistantActions['chat'] {
  const { contactId = 1, getTranscripts, message } = options;

  return {
    getContactId: vi.fn(
      async (
        _ownerContext: string,
        _assistantContext: string,
        _userEmail: string,
        _ownerId: string,
        _assistantId: string
      ) => contactId
    ),
    getTranscripts: getTranscripts
      ? vi.fn(getTranscripts)
      : vi.fn(
          async (
            _ownerContext: string,
            _assistantContext: string,
            _contactId: number,
            _ownerId: string,
            _assistantId: string,
            _beforeMessageId?: number
          ) => [] as ChatMessage[]
        ),
    message: message ? vi.fn(message) : vi.fn(async () => ({ info: 'Message sent' })),
    getAssistantOwnerById: vi.fn(async () => ({ firstName: 'Test', lastName: 'Owner' })),
  } as AssistantActions['chat'];
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
 * Returns only the message content text, excluding avatar fallback text.
 */
export function getChatBubbles(screen: { queryAllByTestId: (id: string) => HTMLElement[] }) {
  return screen.queryAllByTestId('message-bubble').map((el) => {
    // Find the actual message content div (the one with whitespace-pre-wrap class)
    const contentDiv = el.querySelector('.whitespace-pre-wrap');
    return contentDiv ? contentDiv.textContent : el.textContent;
  });
}

/**
 * Query helper to find the chat input field.
 */
export function getChatInput(screen: {
  getByPlaceholderText: (text: string | RegExp) => HTMLElement;
}) {
  return screen.getByPlaceholderText(/send a message/i) as HTMLInputElement;
}

/**
 * Query helper to find the send button.
 */
export function getSendButton(screen: {
  getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
}) {
  return screen.getByRole('button', { name: /send/i });
}

// =============================================================================
// FILE ATTACHMENT HELPERS
// =============================================================================

/**
 * Create a test file for attachment testing.
 * Compatible with react-dropzone file handling.
 */
export function createTestFile(name: string, content: string, type: string): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * Create common test files for different file types.
 */
export const testFiles = {
  pdf: () => createTestFile('report.pdf', 'PDF content', 'application/pdf'),
  docx: () =>
    createTestFile(
      'document.docx',
      'DOCX content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ),
  xlsx: () =>
    createTestFile(
      'spreadsheet.xlsx',
      'XLSX content',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
  png: () => createTestFile('image.png', 'PNG content', 'image/png'),
  txt: () => createTestFile('notes.txt', 'Text content', 'text/plain'),
  json: () => createTestFile('data.json', '{"key": "value"}', 'application/json'),
  zip: () => createTestFile('archive.zip', 'ZIP content', 'application/zip'),
  generic: () => createTestFile('file.xyz', 'Unknown content', 'application/octet-stream'),
  large: () => {
    // Create 11MB file (over limit)
    const content = 'x'.repeat(11 * 1024 * 1024);
    return createTestFile('large.pdf', content, 'application/pdf');
  },
};

/**
 * Simulate file drop via react-dropzone.
 * Uses userEvent.upload() for proper browser test compatibility.
 */
export async function simulateFileDrop(
  container: HTMLElement,
  files: File[],
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  if (!fileInput) {
    throw new Error('Could not find file input element');
  }
  await user.upload(fileInput, files);
}

/**
 * Query helper to find the paperclip (attach) button.
 */
export function getAttachButton(screen: {
  getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
}) {
  return screen.getByRole('button', { name: /attach/i });
}

/**
 * Query helper to find all pending attachment chips (above input).
 */
export function getAttachmentChips(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="pending-attachment-chip"]'));
}

/**
 * Query helper to get pending attachment chip filenames.
 */
export function getAttachmentChipNames(container: HTMLElement): string[] {
  return getAttachmentChips(container).map(
    (chip) => chip.querySelector('[data-testid="attachment-name"]')?.textContent || ''
  );
}

/**
 * Remove a pending attachment chip by clicking its remove button.
 */
export async function removeAttachmentChip(
  container: HTMLElement,
  filename: string,
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  const chips = Array.from(container.querySelectorAll('[data-testid="pending-attachment-chip"]'));
  for (const chip of chips) {
    const nameEl = chip.querySelector('[data-testid="attachment-name"]');
    if (nameEl?.textContent?.includes(filename)) {
      const removeBtn = chip.querySelector('[data-testid="attachment-remove"]');
      if (removeBtn) {
        await user.click(removeBtn as HTMLElement);
        return;
      }
    }
  }
  throw new Error(`Could not find pending attachment chip for: ${filename}`);
}

/**
 * Query helper to check if drag-active state is visible.
 */
export function isDragActiveVisible(container: HTMLElement): boolean {
  const dropzone = container.querySelector('[data-testid="chat-dropzone"]');
  return dropzone?.classList.contains('ring-2') || false;
}

/**
 * Get attachment chips displayed in a sent message bubble.
 */
export function getMessageAttachments(messageBubble: HTMLElement): string[] {
  const chips = messageBubble.querySelectorAll('[data-testid="message-attachment"]');
  return Array.from(chips).map(
    (chip) => chip.querySelector('[data-testid="attachment-name"]')?.textContent || ''
  );
}
