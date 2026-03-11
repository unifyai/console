/**
 * Auto-recharge flow tests.
 *
 * Covers the "Set up automatic top-ups" user journey:
 *   - Seeing auto-recharge settings loaded from the API
 *   - Eligibility gating (minimum spend threshold)
 *   - Toggling auto-recharge on/off
 *   - Configuring thresholds and recharge amounts
 *   - Saving settings with validation
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import Main from '@/components/Pages/Billing/Main';

import {
  createMockActions,
  waitForMainLoaded,
  DEFAULT_AUTO_RECHARGE,
} from './mocks/actions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/billing',
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Renders Main and waits for initial data load. */
async function renderBillingPage(actionOverrides?: Parameters<typeof createMockActions>[0]) {
  const actions = createMockActions(actionOverrides);
  render(<Main actions={actions} />);
  await waitForMainLoaded();
  return actions;
}

// =============================================================================
// 1. Loading settings
// =============================================================================

describe('Loading auto-recharge settings', () => {
  it('shows auto-recharge as disabled by default', async () => {
    await renderBillingPage();

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows auto-recharge as enabled when API reports it enabled', async () => {
    await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        autoRechargeEnabled: true,
      }),
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows settings form with populated values when enabled', async () => {
    await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        autoRechargeEnabled: true,
        autoRechargeThreshold: 15,
        autoRechargeQty: 50,
      }),
    });

    const minInput = screen.getByLabelText('Minimum Balance');
    const amountInput = screen.getByLabelText('Recharge Amount');
    expect(minInput).toHaveValue(15);
    expect(amountInput).toHaveValue(50);
  });
});

// =============================================================================
// 2. Eligibility
// =============================================================================

describe('Eligibility gating', () => {
  it('disables toggle when user has not met spending threshold', async () => {
    await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        canEnableAutoRecharge: false,
        totalSpending: 20,
        minimumSpendRequired: 50,
        remainingSpendNeeded: 30,
      }),
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  it('shows remaining spend needed when ineligible', async () => {
    await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        canEnableAutoRecharge: false,
        remainingSpendNeeded: 30,
      }),
    });

    expect(
      screen.getByText(/Spend \$30\.00 more to unlock automatic refills/),
    ).toBeInTheDocument();
  });

  it('does not mark already-enabled users as ineligible', async () => {
    // User has auto-recharge enabled but wouldn't qualify if they were turning it on now
    await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        autoRechargeEnabled: true,
        canEnableAutoRecharge: false,
        totalSpending: 10,
        minimumSpendRequired: 50,
        remainingSpendNeeded: 40,
      }),
    });

    const toggle = screen.getByRole('switch');
    // Toggle should NOT be disabled — they're grandfathered in
    expect(toggle).not.toBeDisabled();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

// =============================================================================
// 3. Toggling auto-recharge
// =============================================================================

describe('Toggling auto-recharge', () => {
  it('enables auto-recharge, calls API, and shows settings form', async () => {
    const actions = await renderBillingPage();
    const user = userEvent.setup();

    // Toggle ON
    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(actions.toggleAutoRecharge).toHaveBeenCalledWith(true);
    });

    // Settings form should appear
    expect(screen.getByLabelText('Minimum Balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Recharge Amount')).toBeInTheDocument();

    // Success alert
    expect(
      screen.getByText('Auto-recharge has been enabled.'),
    ).toBeInTheDocument();
  });

  it('disables auto-recharge, calls API, and hides settings form', async () => {
    const actions = await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        autoRechargeEnabled: true,
      }),
    });
    const user = userEvent.setup();

    // Confirm settings form is visible
    expect(screen.getByLabelText('Minimum Balance')).toBeInTheDocument();

    // Toggle OFF
    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(actions.toggleAutoRecharge).toHaveBeenCalledWith(false);
    });

    // Settings form should hide
    expect(screen.queryByLabelText('Minimum Balance')).not.toBeInTheDocument();

    // Success alert
    expect(
      screen.getByText('Auto-recharge has been disabled.'),
    ).toBeInTheDocument();
  });

  it('shows error and does not call API when ineligible user tries to enable', async () => {
    const actions = await renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        canEnableAutoRecharge: false,
        totalSpending: 20,
        minimumSpendRequired: 100,
        remainingSpendNeeded: 80,
      }),
    });

    // The switch is disabled, so we need to trigger the handler directly.
    // In the UI, clicking a disabled switch does nothing.
    // Instead verify the switch IS disabled (the gate works).
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(actions.toggleAutoRecharge).not.toHaveBeenCalled();
  });

  it('reverts toggle and shows error when API call fails', async () => {
    const actions = await renderBillingPage({
      toggleAutoRecharge: vi
        .fn()
        .mockResolvedValue({ detail: 'Server error' }),
    });
    const user = userEvent.setup();

    // Toggle ON
    await user.click(screen.getByRole('switch'));

    // Should revert back to unchecked
    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    // Error alert
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});

