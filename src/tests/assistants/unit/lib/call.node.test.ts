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

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('call.ts', () => {
  const TEST_API_KEY = 'test-api-key';
  const mockUser: Partial<User> = {
    id: 'user-123',
    name: 'John',
    apiKey: TEST_API_KEY,
    email: 'john@example.com',
  };

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
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
          scenario: 'API successfully dispatches assistant to call',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
            return HttpResponse.json({ info: 'Assistant dispatched to call' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('info', 'Assistant dispatched to call');
      }
    );

    it(
      'sends correct payload to dispatch endpoint',
      {
        meta: {
          alias: 'DispatchCall-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains assistantId and roomName',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedBody).toEqual({
          assistantId: 'assistant-123',
          roomName: 'room-abc',
        });
      }
    );

    it(
      'includes apiKey in request headers',
      {
        meta: {
          alias: 'DispatchCall-ApiKey',
          scenario: 'Verify authorization header',
          behavior: 'Request includes apiKey header',
        },
      },
      async () => {
        // Arrange
        let capturedApiKey = '';
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, ({ request }) => {
            capturedApiKey = request.headers.get('apiKey') || '';
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedApiKey).toBe(TEST_API_KEY);
      }
    );

    it(
      'returns error when dispatch fails',
      {
        meta: {
          alias: 'DispatchCall-Error',
          scenario: 'API returns error response',
          behavior: 'Returns error detail from API',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
            return HttpResponse.json({ detail: 'Room not found' }, { status: 404 });
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
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
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
