import { describe, it, expect } from 'vitest';
import {
  contextExistsInAvailableContexts,
  isEffectiveContextNotFound,
} from '@/utils/interfaces/contextValidation';
import type { Context } from '@/types/interfaces/grid';

// Helper to create mock contexts
const createContext = (name: string): Context => ({ name, description: '' });

describe('contextValidation', () => {
  describe('contextExistsInAvailableContexts', () => {
    it('returns true when context is null or undefined', () => {
      const contexts = [createContext('project/context1')];
      expect(contextExistsInAvailableContexts(null, contexts)).toBe(true);
      expect(contextExistsInAvailableContexts(undefined, contexts)).toBe(true);
    });

    it('returns true when availableContexts is empty (not loaded yet)', () => {
      expect(contextExistsInAvailableContexts('some/context', [])).toBe(true);
    });

    it('returns true when context matches exactly', () => {
      const contexts = [createContext('project/context1'), createContext('project/context2')];
      expect(contextExistsInAvailableContexts('project/context1', contexts)).toBe(true);
    });

    it('returns true when context is a prefix of an available context', () => {
      const contexts = [
        createContext('project/context1/subcontext'),
        createContext('project/context2'),
      ];
      expect(contextExistsInAvailableContexts('project/context1', contexts)).toBe(true);
    });

    it('returns false when context does not exist (deleted context scenario)', () => {
      const contexts = [createContext('project/context1'), createContext('project/context2')];
      expect(contextExistsInAvailableContexts('project/deleted-context', contexts)).toBe(false);
    });

    it('returns false when context is similar but not a match or prefix', () => {
      const contexts = [createContext('project/context1'), createContext('project/context10')];
      // 'project/context1' should NOT match 'project/context10'
      // because we check for exact match or prefix with '/'
      expect(contextExistsInAvailableContexts('project/context1', contexts)).toBe(true);
      // But 'project/context' should not match 'project/context1' as a prefix
      // because 'project/context1' doesn't start with 'project/context/'
      expect(contextExistsInAvailableContexts('project/context', contexts)).toBe(false);
    });
  });

  describe('isEffectiveContextNotFound', () => {
    const availableContexts = [
      createContext('project/context1'),
      createContext('project/context2'),
    ];

    it('returns true when API explicitly says contextNotFound', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: true,
          context: 'project/context1', // Even if context exists
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(true);
    });

    it('returns false when contexts are still loading', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: false,
          context: 'project/deleted-context',
          availableContexts: [], // No contexts loaded yet
          isLoadingContexts: true,
        })
      ).toBe(false);
    });

    it('returns false when context exists in available contexts', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: false,
          context: 'project/context1',
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(false);
    });

    it('returns true when context does not exist in available contexts (deleted context)', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: false,
          context: 'project/deleted-context',
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(true);
    });

    it('returns false when no context is set', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: false,
          context: null,
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(false);

      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: false,
          context: undefined,
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(false);
    });

    it('handles edge case: apiContextNotFound is undefined', () => {
      expect(
        isEffectiveContextNotFound({
          apiContextNotFound: undefined,
          context: 'project/deleted-context',
          availableContexts,
          isLoadingContexts: false,
        })
      ).toBe(true); // Should detect as not found based on available contexts
    });
  });
});
