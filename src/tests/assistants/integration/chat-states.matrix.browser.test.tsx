/**
 * Chat States Matrix Tests
 *
 * Combinatorial testing for chat connection and message states.
 * Tests all meaningful combinations of:
 * - Connection: connecting × connected × reconnecting × error
 * - History: empty × loaded × paginated × error
 * - Message: idle × sending × error
 * - SSE: open × closed × error
 *
 * Uses defineMatrixTests for chunking/sharding support in CI.
 *
 * @group matrix
 * @group integration
 */

import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/render';
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';
import { ChatMessage } from '@/types/assistants/chat';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';
type HistoryStatus = 'empty' | 'loaded' | 'paginated' | 'loading' | 'error';
type MessageStatus = 'idle' | 'sending' | 'error';
type SSEStatus = 'open' | 'closed' | 'error';

interface ChatStateScenario {
  id: string;
  description: string;
  connection: ConnectionStatus;
  history: HistoryStatus;
  message: MessageStatus;
  sse: SSEStatus;
  expected: {
    canSend: boolean;
    showsLoading: boolean;
    showsError: boolean;
    showsRetry: boolean;
  };
}

// =============================================================================
// CHAT STATE MATRIX DEFINITION
// =============================================================================

const CHAT_STATE_MATRIX: ChatStateScenario[] = [
  // Happy path states
  {
    id: 'connected-loaded-idle-open',
    description: 'Fully connected and ready',
    connection: 'connected',
    history: 'loaded',
    message: 'idle',
    sse: 'open',
    expected: { canSend: true, showsLoading: false, showsError: false, showsRetry: false },
  },
  {
    id: 'connected-empty-idle-open',
    description: 'Connected with no messages',
    connection: 'connected',
    history: 'empty',
    message: 'idle',
    sse: 'open',
    expected: { canSend: true, showsLoading: false, showsError: false, showsRetry: false },
  },
  {
    id: 'connected-loaded-sending-open',
    description: 'Sending a message',
    connection: 'connected',
    history: 'loaded',
    message: 'sending',
    sse: 'open',
    expected: { canSend: false, showsLoading: true, showsError: false, showsRetry: false },
  },

  // Loading states
  {
    id: 'connecting-loading-idle-closed',
    description: 'Initial connection in progress',
    connection: 'connecting',
    history: 'loading',
    message: 'idle',
    sse: 'closed',
    expected: { canSend: false, showsLoading: true, showsError: false, showsRetry: false },
  },
  {
    id: 'connected-loading-idle-open',
    description: 'Loading more history',
    connection: 'connected',
    history: 'loading',
    message: 'idle',
    sse: 'open',
    expected: { canSend: true, showsLoading: true, showsError: false, showsRetry: false },
  },

  // Reconnection states
  {
    id: 'reconnecting-loaded-idle-closed',
    description: 'SSE reconnecting',
    connection: 'reconnecting',
    history: 'loaded',
    message: 'idle',
    sse: 'closed',
    expected: { canSend: false, showsLoading: true, showsError: false, showsRetry: false },
  },

  // Error states
  {
    id: 'error-empty-idle-error',
    description: 'Connection failed',
    connection: 'error',
    history: 'empty',
    message: 'idle',
    sse: 'error',
    expected: { canSend: false, showsLoading: false, showsError: true, showsRetry: true },
  },
  {
    id: 'connected-error-idle-open',
    description: 'History load failed',
    connection: 'connected',
    history: 'error',
    message: 'idle',
    sse: 'open',
    expected: { canSend: false, showsLoading: false, showsError: true, showsRetry: true },
  },
  {
    id: 'connected-loaded-error-open',
    description: 'Message send failed',
    connection: 'connected',
    history: 'loaded',
    message: 'error',
    sse: 'open',
    expected: { canSend: true, showsLoading: false, showsError: true, showsRetry: true },
  },

  // Paginated states
  {
    id: 'connected-paginated-idle-open',
    description: 'Has more history to load',
    connection: 'connected',
    history: 'paginated',
    message: 'idle',
    sse: 'open',
    expected: { canSend: true, showsLoading: false, showsError: false, showsRetry: false },
  },
];

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createMockMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  };
}

function createMockMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createMockMessage({
      id: `msg-${i}`,
      messageId: i,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
      timestamp: new Date(Date.now() - i * 60000),
    })
  );
}

// =============================================================================
// MOCK COMPONENT FOR TESTING CHAT STATE LOGIC
// =============================================================================

interface ChatStateTestProps {
  connectionStatus: ConnectionStatus;
  historyStatus: HistoryStatus;
  messageStatus: MessageStatus;
  sseStatus: SSEStatus;
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  onSend: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
}

