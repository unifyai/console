/**
 * Unit tests for src/lib/assistants/call.ts
 *
 * Tests the server action factory functions for call operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock React's cache function before importing call.ts (which imports user.ts that uses cache)
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    cache: (fn: any) => fn, // cache is just a pass-through in tests
  };
});

// Mock getCurrentUser for deleteCallRoom auth tests
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock livekit-server-sdk to avoid real SDK calls
const mockDeleteRoom = vi.fn();
vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn(),
  RoomServiceClient: vi.fn().mockImplementation(function (this: any) {
    this.deleteRoom = mockDeleteRoom;
  }),
}));

import { dispatchAssistantToCall, deleteCallRoom } from '@/lib/assistants/call';
import { makeRoomName } from '@/utils/assistants/call-utils';
import { getCurrentUser } from '@/lib/user/user';
import type { User } from '@/types/user';

const MOCK_ORCHESTRA_URL = 'http://localhost:8000/v0';
const MOCK_DISPATCH_URL = 'https://service.a.run.app/unify/meet';
const MOCK_DISPATCH_URL_PREVIEW =
  'https://service.a.run.app/unify/meet';
const MOCK_DISPATCH_URL_STAGING =
  'https://service.a.run.app/unify/meet';
const MOCK_ADMIN_KEY = 'test-admin-key';

describe('call.ts', () => {
  const TEST_API_KEY = 'test-api-key';
  const mockUser: Partial<User> = {
    id: 'user-123',
    name: 'John',
    apiKey: TEST_API_KEY,
    email: 'john@example.com',
  };

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
    vi.stubEnv('ORCHESTRA_ADMIN_KEY', MOCK_ADMIN_KEY);
    vi.stubEnv('LIVEKIT_API_KEY', 'test-lk-key');
    vi.stubEnv('LIVEKIT_API_SECRET', 'test-lk-secret');
    vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com');
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as User);
    mockDeleteRoom.mockResolvedValue(undefined);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // Note: getCallConnectionDetails uses LiveKit SDK directly and requires mocking
  // the SDK itself, not HTTP calls. Those tests would be more complex and are
  // covered by integration tests.

  describe('dispatchAssistantToCall', () => {
    it(
      'dispatches assistant and returns success response',
      {
        meta: {
          alias: 'DispatchCall-Success',
          scenario: 'Cloud Run endpoint successfully dispatches assistant',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(MOCK_DISPATCH_URL, () => {
            return HttpResponse.json({ info: 'Assistant dispatched to call' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'sends correct snake_case payload to Cloud Run',
      {
        meta: {
          alias: 'DispatchCall-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains snake_case assistant_id, room_name, livekit_agent_name',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(MOCK_DISPATCH_URL, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedBody).toEqual({
          assistant_id: 'assistant-123',
          livekit_agent_name: 'room-abc',
          room_name: 'room-abc',
        });
      }
    );

    it(
      'includes admin key in Authorization header',
      {
        meta: {
          alias: 'DispatchCall-AdminKey',
          scenario: 'Verify authorization header',
          behavior: 'Request includes Bearer token with admin key',
        },
      },
      async () => {
        // Arrange
        let capturedAuth = '';
        server.use(
          http.post(MOCK_DISPATCH_URL, ({ request }) => {
            capturedAuth = request.headers.get('Authorization') || '';
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedAuth).toBe(`Bearer ${MOCK_ADMIN_KEY}`);
      }
    );

    it(
      'returns error when dispatch fails',
      {
        meta: {
          alias: 'DispatchCall-Error',
          scenario: 'Cloud Run returns error response',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(MOCK_DISPATCH_URL, () => {
            return new HttpResponse('Room not found', { status: 404 });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('detail', 'Room not found');
      }
    );

    it(
      'returns error when network fails',
      {
        meta: {
          alias: 'DispatchCall-NetworkError',
          scenario: 'Network error during dispatch',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(MOCK_DISPATCH_URL, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns success when no admin key is configured',
      {
        meta: {
          alias: 'DispatchCall-NoAdminKey',
          scenario: 'ORCHESTRA_ADMIN_KEY is not set (local development)',
          behavior: 'Returns info message without making external call',
        },
      },
      async () => {
        // Arrange
        vi.stubEnv('ORCHESTRA_ADMIN_KEY', '');

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'dispatches to preview adapters when deployEnv is preview',
      {
        meta: {
          alias: 'DispatchCall-PreviewEnv',
          scenario: 'Assistant has deploy_env="preview"',
          behavior: 'Request goes to unity-adapters-preview-* host instead of default',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.post(MOCK_DISPATCH_URL_PREVIEW, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ info: 'Assistant dispatched' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc', 'preview');

        // Assert
        expect(capturedUrl).toContain('unity-adapters-preview-');
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'preview deployEnv overrides staging environment',
      {
        meta: {
          alias: 'DispatchCall-PreviewOverridesStaging',
          scenario: 'ORCHESTRA_URL is staging but assistant has deploy_env="preview"',
          behavior: 'Request goes to preview host, not staging host',
        },
      },
      async () => {
        // Arrange
        vi.stubEnv('ORCHESTRA_URL', 'https://api.staging.example.com');
        let capturedUrl = '';
        server.use(
          http.post(MOCK_DISPATCH_URL_PREVIEW, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc', 'preview');

        // Assert
        expect(capturedUrl).toContain('unity-adapters-preview-');
        expect(capturedUrl).not.toContain('unity-adapters-staging-');
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'uses staging adapters when ORCHESTRA_URL is staging and no deployEnv',
      {
        meta: {
          alias: 'DispatchCall-StagingFallback',
          scenario: 'ORCHESTRA_URL contains "staging" and no deploy_env override',
          behavior: 'Request goes to unity-adapters-staging-* host',
        },
      },
      async () => {
        // Arrange
        vi.stubEnv('ORCHESTRA_URL', 'https://api.staging.example.com');
        let capturedUrl = '';
        server.use(
          http.post(MOCK_DISPATCH_URL_STAGING, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedUrl).toContain('unity-adapters-staging-');
        expect(result).toHaveProperty('info');
      }
    );
  });

  describe('deleteCallRoom', () => {
    it(
      'deletes room successfully when authenticated',
      {
        meta: {
          alias: 'DeleteRoom-Success',
          scenario: 'Authenticated user deletes a room',
          behavior: 'Returns empty object and calls RoomServiceClient.deleteRoom',
        },
      },
      async () => {
        // Act
        const deleteFn = await deleteCallRoom();
        const result = await deleteFn('unity_assistant-1_meet');

        // Assert
        expect(result).toEqual({});
        expect(mockDeleteRoom).toHaveBeenCalledWith('unity_assistant-1_meet');
      }
    );

    it(
      'returns auth error when user is not authenticated',
      {
        meta: {
          alias: 'DeleteRoom-Unauthenticated',
          scenario: 'No authenticated user',
          behavior: 'Returns user not authenticated error',
        },
      },
      async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue(null);

        // Act
        const deleteFn = await deleteCallRoom();
        const result = await deleteFn('unity_assistant-1_meet');

        // Assert
        expect(result).toHaveProperty('detail', 'User not authenticated');
        expect(mockDeleteRoom).not.toHaveBeenCalled();
      }
    );

    // Note: The "server configuration error" path cannot be tested here because
    // LIVEKIT_URL, API_KEY, and API_SECRET are captured at module scope when
    // call.ts is first imported. Stubbing env vars after import has no effect.
    // This path is covered by integration tests instead.

    it(
      'returns error detail when RoomServiceClient throws',
      {
        meta: {
          alias: 'DeleteRoom-SDKError',
          scenario: 'LiveKit SDK throws an error',
          behavior: 'Returns error detail with message',
        },
      },
      async () => {
        // Arrange
        mockDeleteRoom.mockRejectedValue(new Error('Room not found'));

        // Act
        const deleteFn = await deleteCallRoom();
        const result = await deleteFn('unity_assistant-1_meet');

        // Assert
        expect(result).toHaveProperty('detail', 'Room not found');
      }
    );

    it(
      'handles non-Error thrown values gracefully',
      {
        meta: {
          alias: 'DeleteRoom-UnknownError',
          scenario: 'LiveKit SDK throws a non-Error value',
          behavior: 'Returns generic error message',
        },
      },
      async () => {
        // Arrange
        mockDeleteRoom.mockRejectedValue('unexpected string error');

        // Act
        const deleteFn = await deleteCallRoom();
        const result = await deleteFn('unity_assistant-1_meet');

        // Assert
        expect(result).toHaveProperty('detail', 'Unknown error deleting room.');
      }
    );
  });

  describe('makeRoomName', () => {
    it(
      'constructs room name in expected format',
      {
        meta: {
          alias: 'MakeRoomName-Format',
          scenario: 'Given assistantId and medium',
          behavior: 'Returns unity_{assistantId}_{medium}',
        },
      },
      () => {
        expect(makeRoomName('assistant-123', 'meet')).toBe('unity_assistant-123_meet');
        expect(makeRoomName('abc', 'chat')).toBe('unity_abc_chat');
      }
    );
  });
});
