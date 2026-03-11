/**
 * Billing profile flow tests.
 *
 * Covers the "Edit billing details" user journey:
 *   - Context-aware display (personal vs organization)
 *   - Opening the edit dialog from the billing page
 *   - Loading profile data into the form
 *   - Form validation (required name, tax ID validation)
 *   - Tax country sync and tax ID validation
 *   - Saving profile with success/error handling
 *
 * Note: Radix Select doesn't support jsdom's pointer capture API, so tax
 * country tests use initialData to set the country rather than clicking the
 * Select dropdown.  This tests the same behavior (country drives tax ID label
 * and validation) without coupling to Radix internals.
 */

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import Main from '@/components/Pages/Billing/Main';
import BillingProfile from '@/components/Pages/Billing/BillingProfile';

import {
  createMockActions,
  waitForMainLoaded,
  DEFAULT_PROFILE,
  SAMPLE_COUNTRIES,
} from './mocks/actions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/billing',
}));

// Polyfill pointer-capture methods that Radix Select needs but jsdom lacks
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Waits for the BillingProfile component's loading state to clear. */
async function waitForProfileLoaded() {
  await waitFor(() => {
    // The Name field only renders after getProfile() resolves
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
  });
}

// =============================================================================
// 1. Display context on billing page
// =============================================================================

describe('Profile display context', () => {
  it('shows personal billing description when no org context', async () => {
    render(<Main actions={createMockActions()} />);
    await waitForMainLoaded();

    expect(
      screen.getByText('Your billing details and tax information'),
    ).toBeInTheDocument();
  });

  it('shows org name in billing description when in org context', async () => {
    render(
      <Main
        actions={createMockActions()}
        orgContext={{ orgId: 1, orgName: 'Acme Corp', canEdit: true }}
      />,
    );
    await waitForMainLoaded();

    expect(
      screen.getByText('Billing details for Acme Corp'),
    ).toBeInTheDocument();
  });

  it('opens edit dialog when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<Main actions={createMockActions()} />);
    await waitForMainLoaded();

    // Use exact match — /edit/i would also match "Buy Credits"
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(screen.getByText('Edit Billing Profile')).toBeInTheDocument();
    });
  });

  it('shows org-specific dialog description when in org context', async () => {
    const user = userEvent.setup();
    render(
      <Main
        actions={createMockActions()}
        orgContext={{ orgId: 2, orgName: 'Beta Inc', canEdit: true }}
      />,
    );
    await waitForMainLoaded();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(
        screen.getByText('Update billing details for Beta Inc'),
      ).toBeInTheDocument();
    });
  });
});

// =============================================================================
// 2. Profile loading
// =============================================================================

describe('Profile loading', () => {
  it('shows loading state while fetching profile', () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    });

    render(<BillingProfile actions={actions} />);

    // BillingProfile shows "Loading..." while useBillingProfile.loading is true
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('populates form with existing profile data', async () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({
        ...DEFAULT_PROFILE,
        name: 'Jane Smith',
        billingEmail: 'jane@company.com',
      }),
    });

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    expect(screen.getByDisplayValue('Jane Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@company.com')).toBeInTheDocument();
  });

  it('handles empty profile without crashing', async () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
    });

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    // Form should render with empty fields
    const nameInput = screen.getByLabelText(/^Name/);
    expect(nameInput).toHaveValue('');
  });
});

// =============================================================================
// 3. Form validation
// =============================================================================

describe('Form validation', () => {
  it('disables Save when name is empty', async () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
    });

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    // Name is empty → Save should be disabled
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it('enables Save when name is filled', async () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    await user.type(screen.getByLabelText(/^Name/), 'John Doe');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();
    });
  });

  it('disables Save when tax ID is entered but fails validation', async () => {
    // Provide initialData with a country already set to avoid Radix Select
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({
        ...DEFAULT_PROFILE,
        name: 'Jane',
        billingAddress: { country: 'DE' },
      }),
      getSupportedTaxCountries: vi.fn().mockResolvedValue(SAMPLE_COUNTRIES),
      validateTaxId: vi.fn().mockResolvedValue({
        valid: false,
        errorMessage: 'Invalid format',
      }),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    // Wait for country to sync and label to update
    await waitFor(() => {
      expect(screen.getByLabelText(/USt-IdNr|Tax ID/)).toBeInTheDocument();
    });

    // Type an invalid tax ID
    await user.type(screen.getByLabelText(/USt-IdNr|Tax ID/), 'INVALID');

    // Wait for debounced validation to fire
    await waitFor(() => {
      expect(actions.validateTaxId).toHaveBeenCalled();
    });

    // Save should be disabled because tax ID is invalid
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });

    // Error message should be visible
    expect(screen.getByText('Invalid format')).toBeInTheDocument();
  });
});