const ChatStateTest: React.FC<ChatStateTestProps> = ({
  connectionStatus,
  historyStatus,
  messageStatus,
  sseStatus,
  messages,
  hasMoreMessages,
  onSend,
  onRetry,
  onLoadMore,
}) => {
  // Loading states - note: loading more history should still allow sending
  const isInitialLoading =
    connectionStatus === 'connecting' ||
    connectionStatus === 'reconnecting' ||
    messageStatus === 'sending';

  const isLoadingMoreHistory = historyStatus === 'loading' && connectionStatus === 'connected';
  const isLoading = isInitialLoading || isLoadingMoreHistory;

  const hasError =
    connectionStatus === 'error' ||
    historyStatus === 'error' ||
    messageStatus === 'error' ||
    sseStatus === 'error';

  // Can send when connected, not in error, not currently sending, and SSE is open
  // Loading more history does NOT block sending
  const canSend =
    connectionStatus === 'connected' &&
    historyStatus !== 'error' &&
    messageStatus !== 'sending' &&
    sseStatus === 'open';

  return (
    <div data-testid="chat-container">
      {/* Status indicators */}
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="history-status">{historyStatus}</div>
      <div data-testid="message-status">{messageStatus}</div>
      <div data-testid="sse-status">{sseStatus}</div>

      {/* Loading indicator */}
      {isLoading && <div data-testid="loading-indicator">Loading...</div>}

      {/* Error state */}
      {hasError && (
        <div data-testid="error-container">
          <span data-testid="error-message">An error occurred</span>
          <button data-testid="retry-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {/* Message list */}
      <div data-testid="message-list">
        {hasMoreMessages && historyStatus === 'paginated' && (
          <button data-testid="load-more-button" onClick={onLoadMore}>
            Load more
          </button>
        )}
        {messages.map((msg) => (
          <div key={msg.id} data-testid={`message-${msg.id}`}>
            {msg.content}
          </div>
        ))}
        {historyStatus === 'empty' && messages.length === 0 && (
          <div data-testid="empty-state">No messages yet</div>
        )}
      </div>

      {/* Send button */}
      <button
        data-testid="send-button"
        onClick={onSend}
        disabled={!canSend}
        aria-disabled={!canSend}
      >
        Send
      </button>
    </div>
  );
};

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

defineMatrixTests<ChatStateScenario>({
  name: 'Chat States Matrix',
  chunkSize: 5,

  getMatrix: () => CHAT_STATE_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    const messages = scenario.history === 'empty' ? [] : createMockMessages(5);
    const hasMore = scenario.history === 'paginated';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(`canSend should be ${scenario.expected.canSend}`, () => {
      render(
        <ChatStateTest
          connectionStatus={scenario.connection}
          historyStatus={scenario.history}
          messageStatus={scenario.message}
          sseStatus={scenario.sse}
          messages={messages}
          hasMoreMessages={hasMore}
          onSend={vi.fn()}
          onRetry={vi.fn()}
          onLoadMore={vi.fn()}
        />
      );

      const sendButton = screen.getByTestId('send-button');
      if (scenario.expected.canSend) {
        expect(sendButton).not.toBeDisabled();
      } else {
        expect(sendButton).toBeDisabled();
      }
    });

    it(`showsLoading should be ${scenario.expected.showsLoading}`, () => {
      render(
        <ChatStateTest
          connectionStatus={scenario.connection}
          historyStatus={scenario.history}
          messageStatus={scenario.message}
          sseStatus={scenario.sse}
          messages={messages}
          hasMoreMessages={hasMore}
          onSend={vi.fn()}
          onRetry={vi.fn()}
          onLoadMore={vi.fn()}
        />
      );

      const loadingIndicator = screen.queryByTestId('loading-indicator');
      if (scenario.expected.showsLoading) {
        expect(loadingIndicator).toBeInTheDocument();
      } else {
        expect(loadingIndicator).not.toBeInTheDocument();
      }
    });

    it(`showsError should be ${scenario.expected.showsError}`, () => {
      render(
        <ChatStateTest
          connectionStatus={scenario.connection}
          historyStatus={scenario.history}
          messageStatus={scenario.message}
          sseStatus={scenario.sse}
          messages={messages}
          hasMoreMessages={hasMore}
          onSend={vi.fn()}
          onRetry={vi.fn()}
          onLoadMore={vi.fn()}
        />
      );

      const errorContainer = screen.queryByTestId('error-container');
      if (scenario.expected.showsError) {
        expect(errorContainer).toBeInTheDocument();
      } else {
        expect(errorContainer).not.toBeInTheDocument();
      }
    });

    it(`showsRetry should be ${scenario.expected.showsRetry}`, () => {
      render(
        <ChatStateTest
          connectionStatus={scenario.connection}
          historyStatus={scenario.history}
          messageStatus={scenario.message}
          sseStatus={scenario.sse}
          messages={messages}
          hasMoreMessages={hasMore}
          onSend={vi.fn()}
          onRetry={vi.fn()}
          onLoadMore={vi.fn()}
        />
      );

      const retryButton = screen.queryByTestId('retry-button');
      if (scenario.expected.showsRetry) {
        expect(retryButton).toBeInTheDocument();
      } else {
        expect(retryButton).not.toBeInTheDocument();
      }
    });
  },
});
