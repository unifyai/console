/**
 * API Errors Matrix Tests
 *
 * Combinatorial testing for API error handling and categorization.
 * Tests all meaningful combinations of:
 * - HTTP status codes: 400 × 401 × 403 × 404 × 409 × 422 × 429 × 500 × 502 × 503
 * - Error types: validation × auth × permission × not_found × conflict × rate_limit × server
 * - Endpoints: Various assistant-related API endpoints
 *
 * Uses defineNodeMatrixTests for sharding support in CI.
 *
 * @group matrix
 * @group api
 */

import { describe, it, expect } from 'vitest';
import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;
type ErrorType =
  | 'validation'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server';
type Endpoint =
  | 'list_assistants'
  | 'get_assistant'
  | 'create_assistant'
  | 'update_assistant'
  | 'delete_assistant'
  | 'send_chat'
  | 'list_secrets'
  | 'create_secret';

interface ErrorScenario {
  id: string;
  description: string;
  status: HttpStatus;
  errorType: ErrorType;
  endpoint: Endpoint;
  expected: {
    shouldRetry: boolean;
    isUserError: boolean;
    isServerError: boolean;
    errorCode: string;
  };
}

// =============================================================================
// ERROR MATRIX DEFINITION
// =============================================================================

const ERROR_MATRIX: ErrorScenario[] = [
  // Validation errors (400)
  {
    id: 'validation-create-assistant',
    description: 'Invalid assistant data on create',
    status: 400,
    errorType: 'validation',
    endpoint: 'create_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'VALIDATION_ERROR',
    },
  },
  {
    id: 'validation-update-assistant',
    description: 'Invalid assistant data on update',
    status: 400,
    errorType: 'validation',
    endpoint: 'update_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'VALIDATION_ERROR',
    },
  },
  {
    id: 'validation-send-chat',
    description: 'Invalid chat message',
    status: 400,
    errorType: 'validation',
    endpoint: 'send_chat',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'VALIDATION_ERROR',
    },
  },

  // Auth errors (401)
  {
    id: 'auth-list-assistants',
    description: 'Unauthenticated list assistants',
    status: 401,
    errorType: 'auth',
    endpoint: 'list_assistants',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'UNAUTHORIZED',
    },
  },
  {
    id: 'auth-create-secret',
    description: 'Unauthenticated create secret',
    status: 401,
    errorType: 'auth',
    endpoint: 'create_secret',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'UNAUTHORIZED',
    },
  },

  // Permission errors (403)
  {
    id: 'permission-delete-assistant',
    description: 'Forbidden delete assistant',
    status: 403,
    errorType: 'permission',
    endpoint: 'delete_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'FORBIDDEN',
    },
  },
  {
    id: 'permission-update-assistant',
    description: 'Forbidden update assistant',
    status: 403,
    errorType: 'permission',
    endpoint: 'update_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'FORBIDDEN',
    },
  },

  // Not found errors (404)
  {
    id: 'notfound-get-assistant',
    description: 'Assistant not found',
    status: 404,
    errorType: 'not_found',
    endpoint: 'get_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'NOT_FOUND',
    },
  },
  {
    id: 'notfound-delete-assistant',
    description: 'Delete non-existent assistant',
    status: 404,
    errorType: 'not_found',
    endpoint: 'delete_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'NOT_FOUND',
    },
  },

  // Conflict errors (409)
  {
    id: 'conflict-create-secret',
    description: 'Secret name already exists',
    status: 409,
    errorType: 'conflict',
    endpoint: 'create_secret',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'CONFLICT',
    },
  },

  // Unprocessable entity (422)
  {
    id: 'unprocessable-create-assistant',
    description: 'Unprocessable assistant data',
    status: 422,
    errorType: 'validation',
    endpoint: 'create_assistant',
    expected: {
      shouldRetry: false,
      isUserError: true,
      isServerError: false,
      errorCode: 'VALIDATION_ERROR',
    },
  },

  // Rate limit errors (429)
  {
    id: 'ratelimit-send-chat',
    description: 'Chat rate limited',
    status: 429,
    errorType: 'rate_limit',
    endpoint: 'send_chat',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: false,
      errorCode: 'RATE_LIMITED',
    },
  },
  {
    id: 'ratelimit-create-assistant',
    description: 'Create assistant rate limited',
    status: 429,
    errorType: 'rate_limit',
    endpoint: 'create_assistant',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: false,
      errorCode: 'RATE_LIMITED',
    },
  },

  // Server errors (500)
  {
    id: 'server-list-assistants',
    description: 'Server error on list',
    status: 500,
    errorType: 'server',
    endpoint: 'list_assistants',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: true,
      errorCode: 'INTERNAL_ERROR',
    },
  },
  {
    id: 'server-send-chat',
    description: 'Server error on chat',
    status: 500,
    errorType: 'server',
    endpoint: 'send_chat',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: true,
      errorCode: 'INTERNAL_ERROR',
    },
  },

  // Bad gateway (502)
  {
    id: 'badgateway-list-assistants',
    description: 'Bad gateway on list',
    status: 502,
    errorType: 'server',
    endpoint: 'list_assistants',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: true,
      errorCode: 'BAD_GATEWAY',
    },
  },

  // Service unavailable (503)
  {
    id: 'unavailable-send-chat',
    description: 'Service unavailable on chat',
    status: 503,
    errorType: 'server',
    endpoint: 'send_chat',
    expected: {
      shouldRetry: true,
      isUserError: false,
      isServerError: true,
      errorCode: 'SERVICE_UNAVAILABLE',
    },
  },
];

