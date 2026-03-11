/**
 * Shared test utilities for billing flow tests.
 *
 * Provides:
 *   - createMockActions: factory for BillingActions with sensible defaults
 *   - createQueryWrapper: QueryClientProvider wrapper for hooks that need React Query
 *   - waitForMainLoaded: waits for Main component to finish initial data load
 *   - DEFAULT_BALANCE / DEFAULT_AUTO_RECHARGE: constants tests can reference
 */

import { vi, expect } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import type { BillingActions } from '@/types/billing';

// =============================================================================
// Default data constants
// =============================================================================

export const DEFAULT_BALANCE = {
  balance: '25.00',
  fullBalance: 25,
  lastRechargeAt: null as string | null,
  accountStatus: 'ACTIVE',
};

export const DEFAULT_AUTO_RECHARGE = {
  autoRechargeEnabled: false,
  autoRechargeThreshold: 10,
  autoRechargeQty: 25,
  minRechargeAmount: 25,
  totalSpending: 100,
  canEnableAutoRecharge: true,
  minimumSpendRequired: 50,
  remainingSpendNeeded: 0,
  hasPaymentMethod: true,
};

export const DEFAULT_PROFILE = {
  name: 'Test User',
  billingEmail: 'test@example.com',
  taxId: '',
  taxIdType: '',
  billingAddress: {},
  billingSetupComplete: false,
  isBusiness: false,
};

export const SAMPLE_COUNTRIES = {
  supportedCountries: {
    DE: {
      name: 'Germany',
      description: 'Germany',
      taxIdName: 'USt-IdNr.',
      taxIdFormat: 'DE123456789',
      taxIdType: 'eu_vat',
      stripeTaxIdType: 'eu_vat',
    },
    GB: {
      name: 'United Kingdom',
      description: 'United Kingdom',
      taxIdName: 'VAT Number',
      taxIdFormat: 'GB123456789',
      taxIdType: 'gb_vat',
      stripeTaxIdType: 'gb_vat',
    },
  },
  totalCountries: 2,
};

// =============================================================================
// Mock actions factory
// =============================================================================

export function createMockActions(overrides?: Partial<BillingActions>): BillingActions {
  return {
    getBalance: vi.fn().mockResolvedValue({ ...DEFAULT_BALANCE }),
    getAutoRecharge: vi.fn().mockResolvedValue({ ...DEFAULT_AUTO_RECHARGE }),
    updateAutoRecharge: vi.fn().mockResolvedValue(undefined),
    toggleAutoRecharge: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue({}),
    updateProfile: vi.fn().mockResolvedValue({}),
    createCheckoutSession: vi.fn().mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    }),
    createPortalSession: vi.fn().mockResolvedValue({
      url: 'https://billing.stripe.com/test',
    }),
    getCheckoutStatus: vi.fn().mockResolvedValue({ paymentStatus: 'unpaid' }),
    getSupportedTaxCountries: vi.fn().mockResolvedValue({
      supportedCountries: {},
      totalCountries: 0,
    }),
    validateTaxId: vi.fn().mockResolvedValue({ valid: true }),
    ...overrides,
  };
}

// =============================================================================
// QueryClient wrapper (for hooks/components using React Query)
// =============================================================================

export function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

// =============================================================================
// Helpers for Main component tests
// =============================================================================

/**
 * Waits for the Main billing component to finish its initial data load.
 * After this resolves, the balance and auto-recharge sections are visible.
 */
export async function waitForMainLoaded() {
  await waitFor(() => {
    // "Balance" heading only renders after dataLoaded = true
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });
}

