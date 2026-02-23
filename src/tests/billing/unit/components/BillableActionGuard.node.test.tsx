/**
 * Tests for BillableActionGuard component.
 *
 * Strategy:
 *   1. Pure logic tests for computeGuardDecision (no React)
 *   2. Component rendering tests verifying:
 *      - Passthrough when billing is ready
 *      - Disabled state + tooltip when payment method missing
 *      - Disabled state + tooltip when credits missing
 *      - "Add a payment method" link is clickable and fires callback
 *      - Custom tooltip messages
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {
  BillableActionGuard,
  computeGuardDecision,
  type GuardDecision,
} from '@/components/Billing/BillableActionGuard';

// Mock useBillingStatus so the component doesn't need a QueryClientProvider.
// When explicit props are passed they override the hook, but the hook still
// runs internally; returning safe defaults avoids errors.
vi.mock('@/hooks/Billing/useBillingStatus', () => ({
  useBillingStatus: () => ({
    hasCustomerId: false,
    hasPaymentMethod: false,
    credits: 0,
    hasCredits: false,
    isReady: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// ─── 1. Pure logic tests ────────────────────────────────────────────────────

describe('computeGuardDecision', () => {
  it('returns not blocked when both payment method and credits exist', () => {
    const result = computeGuardDecision(true, true);
    expect(result).toEqual<GuardDecision>({
      blocked: false,
      reason: null,
      message: '',
    });
  });

  it('returns blocked with no_payment_method when payment method missing', () => {
    const result = computeGuardDecision(false, true);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('no_payment_method');
    expect(result.message).toContain('payment method');
  });

  it('returns blocked with no_credits when credits missing', () => {
    const result = computeGuardDecision(true, false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('no_credits');
    expect(result.message).toContain('credits');
  });

  it('prioritizes no_payment_method over no_credits', () => {
    const result = computeGuardDecision(false, false);
    expect(result.reason).toBe('no_payment_method');
  });

  it('uses custom message when provided', () => {
    const custom = 'Custom block message';
    const result = computeGuardDecision(false, true, custom);
    expect(result.message).toBe(custom);
  });
});

// ─── 2. Component rendering tests ──────────────────────────────────────────

describe('BillableActionGuard', () => {
  it('renders children unmodified when billing is ready', () => {
    const onClick = vi.fn();
    render(
      <BillableActionGuard hasPaymentMethod={true} hasCredits={true}>
        <button onClick={onClick}>Hire</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Hire' });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not wrap in guard span when billing is ready', () => {
    render(
      <BillableActionGuard hasPaymentMethod={true} hasCredits={true}>
        <button>Hire</button>
      </BillableActionGuard>
    );

    expect(screen.queryByTestId('billable-action-guard')).toBeNull();
  });

  it('disables child button when no payment method', () => {
    const onClick = vi.fn();
    render(
      <BillableActionGuard hasPaymentMethod={false} hasCredits={true}>
        <button onClick={onClick}>Hire</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Hire' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    // Click should not fire
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders guard wrapper when blocked', () => {
    render(
      <BillableActionGuard hasPaymentMethod={false} hasCredits={true}>
        <button>Hire</button>
      </BillableActionGuard>
    );

    expect(screen.getByTestId('billable-action-guard')).toBeTruthy();
  });

  it('disables child button when no credits', () => {
    render(
      <BillableActionGuard hasPaymentMethod={true} hasCredits={false}>
        <button>Chat</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Chat' });
    expect(button).toBeDisabled();
  });

  it('applies opacity and pointer-events-none to disabled child', () => {
    render(
      <BillableActionGuard hasPaymentMethod={false} hasCredits={false}>
        <button className="existing-class">Edit</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.className).toContain('opacity-50');
    expect(button.className).toContain('pointer-events-none');
    expect(button.className).toContain('existing-class');
  });

  it('renders "add a payment method" link when onAddPaymentMethod provided', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(
      <BillableActionGuard
        hasPaymentMethod={false}
        hasCredits={true}
        onAddPaymentMethod={onAdd}
      >
        <button>Hire</button>
      </BillableActionGuard>
    );

    // Hover to trigger tooltip
    const guard = screen.getByTestId('billable-action-guard');
    await user.hover(guard);

    // Wait for tooltip to appear (Radix renders content twice — visual + a11y)
    const links = await screen.findAllByTestId('add-payment-method-link');
    expect(links.length).toBeGreaterThanOrEqual(1);
    const link = links[0];
    expect(link.textContent).toBe('add a payment method');

    // Click the link
    await user.click(link);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows plain text instead of link when onAddPaymentMethod not provided', async () => {
    const user = userEvent.setup();

    render(
      <BillableActionGuard hasPaymentMethod={false} hasCredits={true}>
        <button>Hire</button>
      </BillableActionGuard>
    );

    const guard = screen.getByTestId('billable-action-guard');
    await user.hover(guard);

    // Should not have the clickable link
    expect(screen.queryByTestId('add-payment-method-link')).toBeNull();
  });

  it('works with non-button elements', () => {
    render(
      <BillableActionGuard hasPaymentMethod={false} hasCredits={false}>
        <div data-testid="custom-element">Custom Action</div>
      </BillableActionGuard>
    );

    const element = screen.getByTestId('custom-element');
    expect(element).toHaveAttribute('aria-disabled', 'true');
  });

  it('uses hook data when no explicit props are provided', () => {
    // The mock returns hasPaymentMethod=false, hasCredits=false, isLoading=false
    // so the guard should block
    render(
      <BillableActionGuard>
        <button>Hire</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Hire' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('billable-action-guard')).toBeTruthy();
  });

  it('supports creditsRequired threshold via explicit props override', () => {
    // hasPaymentMethod=true, credits from hook = 0, but explicit hasCredits=true overrides
    render(
      <BillableActionGuard hasPaymentMethod={true} hasCredits={true} creditsRequired={5}>
        <button>Run</button>
      </BillableActionGuard>
    );

    const button = screen.getByRole('button', { name: 'Run' });
    expect(button).not.toBeDisabled();
  });
});