// =============================================================================
// 4. Tax handling
// =============================================================================

describe('Tax handling', () => {
  it('fetches supported tax countries on mount', async () => {
    const countriesFn = vi.fn().mockResolvedValue(SAMPLE_COUNTRIES);
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
      getSupportedTaxCountries: countriesFn,
    });

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    expect(countriesFn).toHaveBeenCalled();
  });

  it('shows correct tax ID label when country is set via profile data', async () => {
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({
        ...DEFAULT_PROFILE,
        billingAddress: { country: 'DE' },
      }),
      getSupportedTaxCountries: vi.fn().mockResolvedValue(SAMPLE_COUNTRIES),
    });

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    // Germany's tax ID label is "USt-IdNr."
    await waitFor(() => {
      expect(screen.getByLabelText(/USt-IdNr/)).toBeInTheDocument();
    });
  });

  it('validates tax ID when country and ID are both present', async () => {
    const validateFn = vi.fn().mockResolvedValue({ valid: true });
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({
        ...DEFAULT_PROFILE,
        billingAddress: { country: 'DE' },
      }),
      getSupportedTaxCountries: vi.fn().mockResolvedValue(SAMPLE_COUNTRIES),
      validateTaxId: validateFn,
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    // Wait for country to sync
    await waitFor(() => {
      expect(screen.getByLabelText(/USt-IdNr/)).toBeInTheDocument();
    });

    // Type a tax ID
    await user.type(screen.getByLabelText(/USt-IdNr/), 'DE123456789');

    // Wait for debounced validation
    await waitFor(() => {
      expect(validateFn).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'DE' }),
      );
    });
  });
});

// =============================================================================
// 5. Saving profile
// =============================================================================

describe('Saving profile', () => {
  it('saves profile and calls onClose on success', async () => {
    const onClose = vi.fn();
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
      updateProfile: vi.fn().mockResolvedValue({ name: 'John Doe' }),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} onClose={onClose} />);
    await waitForProfileLoaded();

    // Fill in required field
    await user.type(screen.getByLabelText(/^Name/), 'John Doe');

    // Wait for Save to be enabled
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(actions.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Doe' }),
      );
    });

    // onClose should be called after successful save
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error and keeps dialog open when save fails', async () => {
    const onClose = vi.fn();
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
      updateProfile: vi
        .fn()
        .mockResolvedValue({ detail: 'Tax ID mismatch with Stripe' }),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} onClose={onClose} />);
    await waitForProfileLoaded();

    await user.type(screen.getByLabelText(/^Name/), 'Test');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Error should appear in the form
    await waitFor(() => {
      expect(
        screen.getByText('Tax ID mismatch with Stripe'),
      ).toBeInTheDocument();
    });

    // Dialog should NOT close
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows "Saving..." on the button during save', async () => {
    let resolveSave: (value: unknown) => void;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
      updateProfile: vi.fn().mockReturnValue(savePromise),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} />);
    await waitForProfileLoaded();

    await user.type(screen.getByLabelText(/^Name/), 'Saving Test');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Button should show "Saving..." while the promise is pending
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    // Resolve the save
    resolveSave!({ name: 'Saving Test' });

    // Button should go back to "Save Changes"
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('shows Cancel button that calls onClose without saving', async () => {
    const onClose = vi.fn();
    const actions = createMockActions({
      getProfile: vi.fn().mockResolvedValue({}),
    });
    const user = userEvent.setup();

    render(<BillingProfile actions={actions} onClose={onClose} />);
    await waitForProfileLoaded();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(actions.updateProfile).not.toHaveBeenCalled();
  });
});
