/**
 * Unit tests for src/lib/assistants/system-errors.ts
 *
 * Tests the system error classification, friendly copy generation,
 * and payload parsing utilities.
 *
 * @group unit
 */

import { describe, it, expect } from 'vitest';
import {
  classifySystemError,
  getFriendlyErrorCopy,
  parseSystemErrorPayload,
  DEDUP_WINDOW_MS,
  type SystemErrorType,
} from '@/utils/assistants/system-errors';

// =============================================================================
// classifySystemError
// =============================================================================

describe('classifySystemError', () => {
  it(
    'classifies OOM errors',
    {
      meta: {
        alias: 'Classify-OOM',
        scenario: 'Unity publishes an out-of-memory error',
        behavior: 'Returns "oom" error type',
      },
    },
    () => {
      expect(
        classifySystemError('The assistant ran out of memory. Please wait a moment and try again.')
      ).toBe('oom');
    }
  );

  it(
    'classifies startup failures',
    {
      meta: {
        alias: 'Classify-StartupFailed',
        scenario: 'Unity publishes a startup failure error',
        behavior: 'Returns "startup_failed" error type',
      },
    },
    () => {
      expect(
        classifySystemError('The assistant failed to start up. Please try again shortly.')
      ).toBe('startup_failed');
    }
  );

  it(
    'classifies initialization failures',
    {
      meta: {
        alias: 'Classify-InitFailed',
        scenario: 'Unity publishes an initialization failure error',
        behavior: 'Returns "init_failed" error type',
      },
    },
    () => {
      expect(
        classifySystemError(
          'The assistant failed to initialize and may not respond correctly. Please try again shortly.'
        )
      ).toBe('init_failed');
    }
  );

  it(
    'classifies message processing failures',
    {
      meta: {
        alias: 'Classify-MessageFailed',
        scenario: 'Unity publishes a message processing error',
        behavior: 'Returns "message_failed" error type',
      },
    },
    () => {
      expect(
        classifySystemError(
          'An internal error occurred while processing a message. The assistant may not have received your last message.'
        )
      ).toBe('message_failed');
    }
  );

  it(
    'classifies recovery attempts',
    {
      meta: {
        alias: 'Classify-Recovering',
        scenario: 'Unity publishes a recovery error',
        behavior: 'Returns "recovering" error type',
      },
    },
    () => {
      expect(
        classifySystemError('An unexpected error occurred. The assistant is attempting to recover.')
      ).toBe('recovering');
    }
  );

  it(
    'returns "unknown" for unrecognized messages',
    {
      meta: {
        alias: 'Classify-Unknown',
        scenario: 'Future Unity error message with new wording',
        behavior: 'Falls back to "unknown" gracefully',
      },
    },
    () => {
      expect(classifySystemError('Something entirely new went wrong.')).toBe('unknown');
    }
  );

  it(
    'classification is case-insensitive',
    {
      meta: {
        alias: 'Classify-CaseInsensitive',
        scenario: 'Error message has mixed casing',
        behavior: 'Still classifies correctly',
      },
    },
    () => {
      expect(classifySystemError('The Assistant RAN OUT OF MEMORY.')).toBe('oom');
    }
  );
});

// =============================================================================
// getFriendlyErrorCopy
// =============================================================================

describe('getFriendlyErrorCopy', () => {
  it(
    'substitutes assistant name into title',
    {
      meta: {
        alias: 'FriendlyCopy-NameSubstitution',
        scenario: 'OOM error for assistant named Ada',
        behavior: 'Title contains "Ada"',
      },
    },
    () => {
      const { title, detail } = getFriendlyErrorCopy('oom', 'Ada');
      expect(title).toContain('Ada');
      expect(title).toContain('restart');
      expect(detail).toBeTruthy();
    }
  );

  it(
    'returns non-empty copy for every error type',
    {
      meta: {
        alias: 'FriendlyCopy-AllTypes',
        scenario: 'All defined error types',
        behavior: 'Every type has non-empty title and detail',
      },
    },
    () => {
      const types: SystemErrorType[] = [
        'message_failed',
        'recovering',
        'startup_failed',
        'init_failed',
        'oom',
        'unknown',
      ];

      for (const type of types) {
        const { title, detail } = getFriendlyErrorCopy(type, 'TestBot');
        expect(title.length).toBeGreaterThan(0);
        expect(detail.length).toBeGreaterThan(0);
        expect(title).toContain('TestBot');
      }
    }
  );

  it(
    'message_failed copy suggests resending',
    {
      meta: {
        alias: 'FriendlyCopy-MessageFailed',
        scenario: 'Message processing failure',
        behavior: 'Detail mentions sending again',
      },
    },
    () => {
      const { title, detail } = getFriendlyErrorCopy('message_failed', 'Bob');
      expect(title).toContain('may not have received');
      expect(detail.toLowerCase()).toContain('send');
    }
  );
});

