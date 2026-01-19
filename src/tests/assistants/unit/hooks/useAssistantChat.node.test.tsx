/**
 * Unit tests for src/hooks/Assistants/useAssistantChat.ts
 *
 * Tests the pre-hire chat hook logic for managing chat state.
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
      'exposes USER_MESSAGE_LIMIT constant',
      {
        meta: {
          alias: 'Chat-MessageLimit',
          scenario: 'Hook exposes limit',
          behavior: 'USER_MESSAGE_LIMIT is 10',
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
        expect(result.current.USER_MESSAGE_LIMIT).toBe(10);
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
  });
});