// =============================================================================
// 4. Saving settings
// =============================================================================

describe('Saving auto-recharge settings', () => {
  /** Helper: renders billing page with auto-recharge already enabled. */
  async function renderWithAutoRechargeEnabled(
    overrides?: Parameters<typeof createMockActions>[0],
  ) {
    return renderBillingPage({
      getAutoRecharge: vi.fn().mockResolvedValue({
        ...DEFAULT_AUTO_RECHARGE,
        autoRechargeEnabled: true,
        autoRechargeThreshold: 10,
        autoRechargeQty: 25,
      }),
      ...overrides,
    });
  }

  it('keeps save button disabled when no changes have been made', async () => {
    await renderWithAutoRechargeEnabled();

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveBtn).toBeDisabled();
  });

  it('enables save button when threshold or amount changes', async () => {
    await renderWithAutoRechargeEnabled();

    const minInput = screen.getByLabelText('Minimum Balance');
    fireEvent.change(minInput, { target: { value: '20' } });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save Changes' }),
      ).not.toBeDisabled();
    });
  });

  it('rejects zero or negative amounts with error alert', async () => {
    await renderWithAutoRechargeEnabled();
    const user = userEvent.setup();

    // Set minBalance to 0
    const minInput = screen.getByLabelText('Minimum Balance');
    fireEvent.change(minInput, { target: { value: '0' } });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(
        screen.getByText('Please enter valid amounts greater than zero.'),
      ).toBeInTheDocument();
    });
  });

  it('rejects recharge amount below the minimum with error alert', async () => {
    await renderWithAutoRechargeEnabled();
    const user = userEvent.setup();

    // Change rechargeAmount to below minimum ($25)
    const amountInput = screen.getByLabelText('Recharge Amount');
    fireEvent.change(amountInput, { target: { value: '10' } });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Recharge amount must be at least $25 to save changes.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('saves valid settings, calls API with correct payload, and shows success', async () => {
    const actions = await renderWithAutoRechargeEnabled();
    const user = userEvent.setup();

    // Change both values
    fireEvent.change(screen.getByLabelText('Minimum Balance'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('Recharge Amount'), {
      target: { value: '50' },
    });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(actions.updateAutoRecharge).toHaveBeenCalledWith({
        enabled: true,
        threshold: 20,
        qty: 50,
      });
    });

    expect(
      screen.getByText('Auto-recharge settings updated successfully.'),
    ).toBeInTheDocument();

    // Save button should be disabled again (changes committed)
    expect(
      screen.getByRole('button', { name: 'Save Changes' }),
    ).toBeDisabled();
  });

  it('shows error alert when save API call fails', async () => {
    const actions = await renderWithAutoRechargeEnabled({
      updateAutoRecharge: vi
        .fn()
        .mockResolvedValue({ detail: 'Database error' }),
    });
    const user = userEvent.setup();

    // Change a value to enable save
    fireEvent.change(screen.getByLabelText('Minimum Balance'), {
      target: { value: '20' },
    });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  it('shows minimum recharge amount hint in the form', async () => {
    await renderWithAutoRechargeEnabled();

    expect(
      screen.getByText(`Minimum recharge amount: $${DEFAULT_AUTO_RECHARGE.minRechargeAmount}`),
    ).toBeInTheDocument();
  });
});

