/**
 * Formatters Tests
 *
 * Tests for currency and number formatting functions.
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
  formatCostForDisplay,
  formatPercentage,
  formatNumber,
} from '@/utils/usage/formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats a basic amount with 2 decimal places', () => {
      expect(formatCurrency(123.45)).toBe('$123.45');
    });

    it('adds thousand separators', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });

    it('pads to 2 decimal places', () => {
      expect(formatCurrency(100)).toBe('$100.00');
    });

    it('handles custom decimal places', () => {
      expect(formatCurrency(123.4567, 4)).toBe('$123.4567');
    });

    it('handles custom currency symbol', () => {
      expect(formatCurrency(100, 2, '€')).toBe('€100.00');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles negative numbers', () => {
      expect(formatCurrency(-123.45)).toBe('-$123.45');
    });

    it('handles very small amounts', () => {
      expect(formatCurrency(0.0123, 4)).toBe('$0.0123');
    });

    it('handles NaN', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('handles Infinity', () => {
      expect(formatCurrency(Infinity)).toBe('$0.00');
    });

    it('handles large numbers with thousand separators', () => {
      expect(formatCurrency(1000000000.12)).toBe('$1,000,000,000.12');
    });
  });

  describe('formatCompactCurrency', () => {
    it('formats billions', () => {
      expect(formatCompactCurrency(1500000000)).toBe('$1.5B');
    });

    it('formats millions', () => {
      expect(formatCompactCurrency(2500000)).toBe('$2.5M');
    });

    it('formats thousands', () => {
      expect(formatCompactCurrency(12500)).toBe('$12.5K');
    });

    it('formats regular amounts', () => {
      expect(formatCompactCurrency(123.45)).toBe('$123.45');
    });

    it('formats small amounts with 2 decimals', () => {
      expect(formatCompactCurrency(0.12)).toBe('$0.12');
    });

    it('formats very small amounts with 4 decimals', () => {
      expect(formatCompactCurrency(0.0012)).toBe('$0.0012');
    });

    it('handles zero', () => {
      expect(formatCompactCurrency(0)).toBe('$0');
    });

    it('handles negative billions', () => {
      expect(formatCompactCurrency(-1500000000)).toBe('-$1.5B');
    });

    it('handles negative thousands', () => {
      expect(formatCompactCurrency(-12500)).toBe('-$12.5K');
    });

    it('handles custom currency symbol', () => {
      expect(formatCompactCurrency(2500000, '£')).toBe('£2.5M');
    });

    it('handles NaN', () => {
      expect(formatCompactCurrency(NaN)).toBe('$0');
    });

    it('handles exactly 1000', () => {
      expect(formatCompactCurrency(1000)).toBe('$1.0K');
    });

    it('handles exactly 1 million', () => {
      expect(formatCompactCurrency(1000000)).toBe('$1.0M');
    });
  });

  describe('formatCostForDisplay', () => {
    it('uses compact format for amounts >= 10000', () => {
      expect(formatCostForDisplay(15000)).toBe('$15.0K');
      expect(formatCostForDisplay(1500000)).toBe('$1.5M');
    });

    it('uses 4 decimal places for very small amounts', () => {
      expect(formatCostForDisplay(0.0012)).toBe('$0.0012');
      expect(formatCostForDisplay(0.0099)).toBe('$0.0099');
    });

    it('uses 2 decimal places for normal amounts', () => {
      expect(formatCostForDisplay(123.45)).toBe('$123.45');
      expect(formatCostForDisplay(9999.99)).toBe('$9,999.99');
    });

    it('handles zero', () => {
      expect(formatCostForDisplay(0)).toBe('$0.00');
    });

    it('handles negative amounts', () => {
      expect(formatCostForDisplay(-123.45)).toBe('-$123.45');
      expect(formatCostForDisplay(-15000)).toBe('-$15.0K');
    });

    it('handles NaN', () => {
      expect(formatCostForDisplay(NaN)).toBe('$0.00');
    });

    it('handles boundary at 10000', () => {
      expect(formatCostForDisplay(9999.99)).toBe('$9,999.99');
      expect(formatCostForDisplay(10000)).toBe('$10.0K');
    });

    it('handles boundary at 0.01', () => {
      expect(formatCostForDisplay(0.01)).toBe('$0.01');
      expect(formatCostForDisplay(0.009)).toBe('$0.0090');
    });
  });

  describe('formatPercentage', () => {
    it('formats basic percentage', () => {
      expect(formatPercentage(45.5)).toBe('45.5%');
    });

    it('formats with custom decimal places', () => {
      expect(formatPercentage(45.678, 2)).toBe('45.68%');
    });

    it('handles zero', () => {
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('handles 100%', () => {
      expect(formatPercentage(100)).toBe('100.0%');
    });

    it('handles negative percentages', () => {
      expect(formatPercentage(-25.5)).toBe('-25.5%');
    });

    it('handles NaN', () => {
      expect(formatPercentage(NaN)).toBe('0%');
    });

    it('rounds correctly', () => {
      expect(formatPercentage(33.333, 1)).toBe('33.3%');
      expect(formatPercentage(33.356, 1)).toBe('33.4%');
    });
  });

  describe('formatNumber', () => {
    it('formats with thousand separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('formats with custom decimal places', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    });

    it('handles zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('handles negative numbers', () => {
      expect(formatNumber(-1234567)).toBe('-1,234,567');
    });

    it('handles NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('handles Infinity', () => {
      expect(formatNumber(Infinity)).toBe('0');
    });

    it('handles small decimals', () => {
      expect(formatNumber(0.12345, 4)).toBe('0.1235');
    });
  });
});