// =============================================================================
// ERROR HANDLING UTILITIES (simulating production error handling)
// =============================================================================

function getErrorCodeForStatus(status: HttpStatus): string {
  const codes: Record<HttpStatus, string> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codes[status];
}

function shouldRetry(status: HttpStatus): boolean {
  return status === 429 || status >= 500;
}

function isUserError(status: HttpStatus): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

function isServerError(status: HttpStatus): boolean {
  return status >= 500;
}

function getEndpointPath(endpoint: Endpoint): string {
  const paths: Record<Endpoint, string> = {
    list_assistants: '/api/assistants',
    get_assistant: '/api/assistants/:id',
    create_assistant: '/api/assistants',
    update_assistant: '/api/assistants/:id',
    delete_assistant: '/api/assistants/:id',
    send_chat: '/api/assistants/:id/chat',
    list_secrets: '/api/assistants/:id/secrets',
    create_secret: '/api/assistants/:id/secrets',
  };
  return paths[endpoint];
}

function getEndpointMethod(endpoint: Endpoint): string {
  const methods: Record<Endpoint, string> = {
    list_assistants: 'GET',
    get_assistant: 'GET',
    create_assistant: 'POST',
    update_assistant: 'PATCH',
    delete_assistant: 'DELETE',
    send_chat: 'POST',
    list_secrets: 'GET',
    create_secret: 'POST',
  };
  return methods[endpoint];
}

// =============================================================================
// MATRIX TESTS (using defineNodeMatrixTests)
// =============================================================================

defineNodeMatrixTests<ErrorScenario>({
  name: 'API Errors Matrix',
  concurrent: true,

  getMatrix: () => ERROR_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    it(`error code should be ${scenario.expected.errorCode}`, () => {
      expect(getErrorCodeForStatus(scenario.status)).toBe(scenario.expected.errorCode);
    });

    it(`shouldRetry should be ${scenario.expected.shouldRetry}`, () => {
      expect(shouldRetry(scenario.status)).toBe(scenario.expected.shouldRetry);
    });

    it(`isUserError should be ${scenario.expected.isUserError}`, () => {
      expect(isUserError(scenario.status)).toBe(scenario.expected.isUserError);
    });

    it(`isServerError should be ${scenario.expected.isServerError}`, () => {
      expect(isServerError(scenario.status)).toBe(scenario.expected.isServerError);
    });
  },
});

// =============================================================================
// ENDPOINT CONFIGURATION TESTS
// =============================================================================

defineNodeMatrixTests<ErrorScenario>({
  name: 'API Errors Matrix - Endpoint Configs',
  concurrent: true,

  getMatrix: () => ERROR_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.endpoint}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    it(`endpoint ${scenario.endpoint} should have valid path`, () => {
      const path = getEndpointPath(scenario.endpoint);
      expect(path).toBeDefined();
      expect(path.startsWith('/api/')).toBe(true);
    });

    it(`endpoint ${scenario.endpoint} should have valid HTTP method`, () => {
      const method = getEndpointMethod(scenario.endpoint);
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(method);
    });
  },
});

// =============================================================================
// INVARIANT TESTS
// =============================================================================

describe('API Errors Matrix - Invariants', () => {
  it('user errors and server errors should be mutually exclusive', () => {
    ERROR_MATRIX.forEach((scenario) => {
      const userError = isUserError(scenario.status);
      const serverError = isServerError(scenario.status);

      // They should never both be true
      expect(userError && serverError).toBe(false);
    });
  });

  it('4xx errors (except 429) should not be retryable', () => {
    ERROR_MATRIX.filter((s) => s.status >= 400 && s.status < 500 && s.status !== 429).forEach(
      (scenario) => {
        expect(shouldRetry(scenario.status)).toBe(false);
      }
    );
  });

  it('5xx errors should always be retryable', () => {
    ERROR_MATRIX.filter((s) => s.status >= 500).forEach((scenario) => {
      expect(shouldRetry(scenario.status)).toBe(true);
    });
  });

  it('429 rate limit should be retryable but not a user error', () => {
    ERROR_MATRIX.filter((s) => s.status === 429).forEach((scenario) => {
      expect(shouldRetry(scenario.status)).toBe(true);
      expect(isUserError(scenario.status)).toBe(false);
      expect(isServerError(scenario.status)).toBe(false);
    });
  });

  it('all error codes should be consistent with status', () => {
    ERROR_MATRIX.forEach((scenario) => {
      expect(scenario.expected.errorCode).toBe(getErrorCodeForStatus(scenario.status));
    });
  });

  it('endpoint paths should follow REST conventions', () => {
    const endpoints: Endpoint[] = [
      'list_assistants',
      'get_assistant',
      'create_assistant',
      'update_assistant',
      'delete_assistant',
      'send_chat',
      'list_secrets',
      'create_secret',
    ];

    endpoints.forEach((endpoint) => {
      const path = getEndpointPath(endpoint);
      const method = getEndpointMethod(endpoint);

      // List endpoints should be GET with plural paths
      if (endpoint.startsWith('list_')) {
        expect(method).toBe('GET');
      }

      // Create endpoints should be POST
      if (endpoint.startsWith('create_')) {
        expect(method).toBe('POST');
      }

      // Delete endpoints should be DELETE
      if (endpoint.startsWith('delete_')) {
        expect(method).toBe('DELETE');
      }

      // Update endpoints should be PATCH or PUT
      if (endpoint.startsWith('update_')) {
        expect(['PATCH', 'PUT']).toContain(method);
      }
    });
  });
});
