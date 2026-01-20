import { describe, it, expect } from 'vitest';
import {
  formatContextName,
  formatUserContext,
  formatAssistantContext,
} from '@/utils/assistants/context-utils';

describe('context-utils', () => {
  describe('formatContextName', () => {
    it('formats simple two-word names', () => {
      expect(formatContextName('John Doe')).toBe('JohnDoe');
      expect(formatContextName('Ada Lovelace')).toBe('AdaLovelace');
    });

    it('handles hyphenated names by lowercasing after first character', () => {
      // Key requirement: "Ji-Yeon Kim" -> "Ji-yeonKim", NOT "Ji-YeonKim"
      expect(formatContextName('Ji-Yeon Kim')).toBe('Ji-yeonKim');
      expect(formatContextName('Mary-Jane Watson')).toBe('Mary-janeWatson');
      expect(formatContextName('Jean-Pierre Dupont')).toBe('Jean-pierreDupont');
    });

    it('lowercases uppercase names correctly', () => {
      expect(formatContextName('JOHN DOE')).toBe('JohnDoe');
      expect(formatContextName('MARY-JANE WATSON')).toBe('Mary-janeWatson');
    });

    it('handles single names', () => {
      expect(formatContextName('Madonna')).toBe('Madonna');
      expect(formatContextName('PRINCE')).toBe('Prince');
    });

    it('handles multiple spaces between words', () => {
      expect(formatContextName('John  Doe')).toBe('JohnDoe');
      expect(formatContextName('  John   Doe  ')).toBe('JohnDoe');
    });

    it('handles three-word names', () => {
      expect(formatContextName('Mary Jane Watson')).toBe('MaryJaneWatson');
      expect(formatContextName('John Paul Jones')).toBe('JohnPaulJones');
    });

    it('handles empty and whitespace-only strings', () => {
      expect(formatContextName('')).toBe('');
      expect(formatContextName('   ')).toBe('');
    });

    it('handles names with mixed case', () => {
      expect(formatContextName('jOHN dOE')).toBe('JohnDoe');
      expect(formatContextName('McLovin')).toBe('Mclovin');
    });
  });

  describe('formatUserContext', () => {
    it('formats user context from first and last name', () => {
      expect(formatUserContext('John', 'Doe')).toBe('JohnDoe');
      expect(formatUserContext('Ji-Yeon', 'Kim')).toBe('Ji-yeonKim');
    });

    it('handles empty last name', () => {
      expect(formatUserContext('John', '')).toBe('John');
    });

    it('handles empty first name', () => {
      expect(formatUserContext('', 'Doe')).toBe('Doe');
    });

    it('handles both empty', () => {
      expect(formatUserContext('', '')).toBe('');
    });
  });

  describe('formatAssistantContext', () => {
    it('formats assistant context from first name and surname', () => {
      expect(formatAssistantContext('Ada', 'Lovelace')).toBe('AdaLovelace');
      expect(formatAssistantContext('Ji-Yeon', 'Kim')).toBe('Ji-yeonKim');
    });

    it('handles hyphenated surnames', () => {
      expect(formatAssistantContext('John', 'Smith-Jones')).toBe('JohnSmith-jones');
    });

    it('handles empty surname', () => {
      expect(formatAssistantContext('Ada', '')).toBe('Ada');
    });

    it('handles empty first name', () => {
      expect(formatAssistantContext('', 'Lovelace')).toBe('Lovelace');
    });
  });
});