// =============================================================================
// parseSystemErrorPayload
// =============================================================================

describe('parseSystemErrorPayload', () => {
  it(
    'parses a valid system error payload',
    {
      meta: {
        alias: 'Parse-Valid',
        scenario: 'Standard Unity system error payload',
        behavior: 'Returns classified SystemError',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        event: { content: 'The assistant ran out of memory. Please wait.' },
      };
      const result = parseSystemErrorPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('oom');
      expect(result!.rawMessage).toContain('ran out of memory');
      expect(result!.timestamp).toBeInstanceOf(Date);
    }
  );

  it(
    'returns null for non-system-error thread',
    {
      meta: {
        alias: 'Parse-WrongThread',
        scenario: 'Payload with a different thread type',
        behavior: 'Returns null',
      },
    },
    () => {
      const payload = {
        thread: 'unify_message_outbound',
        event: { content: 'Hello!' },
      };
      expect(parseSystemErrorPayload(payload)).toBeNull();
    }
  );

  it(
    'returns null when content is empty',
    {
      meta: {
        alias: 'Parse-EmptyContent',
        scenario: 'System error payload with no content string',
        behavior: 'Returns null',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        event: {},
      };
      expect(parseSystemErrorPayload(payload)).toBeNull();
    }
  );

  it(
    'handles content at top level (fallback)',
    {
      meta: {
        alias: 'Parse-TopLevelContent',
        scenario: 'Content is on the payload root instead of event.content',
        behavior: 'Still parses correctly',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        content: 'The assistant failed to start up. Please try again shortly.',
      };
      const result = parseSystemErrorPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('startup_failed');
    }
  );

  it(
    'returns null when thread is missing',
    {
      meta: {
        alias: 'Parse-NoThread',
        scenario: 'Payload without a thread field',
        behavior: 'Returns null',
      },
    },
    () => {
      const payload = { event: { content: 'Some error' } };
      expect(parseSystemErrorPayload(payload)).toBeNull();
    }
  );

  it(
    'prefers structured error_type over substring classification',
    {
      meta: {
        alias: 'Parse-StructuredType',
        scenario: 'Unity includes error_type in event payload',
        behavior: 'Uses error_type directly instead of classifying from content',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        event: {
          content: 'Something generic happened.',
          error_type: 'oom',
        },
      };
      const result = parseSystemErrorPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('oom');
    }
  );

  it(
    'falls back to classification when error_type is invalid',
    {
      meta: {
        alias: 'Parse-InvalidType',
        scenario: 'Unity sends an unrecognized error_type value',
        behavior: 'Falls back to substring classification',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        event: {
          content: 'The assistant ran out of memory.',
          error_type: 'nonexistent_type',
        },
      };
      const result = parseSystemErrorPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('oom');
    }
  );

  it(
    'falls back to classification when error_type is absent (old Unity)',
    {
      meta: {
        alias: 'Parse-MissingType',
        scenario: 'Payload from older Unity deployment without error_type',
        behavior: 'Uses substring classification as before',
      },
    },
    () => {
      const payload = {
        thread: 'system_error',
        event: { content: 'The assistant failed to start up. Please try again shortly.' },
      };
      const result = parseSystemErrorPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('startup_failed');
    }
  );
});

// =============================================================================
// Constants
// =============================================================================

describe('constants', () => {
  it(
    'DEDUP_WINDOW_MS is a positive number',
    {
      meta: {
        alias: 'Constants-DedupWindow',
        scenario: 'Dedup window is configured',
        behavior: 'Positive millisecond value',
      },
    },
    () => {
      expect(DEDUP_WINDOW_MS).toBeGreaterThan(0);
    }
  );
});
