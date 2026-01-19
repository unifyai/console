/**
 * Context Path Tests
 *
 * Tests for LLM events context path utilities.
 * The usage page now uses a simplified approach with a single context path.
 */

import { describe, it, expect } from 'vitest';
import { LLM_EVENTS_CONTEXT, getLLMEventsContext, isValidContextPath } from '@/lib/usage/context';

describe('context', () => {
  describe('LLM_EVENTS_CONTEXT', () => {
    it('has the correct value', () => {
      expect(LLM_EVENTS_CONTEXT).toBe('All/Events/LLM');
    });
  });

  describe('getLLMEventsContext', () => {
    it('returns the standard LLM events context path', () => {
      const result = getLLMEventsContext();
      expect(result).toBe('All/Events/LLM');
    });

    it('always returns the same value', () => {
      expect(getLLMEventsContext()).toBe(getLLMEventsContext());
    });
  });

  describe('isValidContextPath', () => {
    it('returns true for valid org context', () => {
      expect(isValidContextPath('All/Events/LLM')).toBe(true);
    });

    it('returns true for valid user context (legacy)', () => {
      expect(isValidContextPath('JohnDoe/All/Events/LLM')).toBe(true);
    });

    it('returns true for valid assistant context (legacy)', () => {
      expect(isValidContextPath('JohnDoe/MyAssistant/Events/LLM')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isValidContextPath('')).toBe(false);
    });

    it('returns false for whitespace only', () => {
      expect(isValidContextPath('   ')).toBe(false);
    });

    it('returns false for path without LLM events suffix', () => {
      expect(isValidContextPath('All/Events/Tasks')).toBe(false);
    });

    it('returns false for path with empty segments', () => {
      expect(isValidContextPath('All//Events/LLM')).toBe(false);
    });

    it('returns false for path with trailing slash', () => {
      expect(isValidContextPath('All/Events/LLM/')).toBe(false);
    });
  });
});
