/**
 * Unit tests for src/hooks/Assistants/useAssistantChat.ts
 *
 * Tests the pre-hire chat hook logic for managing chat state.
 * Note: Message limits have been removed - users pay per message via credits.
 * Uses React Testing Library's renderHook.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ChatMessage } from '@/types/assistants/chat';

// Mock the Server Action module before importing the hook
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn(),
  generatePostHireGreeting: vi.fn(),
}));

// Must import after mocking
import { useAssistantChat } from '@/hooks/Assistants/useAssistantChat';
import { sendPreHireChatMessage } from '@/lib/assistants/preHireChat';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('useAssistantChat', () => {
  const assistantFirstName = 'Jane';
  const assistantAge = 30;
  const assistantBio = 'A helpful assistant';
  const configKey = 'jane-doe-config';

  let histories: Record<string, ChatMessage[]>;
  let setHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    histories = {};
    setHistories = vi.fn((updater) => {
      if (typeof updater === 'function') {
        histories = updater(histories);
      } else {
        histories = updater;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it(
      'returns messages based on histories prop',
      {
        meta: {
          alias: 'Chat-MessagesFromHistories',
          scenario: 'Hook uses histories prop for messages',
          behavior: 'Returns messages from histories[configKey]',
        },
      },
      () => {
        // Arrange - start with empty histories
        const emptyHistories: Record<string, ChatMessage[]> = {};

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            emptyHistories,
            setHistories
          )
        );

        // Assert - messages comes from histories[configKey] which is undefined -> []
        expect(result.current.messages).toEqual([]);
      }
    );

    it(
      'returns existing messages when history exists',
      {
        meta: {
          alias: 'Chat-ExistingHistory',
          scenario: 'Config has existing chat history',
          behavior: 'Returns messages from history',
        },
      },
      () => {
        // Arrange
        const existingMessages: ChatMessage[] = [
          { id: '1', role: 'assistant', content: 'Hello!', timestamp: new Date() },
          { id: '2', role: 'user', content: 'Hi there', timestamp: new Date() },
        ];
        histories = { [configKey]: existingMessages };

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert
        expect(result.current.messages).toEqual(existingMessages);
      }
    );

    it(
      'initializes with empty input value',
      {
        meta: {
          alias: 'Chat-EmptyInput',
          scenario: 'Hook initializes',
          behavior: 'inputValue is empty string',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert
        expect(result.current.inputValue).toBe('');
      }
    );

    it(
      'exposes userMessageCount for tracking',
      {
        meta: {
          alias: 'Chat-UserMessageCount',
          scenario: 'Hook exposes message count',
          behavior: 'userMessageCount is available for display purposes',
        },
      },
      () => {
        // Arrange
        histories = {
          [configKey]: [
            { id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() },
            { id: '2', role: 'user', content: 'Hello', timestamp: new Date() },
          ],
        };

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert
        expect(result.current.userMessageCount).toBe(1);
      }
    );
  });

  describe('Initial Greeting', () => {
    it(
      'shows loading state during initial greeting',
      {
        meta: {
          alias: 'Chat-GreetingLoading',
          scenario: 'New config triggers greeting',
          behavior: 'isLoading is true during greeting generation',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert - Should be loading during initial greeting
        expect(result.current.isLoading).toBe(true);
      }
    );

    it(
      'adds placeholder message for typing indicator',
      {
        meta: {
          alias: 'Chat-TypingPlaceholder',
          scenario: 'Greeting is being generated',
          behavior: 'Adds empty content message as placeholder',
        },
      },
      async () => {
        // Act
        renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert - setHistories should be called with placeholder
        expect(setHistories).toHaveBeenCalled();
      }
    );
  });

  describe('Input Handling', () => {
    it(
      'updates input value on change',
      {
        meta: {
          alias: 'Chat-InputChange',
          scenario: 'User types in input',
          behavior: 'inputValue is updated',
        },
      },
      () => {
        // Arrange
        histories = {
          [configKey]: [{ id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() }],
        };

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello there' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        // Assert
        expect(result.current.inputValue).toBe('Hello there');
      }
    );
  });

  describe('User Message Count', () => {
    it(
      'counts user messages correctly',
      {
        meta: {
          alias: 'Chat-UserCount',
          scenario: 'History has mixed messages',
          behavior: 'userMessageCount reflects user messages only',
        },
      },
      () => {
        // Arrange
        histories = {
          [configKey]: [
            { id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() },
            { id: '2', role: 'user', content: 'Hello', timestamp: new Date() },
            { id: '3', role: 'assistant', content: 'How can I help?', timestamp: new Date() },
            { id: '4', role: 'user', content: 'Question', timestamp: new Date() },
          ],
        };

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert
        expect(result.current.userMessageCount).toBe(2);
      }
    );

    it(
      'returns zero for no user messages',
      {
        meta: {
          alias: 'Chat-ZeroUserCount',
          scenario: 'Only assistant messages in history',
          behavior: 'userMessageCount is 0',
        },
      },
      () => {
        // Arrange
        histories = {
          [configKey]: [{ id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() }],
        };

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        // Assert
        expect(result.current.userMessageCount).toBe(0);
      }
    );
  });

  describe('Send Message', () => {
    beforeEach(() => {
      // Setup existing history so greeting doesn't trigger
      histories = {
        [configKey]: [{ id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() }],
      };
    });

    it(
      'does not send empty messages',
      {
        meta: {
          alias: 'Chat-NoEmptyMessage',
          scenario: 'User tries to send empty input',
          behavior: 'No state changes occur',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        const initialLoading = result.current.isLoading;

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert - loading state shouldn't change for empty message
        expect(result.current.isLoading).toBe(initialLoading);
      }
    );

    it(
      'prevents sending with only whitespace',
      {
        meta: {
          alias: 'Chat-NoWhitespaceMessage',
          scenario: 'User tries to send whitespace only',
          behavior: 'Message is not sent',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: '   ' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        const initialLoading = result.current.isLoading;

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert - loading state shouldn't change
        expect(result.current.isLoading).toBe(initialLoading);
        // Input should remain unchanged since send was blocked
        expect(result.current.inputValue).toBe('   ');
      }
    );

    it(
      'allows unlimited messages since users pay per message',
      {
        meta: {
          alias: 'Chat-NoMessageLimit',
          scenario: 'User has sent many messages',
          behavior: 'No message limit enforced - credits are the limiter',
        },
      },
      async () => {
        // Arrange - setup history with many user messages
        const manyMessages: ChatMessage[] = [];
        for (let i = 0; i < 20; i++) {
          manyMessages.push({
            id: `${i * 2}`,
            role: 'user',
            content: `Message ${i}`,
            timestamp: new Date(),
          });
          manyMessages.push({
            id: `${i * 2 + 1}`,
            role: 'assistant',
            content: `Response ${i}`,
            timestamp: new Date(),
          });
        }
        histories = { [configKey]: manyMessages };

        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          content: 'Response to message 21',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Message 21' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert - message was sent (no limit)
        expect(sendPreHireChatMessage).toHaveBeenCalled();
      }
    );
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      histories = {
        [configKey]: [{ id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() }],
      };
    });

    it(
      'handles INSUFFICIENT_CREDITS error with friendly message',
      {
        meta: {
          alias: 'Chat-InsufficientCredits',
          scenario: 'Server returns INSUFFICIENT_CREDITS error',
          behavior: 'Displays friendly message with billing link',
        },
      },
      async () => {
        // Arrange
        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          error: 'INSUFFICIENT_CREDITS',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert - setHistories should have been called with the insufficient credits message
        // The last call should update the placeholder with the friendly message
        const calls = vi.mocked(setHistories).mock.calls;
        const lastUpdater = calls[calls.length - 1][0];
        if (typeof lastUpdater === 'function') {
          const updatedHistories = lastUpdater(histories);
          const lastMessage = updatedHistories[configKey]?.[updatedHistories[configKey].length - 1];
          expect(lastMessage?.content).toContain('credits');
          expect(lastMessage?.content).toContain('billing');
        }
      }
    );

    it(
      'handles generic errors with toast notification',
      {
        meta: {
          alias: 'Chat-GenericError',
          scenario: 'Server returns unexpected error',
          behavior: 'Shows toast error and removes placeholder',
        },
      },
      async () => {
        // Arrange
        const { toast } = await import('sonner');
        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          error: 'Some unexpected error',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Failed to get a response. Please try again.');
      }
    );

    it(
      'clears loading state after error',
      {
        meta: {
          alias: 'Chat-LoadingClearedOnError',
          scenario: 'Message send fails',
          behavior: 'isLoading returns to false',
        },
      },
      async () => {
        // Arrange
        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          error: 'Network error',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert
        expect(result.current.isLoading).toBe(false);
      }
    );
  });

  describe('Successful Message Send', () => {
    beforeEach(() => {
      histories = {
        [configKey]: [{ id: '1', role: 'assistant', content: 'Hi', timestamp: new Date() }],
      };
    });

    it(
      'clears input after successful send',
      {
        meta: {
          alias: 'Chat-ClearsInputOnSuccess',
          scenario: 'Message sent successfully',
          behavior: 'inputValue is cleared immediately',
        },
      },
      async () => {
        // Arrange
        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          content: 'Response',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert
        expect(result.current.inputValue).toBe('');
      }
    );

    it(
      'passes correct parameters to sendPreHireChatMessage',
      {
        meta: {
          alias: 'Chat-CorrectParams',
          scenario: 'Message is sent',
          behavior: 'Server action receives correct parameters',
        },
      },
      async () => {
        // Arrange
        vi.mocked(sendPreHireChatMessage).mockResolvedValue({
          content: 'Response',
        });

        // Act
        const { result } = renderHook(() =>
          useAssistantChat(
            assistantFirstName,
            assistantAge,
            assistantBio,
            configKey,
            histories,
            setHistories
          )
        );

        act(() => {
          result.current.handleInputChange({
            target: { value: 'Hello assistant' },
          } as React.ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
          await result.current.sendMessage({ preventDefault: vi.fn() } as any);
        });

        // Assert
        expect(sendPreHireChatMessage).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ role: 'assistant', content: 'Hi' }),
            expect.objectContaining({ role: 'user', content: 'Hello assistant' }),
          ]),
          assistantFirstName,
          assistantAge,
          assistantBio
        );
      }
    );
  });
});
