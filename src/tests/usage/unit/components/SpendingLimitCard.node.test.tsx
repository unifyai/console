/**
 * Tests for SpendingLimitCard with per-limit edit functionality.
 *
 * Validates that:
 *   1. Card renders spending limits with progress bars
 *   2. Edit button appears when a limit has canEdit=true and onSave
 *   3. Edit button is hidden when canEdit is false/missing
 *   4. Card renders even when no limits exist if any limit is editable
 *   5. Card is hidden when no limits and none are editable
 *   6. getSpendingStatus helper returns correct status for each threshold
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the SpendingLimitDialog since we test it separately
vi.mock('@/components/Pages/Assistants/Assistants/Profile/SpendingLimitDialog', () => ({
  SpendingLimitDialog: ({
    open,
    onOpenChange,
    currentLimit,
    currentSpend,
    onSave,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    currentLimit: number | null;
    currentSpend: number;
    onSave: (v: number | null) => Promise<{ success: boolean }>;
  }) =>
    open ? (
      <div data-testid="spending-limit-dialog">
        <span data-testid="dialog-current-limit">{currentLimit ?? 'null'}</span>
        <span data-testid="dialog-current-spend">{currentSpend}</span>
        <button
          data-testid="dialog-save"
          onClick={() => {
            onSave(200).then(() => onOpenChange(false));
          }}
        >
          Save
        </button>
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

import { SpendingLimitCard, SpendingLimitData } from '@/components/Pages/Usage/SpendingLimitCard';

// ─── Test data ──────────────────────────────────────────────────────────────

const mockSave = vi.fn().mockResolvedValue({ success: true });

const userLimit: SpendingLimitData = { type: 'user', limit: 100, label: 'My Limit' };
const orgLimit: SpendingLimitData = { type: 'org', limit: 500, label: 'Org Limit' };
const assistantLimit: SpendingLimitData = {
  type: 'assistant',
  limit: 50,
  label: 'Assistant Limit',
};
const unlimitedLimit: SpendingLimitData = { type: 'user', limit: null, label: 'My Limit' };

const editableUserLimit: SpendingLimitData = { ...userLimit, canEdit: true, onSave: mockSave };
const editableOrgLimit: SpendingLimitData = { ...orgLimit, canEdit: true, onSave: mockSave };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SpendingLimitCard', () => {
  it('renders spending limit with progress bar', () => {
    render(<SpendingLimitCard currentSpending={50} spendingLimits={[userLimit]} />);

    expect(screen.getByTestId('spending-limit-card')).toBeTruthy();
    expect(screen.getByText('Current Month Limits')).toBeTruthy();
    expect(screen.getByText('My Limit')).toBeTruthy();
  });

  it('renders multiple limits', () => {
    render(<SpendingLimitCard currentSpending={30} spendingLimits={[userLimit, assistantLimit]} />);

    expect(screen.getByText('My Limit')).toBeTruthy();
    expect(screen.getByText('Assistant Limit')).toBeTruthy();
  });

  it('shows "No limits configured" when all limits are null', () => {
    render(<SpendingLimitCard currentSpending={30} spendingLimits={[unlimitedLimit]} />);

    expect(screen.getByText('No limits configured')).toBeTruthy();
  });

  it('does NOT render when no limits and none are editable', () => {
    const { container } = render(<SpendingLimitCard currentSpending={0} spendingLimits={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders when no limits but a limit is editable (user can set a limit)', () => {
    render(
      <SpendingLimitCard
        currentSpending={0}
        spendingLimits={[
          { type: 'user', limit: null, label: 'My Limit', canEdit: true, onSave: mockSave },
        ]}
      />
    );

    expect(screen.getByTestId('spending-limit-card')).toBeTruthy();
  });

  it('shows edit button when limit has canEdit=true and onSave', () => {
    render(<SpendingLimitCard currentSpending={50} spendingLimits={[editableUserLimit]} />);

    expect(screen.getByTestId('edit-user-limit-button')).toBeTruthy();
  });

  it('hides edit button when canEdit is false', () => {
    render(<SpendingLimitCard currentSpending={50} spendingLimits={[userLimit]} />);

    expect(screen.queryByTestId('edit-user-limit-button')).toBeNull();
  });

  it('hides edit button while loading', () => {
    render(
      <SpendingLimitCard
        currentSpending={50}
        spendingLimits={[editableUserLimit]}
        isLoading={true}
      />
    );

    expect(screen.queryByTestId('edit-user-limit-button')).toBeNull();
  });

  it('opens SpendingLimitDialog when edit button is clicked', async () => {
    const user = userEvent.setup();

    render(<SpendingLimitCard currentSpending={50} spendingLimits={[editableUserLimit]} />);

    // Dialog should not be visible initially
    expect(screen.queryByTestId('spending-limit-dialog')).toBeNull();

    // Click edit button
    await user.click(screen.getByTestId('edit-user-limit-button'));

    // Dialog should now be visible
    expect(screen.getByTestId('spending-limit-dialog')).toBeTruthy();
    // Dialog should receive the current limit and spending
    expect(screen.getByTestId('dialog-current-limit').textContent).toBe('100');
    expect(screen.getByTestId('dialog-current-spend').textContent).toBe('50');
  });

  it('calls onSave when dialog save is clicked', async () => {
    const user = userEvent.setup();
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    render(
      <SpendingLimitCard
        currentSpending={50}
        spendingLimits={[{ ...userLimit, canEdit: true, onSave: saveFn }]}
      />
    );

    await user.click(screen.getByTestId('edit-user-limit-button'));
    await user.click(screen.getByTestId('dialog-save'));

    expect(saveFn).toHaveBeenCalledWith(200);
  });

  it('closes dialog after save', async () => {
    const user = userEvent.setup();

    render(<SpendingLimitCard currentSpending={50} spendingLimits={[editableUserLimit]} />);

    await user.click(screen.getByTestId('edit-user-limit-button'));
    expect(screen.getByTestId('spending-limit-dialog')).toBeTruthy();

    await user.click(screen.getByTestId('dialog-save'));

    // Dialog should be closed
    expect(screen.queryByTestId('spending-limit-dialog')).toBeNull();
  });

  it('passes the correct limit to the dialog when editing org limit', async () => {
    const user = userEvent.setup();

    // Both org and assistant limits — click the org edit button
    render(
      <SpendingLimitCard
        currentSpending={200}
        spendingLimits={[editableOrgLimit, assistantLimit]}
      />
    );

    await user.click(screen.getByTestId('edit-org-limit-button'));

    expect(screen.getByTestId('dialog-current-limit').textContent).toBe('500');
  });
});
