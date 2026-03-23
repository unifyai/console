/**
 * Unit tests for src/utils/assistants/api-utils.ts
 *
 * @group unit
 */

import { describe, it, expect } from 'vitest';
import { getAdaptersPrefix } from '@/utils/assistants/api-utils';

describe('getAdaptersPrefix', () => {
  it(
    'returns "preview-" when deployEnv is "preview"',
    {
      meta: {
        alias: 'AdaptersPrefix-Preview',
        scenario: 'deploy_env is "preview"',
        behavior: 'Returns "preview-" regardless of isStaging',
      },
    },
    () => {
      expect(getAdaptersPrefix('preview', false)).toBe('preview-');
      expect(getAdaptersPrefix('preview', true)).toBe('preview-');
    }
  );

  it(
    'returns "staging-" when isStaging is true and no deployEnv override',
    {
      meta: {
        alias: 'AdaptersPrefix-Staging',
        scenario: 'No deploy_env, staging environment',
        behavior: 'Returns "staging-"',
      },
    },
    () => {
      expect(getAdaptersPrefix(undefined, true)).toBe('staging-');
      expect(getAdaptersPrefix(null, true)).toBe('staging-');
    }
  );

  it(
    'returns "" for production (no deployEnv, not staging)',
    {
      meta: {
        alias: 'AdaptersPrefix-Production',
        scenario: 'No deploy_env, production environment',
        behavior: 'Returns empty string',
      },
    },
    () => {
      expect(getAdaptersPrefix(undefined, false)).toBe('');
      expect(getAdaptersPrefix(null, false)).toBe('');
    }
  );

  it(
    'returns "" when both deployEnv and isStaging are unset',
    {
      meta: {
        alias: 'AdaptersPrefix-Defaults',
        scenario: 'No arguments provided',
        behavior: 'Returns empty string (production default)',
      },
    },
    () => {
      expect(getAdaptersPrefix()).toBe('');
    }
  );
});
