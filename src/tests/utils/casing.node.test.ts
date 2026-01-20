import { describe, it, expect } from 'vitest';
import {
  snakeToCamel,
  camelToSnake,
  snakeToCamelObject,
  camelToSnakeObject,
  transformKeys,
  transformSpecificKeys,
} from '@/utils/casing';

describe('casing utilities', () => {
  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('user_id')).toBe('userId');
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('role_name')).toBe('roleName');
    });

    it('handles multiple underscores', () => {
      expect(snakeToCamel('user_first_name')).toBe('userFirstName');
      expect(snakeToCamel('stripe_customer_id')).toBe('stripeCustomerId');
    });

    it('leaves already camelCase strings unchanged', () => {
      expect(snakeToCamel('userId')).toBe('userId');
      expect(snakeToCamel('createdAt')).toBe('createdAt');
    });

    it('handles strings without underscores', () => {
      expect(snakeToCamel('id')).toBe('id');
      expect(snakeToCamel('name')).toBe('name');
    });

    it('handles empty string', () => {
      expect(snakeToCamel('')).toBe('');
    });

    it('preserves leading underscores for private fields', () => {
      // Single leading underscore (Unity/Orchestra private fields)
      expect(snakeToCamel('_user')).toBe('_user');
      expect(snakeToCamel('_user_id')).toBe('_userId');
      expect(snakeToCamel('_assistant_id')).toBe('_assistantId');
    });

    it('preserves multiple leading underscores', () => {
      // Python-style "dunder" or other multi-underscore prefixes
      expect(snakeToCamel('__private')).toBe('__private');
      expect(snakeToCamel('__private_field')).toBe('__privateField');
    });
  });

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('userId')).toBe('user_id');
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('roleName')).toBe('role_name');
    });

    it('handles multiple capital letters', () => {
      expect(camelToSnake('userFirstName')).toBe('user_first_name');
      expect(camelToSnake('stripeCustomerId')).toBe('stripe_customer_id');
    });

    it('leaves already snake_case strings unchanged', () => {
      expect(camelToSnake('user_id')).toBe('user_id');
      expect(camelToSnake('created_at')).toBe('created_at');
    });

    it('handles strings without capitals', () => {
      expect(camelToSnake('id')).toBe('id');
      expect(camelToSnake('name')).toBe('name');
    });

    it('handles empty string', () => {
      expect(camelToSnake('')).toBe('');
    });

    it('preserves leading underscores for private fields', () => {
      // Single leading underscore (Unity/Orchestra private fields)
      expect(camelToSnake('_user')).toBe('_user');
      expect(camelToSnake('_userId')).toBe('_user_id');
      expect(camelToSnake('_assistantId')).toBe('_assistant_id');
    });

    it('preserves multiple leading underscores', () => {
      expect(camelToSnake('__private')).toBe('__private');
      expect(camelToSnake('__privateField')).toBe('__private_field');
    });
  });

  describe('snakeToCamelObject', () => {
    it('transforms flat object keys', () => {
      const input = { user_id: '123', created_at: '2024-01-01', name: 'Test' };
      const expected = { userId: '123', createdAt: '2024-01-01', name: 'Test' };
      expect(snakeToCamelObject(input)).toEqual(expected);
    });

    it('transforms nested objects', () => {
      const input = {
        user_id: '123',
        organization: {
          org_id: 1,
          role_name: 'admin',
        },
      };
      const expected = {
        userId: '123',
        organization: {
          orgId: 1,
          roleName: 'admin',
        },
      };
      expect(snakeToCamelObject(input)).toEqual(expected);
    });

    it('transforms arrays of objects', () => {
      const input = {
        users: [
          { user_id: '1', first_name: 'Alice' },
          { user_id: '2', first_name: 'Bob' },
        ],
      };
      const expected = {
        users: [
          { userId: '1', firstName: 'Alice' },
          { userId: '2', firstName: 'Bob' },
        ],
      };
      expect(snakeToCamelObject(input)).toEqual(expected);
    });

    it('handles null and undefined values', () => {
      const input = { user_id: null, phone_number: undefined };
      const expected = { userId: null, phoneNumber: undefined };
      expect(snakeToCamelObject(input)).toEqual(expected);
    });

    it('preserves primitive arrays', () => {
      const input = { tag_ids: [1, 2, 3], names: ['a', 'b'] };
      const expected = { tagIds: [1, 2, 3], names: ['a', 'b'] };
      expect(snakeToCamelObject(input)).toEqual(expected);
    });

    it('handles Date objects without transforming them', () => {
      const date = new Date('2024-01-01');
      const input = { created_at: date };
      const result = snakeToCamelObject<{ createdAt: Date }>(input);
      expect(result.createdAt).toBe(date);
    });

    it('returns primitives as-is', () => {
      expect(snakeToCamelObject(null)).toBe(null);
      expect(snakeToCamelObject(undefined)).toBe(undefined);
      expect(snakeToCamelObject('string')).toBe('string');
      expect(snakeToCamelObject(123)).toBe(123);
      expect(snakeToCamelObject(true)).toBe(true);
    });

    it('preserves leading underscores in private fields', () => {
      // Unity/Orchestra private fields start with underscore
      /* eslint-disable @typescript-eslint/naming-convention */
      const input = {
        _user: 'JohnDoe',
        _user_id: 'user-123',
        _assistant: 'AdaLovelace',
        _assistant_id: 'asst-456',
        regular_field: 'value',
      };
      const expected = {
        _user: 'JohnDoe',
        _userId: 'user-123',
        _assistant: 'AdaLovelace',
        _assistantId: 'asst-456',
        regularField: 'value',
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      expect(snakeToCamelObject(input)).toEqual(expected);
    });
  });

  describe('camelToSnakeObject', () => {
    it('transforms flat object keys', () => {
      const input = { userId: '123', createdAt: '2024-01-01', name: 'Test' };
      const expected = { user_id: '123', created_at: '2024-01-01', name: 'Test' };
      expect(camelToSnakeObject(input)).toEqual(expected);
    });

    it('transforms nested objects', () => {
      const input = {
        userId: '123',
        organization: {
          orgId: 1,
          roleName: 'admin',
        },
      };
      const expected = {
        user_id: '123',
        organization: {
          org_id: 1,
          role_name: 'admin',
        },
      };
      expect(camelToSnakeObject(input)).toEqual(expected);
    });

    it('transforms arrays of objects', () => {
      const input = {
        users: [
          { userId: '1', firstName: 'Alice' },
          { userId: '2', firstName: 'Bob' },
        ],
      };
      const expected = {
        users: [
          { user_id: '1', first_name: 'Alice' },
          { user_id: '2', first_name: 'Bob' },
        ],
      };
      expect(camelToSnakeObject(input)).toEqual(expected);
    });
  });

  describe('transformKeys', () => {
    it('applies custom transformer function', () => {
      const input = { a: 1, b: 2 };
      const result = transformKeys(input, (key) => key.toUpperCase());
      expect(result).toEqual({ A: 1, B: 2 });
    });
  });

  describe('transformSpecificKeys', () => {
    it('only transforms specified keys', () => {
      const input = { userId: '123', roleName: 'admin', status: 'active' };
      const result = transformSpecificKeys(input, ['userId', 'roleName'], snakeToCamel);
      expect(result).toEqual({ userId: '123', roleName: 'admin', status: 'active' });
    });

    it('leaves unspecified keys unchanged', () => {
      const input = { userId: '123', already_correct: 'value' };
      const result = transformSpecificKeys(input, ['userId'], snakeToCamel);
      expect(result).toEqual({ userId: '123', already_correct: 'value' });
    });
  });
});
