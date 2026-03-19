/**
 * Tests for the in-memory API key cache used by getApiKeyFromRequest().
 *
 * Covers:
 * - Cache population and retrieval
 * - TTL-based expiry
 * - Workspace resolution: personal, org cookie, header override, non-Unify lock
 * - Cache invalidation
 * - Stale entry eviction
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  populateApiKeyCache,
  resolveApiKeyFromCache,
  invalidateApiKeyCache,
  clearApiKeyCache,
  getApiKeyCacheSize,
  CACHE_TTL_MS,
} from '@/app/api/_utils/api-key-cache';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMAIL = 'user@example.com';
const PERSONAL_KEY = 'key-personal-abc';
const ORG_1 = { id: 10, name: 'Acme Corp', apiKey: 'key-org-10', ownerId: 'owner-1', roleId: 2, roleName: 'member' };
const ORG_2 = { id: 20, name: 'Other Inc', apiKey: 'key-org-20', ownerId: 'owner-2', roleId: 2, roleName: 'member' };
const ORG_UNIFY = { id: 99, name: 'Unify', apiKey: 'key-unify-99', ownerId: 'owner-u', roleId: 2, roleName: 'member' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function populateWithOrgs(orgs: typeof ORG_1[]) {
  populateApiKeyCache(EMAIL, PERSONAL_KEY, orgs as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('api-key-cache', () => {
  beforeEach(() => {
    clearApiKeyCache();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Basic population & retrieval
  // =========================================================================

  describe('populateApiKeyCache + resolveApiKeyFromCache', () => {
    it('returns null on cache miss', () => {
      const result = resolveApiKeyFromCache('nobody@example.com', undefined, null);
      expect(result).toBeNull();
    });

    it('returns personal key when no workspace cookie is set', () => {
      populateWithOrgs([]);
      const result = resolveApiKeyFromCache(EMAIL, undefined, null);
      expect(result).toBe(PERSONAL_KEY);
    });

    it('returns personal key for explicit personal workspace', () => {
      populateWithOrgs([ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, 'personal', null);
      expect(result).toBe(PERSONAL_KEY);
    });

    it('returns org key when workspace cookie matches an org (Unify member)', () => {
      populateWithOrgs([ORG_1, ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, '10', null);
      expect(result).toBe(ORG_1.apiKey);
    });

    it('returns second org key for a different workspace cookie (Unify member)', () => {
      populateWithOrgs([ORG_1, ORG_2, ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, '20', null);
      expect(result).toBe(ORG_2.apiKey);
    });

    it('handles undefined organizations gracefully', () => {
      populateApiKeyCache(EMAIL, PERSONAL_KEY, undefined);
      const result = resolveApiKeyFromCache(EMAIL, undefined, null);
      expect(result).toBe(PERSONAL_KEY);
    });
  });

  // =========================================================================
  // TTL expiry
  // =========================================================================

  describe('TTL expiry', () => {
    it('returns null after TTL expires', () => {
      populateWithOrgs([]);

      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(Date.now()) // first call in resolveApiKeyFromCache
        .mockReturnValueOnce(Date.now()); // any subsequent calls

      // Entry is fresh
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBe(PERSONAL_KEY);

      vi.restoreAllMocks();

      // Simulate time passing beyond TTL
      const originalNow = Date.now;
      const futureTime = originalNow() + CACHE_TTL_MS + 1;
      vi.spyOn(Date, 'now').mockReturnValue(futureTime);

      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBeNull();
      expect(getApiKeyCacheSize()).toBe(0);
    });

    it('returns value within TTL window', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      populateWithOrgs([]);

      // Advance time but stay within TTL
      vi.spyOn(Date, 'now').mockReturnValue(now + CACHE_TTL_MS - 1000);
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBe(PERSONAL_KEY);
    });
  });

  // =========================================================================
  // Workspace resolution — header API key override
  // =========================================================================

  describe('header API key override', () => {
    it('returns header key when it matches the personal key', () => {
      populateWithOrgs([ORG_1]);
      const result = resolveApiKeyFromCache(EMAIL, '10', PERSONAL_KEY);
      expect(result).toBe(PERSONAL_KEY);
    });

    it('returns header key when it matches an org key', () => {
      populateWithOrgs([ORG_1, ORG_2]);
      const result = resolveApiKeyFromCache(EMAIL, undefined, ORG_2.apiKey);
      expect(result).toBe(ORG_2.apiKey);
    });

    it('ignores header key that does not match any known key and uses cookie', () => {
      populateWithOrgs([ORG_1]);
      const result = resolveApiKeyFromCache(EMAIL, '10', 'key-unknown');
      expect(result).toBe(ORG_1.apiKey);
    });
  });

  // =========================================================================
  // Non-Unify org member lock
  // =========================================================================

  describe('non-Unify org member lock', () => {
    it('forces first org key for non-Unify members with no workspace cookie', () => {
      populateWithOrgs([ORG_1, ORG_2]);
      const result = resolveApiKeyFromCache(EMAIL, undefined, null);
      expect(result).toBe(ORG_1.apiKey);
    });

    it('forces first org key for non-Unify members with personal workspace cookie', () => {
      populateWithOrgs([ORG_1]);
      const result = resolveApiKeyFromCache(EMAIL, 'personal', null);
      expect(result).toBe(ORG_1.apiKey);
    });

    it('forces first org key even when cookie points to a different org', () => {
      populateWithOrgs([ORG_1, ORG_2]);
      // Cookie says ORG_2, but non-Unify lock forces ORG_1 (organizations[0])
      const result = resolveApiKeyFromCache(EMAIL, '20', null);
      expect(result).toBe(ORG_1.apiKey);
    });

    it('does NOT force org key for Unify members', () => {
      populateWithOrgs([ORG_1, ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, undefined, null);
      expect(result).toBe(PERSONAL_KEY);
    });

    it('does NOT force org key for Unify members on personal workspace', () => {
      populateWithOrgs([ORG_1, ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, 'personal', null);
      expect(result).toBe(PERSONAL_KEY);
    });

    it('does NOT apply org lock when header API key is set', () => {
      populateWithOrgs([ORG_1]);
      const result = resolveApiKeyFromCache(EMAIL, undefined, PERSONAL_KEY);
      expect(result).toBe(PERSONAL_KEY);
    });
  });

  // =========================================================================
  // Workspace cookie referencing unknown org
  // =========================================================================

  describe('unknown org in workspace cookie', () => {
    it('falls back to org lock logic when cookie references non-existent org', () => {
      populateWithOrgs([ORG_1]);
      const result = resolveApiKeyFromCache(EMAIL, '999', null);
      // Non-Unify member with orgs → locked to first org
      expect(result).toBe(ORG_1.apiKey);
    });

    it('falls back to personal key for Unify members when cookie references non-existent org', () => {
      populateWithOrgs([ORG_UNIFY]);
      const result = resolveApiKeyFromCache(EMAIL, '999', null);
      expect(result).toBe(PERSONAL_KEY);
    });
  });

  // =========================================================================
  // Cache invalidation
  // =========================================================================

  describe('invalidateApiKeyCache', () => {
    it('removes entries for a specific email', () => {
      populateWithOrgs([]);
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBe(PERSONAL_KEY);

      invalidateApiKeyCache(EMAIL);
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBeNull();
    });

    it('does not affect other emails', () => {
      populateWithOrgs([]);
      populateApiKeyCache('other@example.com', 'key-other', []);

      invalidateApiKeyCache(EMAIL);
      expect(resolveApiKeyFromCache('other@example.com', undefined, null)).toBe('key-other');
    });
  });

  // =========================================================================
  // clearApiKeyCache
  // =========================================================================

  describe('clearApiKeyCache', () => {
    it('removes all entries', () => {
      populateWithOrgs([]);
      populateApiKeyCache('a@b.com', 'key-a', []);
      populateApiKeyCache('c@d.com', 'key-c', []);
      expect(getApiKeyCacheSize()).toBe(3);

      clearApiKeyCache();
      expect(getApiKeyCacheSize()).toBe(0);
    });
  });

  // =========================================================================
  // Overwriting existing entry
  // =========================================================================

  describe('cache overwrite', () => {
    it('replaces the entry when populated again', () => {
      populateApiKeyCache(EMAIL, 'old-key', []);
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBe('old-key');

      populateApiKeyCache(EMAIL, 'new-key', []);
      expect(resolveApiKeyFromCache(EMAIL, undefined, null)).toBe('new-key');
    });

    it('updates org keys on re-population', () => {
      populateWithOrgs([ORG_1]);
      expect(resolveApiKeyFromCache(EMAIL, '10', null)).toBe(ORG_1.apiKey);

      // Replace orgs: ORG_1 removed, ORG_2 added
      populateApiKeyCache(EMAIL, PERSONAL_KEY, [ORG_2] as any);

      // Old org workspace cookie falls through to org-lock (non-Unify → first org)
      expect(resolveApiKeyFromCache(EMAIL, '10', null)).toBe(ORG_2.apiKey);
      // New org workspace cookie works
      expect(resolveApiKeyFromCache(EMAIL, '20', null)).toBe(ORG_2.apiKey);
    });
  });
});
