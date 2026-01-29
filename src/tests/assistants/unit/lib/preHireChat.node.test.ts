/**
 * Unit tests for src/lib/assistants/preHireChat.ts
 *
 * Tests the pre-hire chat server actions including credit checking,
 * deduction, and LLM call handling.
 *
 * Uses mocks for dependencies (getCurrentUser, credits, generateText).
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/user/credits', () => ({
  checkCreditsBalance: vi.fn(),
  deductCredits: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'mock-model')),
}));

// Import after mocking
import { sendPreHireChatMessage, generatePostHireGreeting } from '@/lib/assistants/preHireChat';
import { getCurrentUser } from '@/lib/user/user';
import { checkCreditsBalance, deductCredits } from '@/lib/user/credits';
import { generateText } from 'ai';
import type { User } from '@/types/user';

describe('preHireChat.ts', () => {
  const mockUser: Partial<User> = {
    id: 'user-123',
    name: 'John',
    lastName: 'Doe',
    apiKey: 'test-api-key',
    email: 'john@example.com',
  };

  const mockMessages = [{ role: 'user' as const, content: 'Hello, can you help me?' }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ORCHESTRA_OPENAI_API_KEY', 'mock-openai-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ==========================================================================
  // sendPreHireChatMessage tests
  // ==========================================================================

  describe('sendPreHireChatMessage', () => {
    it(
      'returns error when user is not authenticated',
      {
        meta: {
          alias: 'PreHireChat-Unauthorized',
          scenario: 'No user session',
          behavior: 'Returns Unauthorized error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null as unknown as User);

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('Unauthorized');
        expect(result.content).toBeUndefined();
      }
    );

    it(
      'returns error when user has no API key',
      {
        meta: {
          alias: 'PreHireChat-NoApiKey',
          scenario: 'User exists but has no API key',
          behavior: 'Returns Unauthorized error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue({
          ...mockUser,
          apiKey: '',
        } as User);

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('Unauthorized - no API key');
      }
    );

    it(
      'returns error when messages are invalid',
      {
        meta: {
          alias: 'PreHireChat-InvalidMessages',
          scenario: 'Messages is not an array',
          behavior: 'Returns validation error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);

        // Act
        const result = await sendPreHireChatMessage(
          null as unknown as typeof mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('Invalid request: messages are required.');
      }
    );

    it(
      'returns error when message is too long',
      {
        meta: {
          alias: 'PreHireChat-MessageTooLong',
          scenario: 'Message exceeds 2000 character limit',
          behavior: 'Returns message too long error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        const longMessage = [{ role: 'user' as const, content: 'a'.repeat(2001) }];

        // Act
        const result = await sendPreHireChatMessage(longMessage, 'Jane', 25, 'A helpful assistant');

        // Assert
        expect(result.error).toContain('Message too long');
      }
    );

    it(
      'returns INSUFFICIENT_CREDITS when balance check fails',
      {
        meta: {
          alias: 'PreHireChat-InsufficientCredits',
          scenario: 'User has no credits',
          behavior: 'Returns INSUFFICIENT_CREDITS error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: false,
          currentBalance: 0,
        });

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('INSUFFICIENT_CREDITS');
        expect(generateText).not.toHaveBeenCalled();
      }
    );

    it(
      'returns INSUFFICIENT_CREDITS when balance check has error',
      {
        meta: {
          alias: 'PreHireChat-CreditsCheckError',
          scenario: 'Credits check API fails',
          behavior: 'Returns INSUFFICIENT_CREDITS error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: false,
          currentBalance: 0,
          error: 'Network error',
        });

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('INSUFFICIENT_CREDITS');
      }
    );

    it(
      'calls LLM and deducts credits on success',
      {
        meta: {
          alias: 'PreHireChat-Success',
          scenario: 'Valid request with sufficient credits',
          behavior: 'Returns LLM response and deducts credits',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 100,
        });
        vi.mocked(generateText).mockResolvedValue({
          text: 'Hello! I would be happy to help you.',
        } as Awaited<ReturnType<typeof generateText>>);
        vi.mocked(deductCredits).mockResolvedValue({
          success: true,
          previousCredits: 100,
          deducted: 0.01,
          currentCredits: 99.99,
        });

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.content).toBe('Hello! I would be happy to help you.');
        expect(result.error).toBeUndefined();
        expect(deductCredits).toHaveBeenCalledWith('test-api-key', 0.01);
      }
    );

    it(
      'uses user API key for credit operations',
      {
        meta: {
          alias: 'PreHireChat-UsesApiKey',
          scenario: 'Verify API key is passed to credit functions',
          behavior: 'Credits functions receive user API key',
        },
      },
      async () => {
        // Arrange
        const userWithOrgKey = { ...mockUser, apiKey: 'org-api-key-456' };
        vi.mocked(getCurrentUser).mockResolvedValue(userWithOrgKey as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 100,
        });
        vi.mocked(generateText).mockResolvedValue({
          text: 'Response',
        } as Awaited<ReturnType<typeof generateText>>);
        vi.mocked(deductCredits).mockResolvedValue({ success: true });

        // Act
        await sendPreHireChatMessage(mockMessages, 'Jane', 25, 'A helpful assistant');

        // Assert
        expect(checkCreditsBalance).toHaveBeenCalledWith('org-api-key-456', 0.01);
        expect(deductCredits).toHaveBeenCalledWith('org-api-key-456', 0.01);
      }
    );

    it(
      'returns content even if credit deduction fails (non-insufficient)',
      {
        meta: {
          alias: 'PreHireChat-DeductFailNonCritical',
          scenario: 'LLM succeeds but deduction has network error',
          behavior: 'Returns content (rare edge case)',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 100,
        });
        vi.mocked(generateText).mockResolvedValue({
          text: 'Hello there!',
        } as Awaited<ReturnType<typeof generateText>>);
        vi.mocked(deductCredits).mockResolvedValue({
          success: false,
          error: 'Network timeout',
        });

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert - content is still returned, error is logged
        expect(result.content).toBe('Hello there!');
      }
    );

    it(
      'returns INSUFFICIENT_CREDITS if deduction fails with insufficient error',
      {
        meta: {
          alias: 'PreHireChat-DeductInsufficient',
          scenario: 'Balance changed between check and deduct',
          behavior: 'Returns INSUFFICIENT_CREDITS error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 0.01,
        });
        vi.mocked(generateText).mockResolvedValue({
          text: 'Response',
        } as Awaited<ReturnType<typeof generateText>>);
        vi.mocked(deductCredits).mockResolvedValue({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
        });

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('INSUFFICIENT_CREDITS');
      }
    );

    it(
      'includes assistant details in system prompt',
      {
        meta: {
          alias: 'PreHireChat-SystemPrompt',
          scenario: 'Verify system prompt contains assistant info',
          behavior: 'LLM receives system message with assistant details',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 100,
        });
        let capturedMessages: unknown = null;
        vi.mocked(generateText).mockImplementation(async (options) => {
          capturedMessages = options.messages;
          return { text: 'Response' } as Awaited<ReturnType<typeof generateText>>;
        });
        vi.mocked(deductCredits).mockResolvedValue({ success: true });

        // Act
        await sendPreHireChatMessage(mockMessages, 'Jane', 25, 'I love helping people');

        // Assert
        expect(capturedMessages).toBeDefined();
        const messages = capturedMessages as Array<{ role: string; content: string }>;
        const systemMessage = messages.find((m) => m.role === 'system');
        expect(systemMessage?.content).toContain('Jane');
        expect(systemMessage?.content).toContain('25');
        expect(systemMessage?.content).toContain('I love helping people');
        expect(systemMessage?.content).toContain('John Doe'); // User name
      }
    );

    it(
      'handles LLM errors gracefully',
      {
        meta: {
          alias: 'PreHireChat-LLMError',
          scenario: 'OpenAI API returns error',
          behavior: 'Returns error message without throwing',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(checkCreditsBalance).mockResolvedValue({
          hasSufficientCredits: true,
          currentBalance: 100,
        });
        vi.mocked(generateText).mockRejectedValue(new Error('OpenAI rate limit exceeded'));

        // Act
        const result = await sendPreHireChatMessage(
          mockMessages,
          'Jane',
          25,
          'A helpful assistant'
        );

        // Assert
        expect(result.error).toBe('OpenAI rate limit exceeded');
        expect(result.content).toBeUndefined();
        // Credits should NOT be deducted if LLM fails
        expect(deductCredits).not.toHaveBeenCalled();
      }
    );
  });

  // ==========================================================================
  // generatePostHireGreeting tests
  // ==========================================================================

  describe('generatePostHireGreeting', () => {
    it(
      'returns error when user is not authenticated',
      {
        meta: {
          alias: 'PostHireGreeting-Unauthorized',
          scenario: 'No user session',
          behavior: 'Returns Unauthorized error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null as unknown as User);

        // Act
        const result = await generatePostHireGreeting('Jane', 25, 'Bio', 'USA');

        // Assert
        expect(result.error).toBe('Unauthorized');
      }
    );

    it(
      'generates greeting without credit check (covered by onboarding fee)',
      {
        meta: {
          alias: 'PostHireGreeting-NoCreditsCheck',
          scenario: 'Post-hire greeting generation',
          behavior: 'Does not check or deduct credits',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(generateText).mockResolvedValue({
          text: 'Welcome! I am excited to work with you.',
        } as Awaited<ReturnType<typeof generateText>>);

        // Act
        const result = await generatePostHireGreeting('Jane', 25, 'Helpful assistant', 'USA');

        // Assert
        expect(result.content).toBe('Welcome! I am excited to work with you.');
        expect(checkCreditsBalance).not.toHaveBeenCalled();
        expect(deductCredits).not.toHaveBeenCalled();
      }
    );

    it(
      'includes assistant profile in greeting prompt',
      {
        meta: {
          alias: 'PostHireGreeting-IncludesProfile',
          scenario: 'Verify greeting prompt includes assistant details',
          behavior: 'System prompt contains name, age, bio, nationality',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        let capturedMessages: unknown = null;
        vi.mocked(generateText).mockImplementation(async (options) => {
          capturedMessages = options.messages;
          return { text: 'Greeting' } as Awaited<ReturnType<typeof generateText>>;
        });

        // Act
        await generatePostHireGreeting('Maria', 30, 'Expert in scheduling', 'Spain');

        // Assert
        const messages = capturedMessages as Array<{ role: string; content: string }>;
        const systemMessage = messages.find((m) => m.role === 'system');
        expect(systemMessage?.content).toContain('Maria');
        expect(systemMessage?.content).toContain('30');
        expect(systemMessage?.content).toContain('Expert in scheduling');
        expect(systemMessage?.content).toContain('Spain');
      }
    );

    it(
      'handles LLM errors gracefully',
      {
        meta: {
          alias: 'PostHireGreeting-LLMError',
          scenario: 'OpenAI API returns error',
          behavior: 'Returns error message',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
        vi.mocked(generateText).mockRejectedValue(new Error('Service unavailable'));

        // Act
        const result = await generatePostHireGreeting('Jane', 25, 'Bio', 'USA');

        // Assert
        expect(result.error).toBe('Service unavailable');
      }
    );
  });
});
