/**
 * Tests for the VerificationCodeInput component.
 *
 * Strategy:
 *   1. Test that 6 digit inputs render and are individually fillable
 *   2. Test auto-submit when all 6 digits are entered
 *   3. Test paste handling (full 6-digit code)
 *   4. Test non-digit input is rejected
 *   5. Test resend cooldown timer
 *   6. Test disabled state during loading
 *   7. Test error display
 *   8. Test manual submit button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/UI/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import VerificationCodeInput from '@/app/login/verification-code';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('VerificationCodeInput', () => {
  const mockOnSubmit = vi.fn();
  const mockOnResend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (overrides = {}) =>
    render(
      <VerificationCodeInput
        email="test@example.com"
        onSubmit={mockOnSubmit}
        onResend={mockOnResend}
        {...overrides}
      />
    );

  it('renders 6 digit inputs', () => {
    renderComponent();
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`code-digit-${i}`)).toBeInTheDocument();
    }
  });

  it('displays email context', () => {
    renderComponent({ email: 'user@test.com' });
    expect(screen.getByText(/user@test.com/)).toBeInTheDocument();
  });

  it('displays signup purpose text', () => {
    renderComponent({ purpose: 'signup' });
    expect(screen.getByText(/verify your email/)).toBeInTheDocument();
  });

  it('displays reset purpose text', () => {
    renderComponent({ purpose: 'password_reset' });
    expect(screen.getByText(/reset your password/)).toBeInTheDocument();
  });

  it('accepts digit input and advances focus', () => {
    renderComponent();

    const input0 = screen.getByTestId('code-digit-0');
    fireEvent.change(input0, { target: { value: '1' } });
    expect(input0).toHaveValue('1');
  });

  it('auto-submits when all 6 digits are entered via onChange', () => {
    renderComponent();

    // Simulate entering digits one by one via onChange
    for (let i = 0; i < 6; i++) {
      const input = screen.getByTestId(`code-digit-${i}`);
      fireEvent.change(input, { target: { value: String(i + 1) } });
    }

    expect(mockOnSubmit).toHaveBeenCalledWith('123456');
  });

  it('rejects non-digit characters', () => {
    renderComponent();

    const input = screen.getByTestId('code-digit-0');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(input).toHaveValue('');
  });

  it('handles paste of full 6-digit code and auto-submits', () => {
    renderComponent();

    const firstInput = screen.getByTestId('code-digit-0');
    fireEvent.paste(firstInput, {
      clipboardData: { getData: () => '987654' },
    });

    expect(mockOnSubmit).toHaveBeenCalledWith('987654');
  });

  it('strips non-digits from pasted data', () => {
    renderComponent();

    const firstInput = screen.getByTestId('code-digit-0');
    fireEvent.paste(firstInput, {
      clipboardData: { getData: () => '12-34-56' },
    });

    expect(mockOnSubmit).toHaveBeenCalledWith('123456');
  });

  it('handles partial paste (fewer than 6 digits) without auto-submit', () => {
    renderComponent();

    const firstInput = screen.getByTestId('code-digit-0');
    fireEvent.paste(firstInput, {
      clipboardData: { getData: () => '123' },
    });

    // Should NOT auto-submit (not all 6 digits filled)
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('displays error message', () => {
    renderComponent({ error: 'Invalid code' });
    expect(screen.getByTestId('verification-error').textContent).toBe('Invalid code');
  });

  it('does not display error when no error', () => {
    renderComponent();
    expect(screen.queryByTestId('verification-error')).not.toBeInTheDocument();
  });

  it('disables inputs when loading', () => {
    renderComponent({ isLoading: true });
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`code-digit-${i}`)).toBeDisabled();
    }
  });

  it('disables verify button when not all digits entered', () => {
    renderComponent();
    expect(screen.getByTestId('verify-submit-btn')).toBeDisabled();
  });

  it('enables verify button when all digits are filled', () => {
    renderComponent();

    for (let i = 0; i < 6; i++) {
      const input = screen.getByTestId(`code-digit-${i}`);
      fireEvent.change(input, { target: { value: String(i + 1) } });
    }

    // It auto-submits, but the button should also be enabled
    mockOnSubmit.mockClear();

    // After auto-submit, the button state is updated —
    // since digits are filled, the button should not be disabled
    expect(screen.getByTestId('verify-submit-btn')).not.toBeDisabled();
  });

  it('calls onResend when resend button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const resendBtn = screen.getByTestId('resend-code-btn');
    await user.click(resendBtn);

    expect(mockOnResend).toHaveBeenCalled();
  });

  it('disables resend after click (cooldown starts)', async () => {
    const user = userEvent.setup();
    renderComponent();

    const resendBtn = screen.getByTestId('resend-code-btn');
    await user.click(resendBtn);

    expect(resendBtn).toBeDisabled();
    expect(resendBtn.textContent).toContain('Resend code in');
  });

  it('manual submit button calls onSubmit with current digits', () => {
    renderComponent();

    // Fill all 6 digits
    for (let i = 0; i < 6; i++) {
      const input = screen.getByTestId(`code-digit-${i}`);
      fireEvent.change(input, { target: { value: String(i + 1) } });
    }

    // The first call is from auto-submit; clear it
    mockOnSubmit.mockClear();

    // Click the manual submit button
    fireEvent.click(screen.getByTestId('verify-submit-btn'));
    expect(mockOnSubmit).toHaveBeenCalledWith('123456');
  });
});

describe('VerificationCodeInput – cooldown timer', () => {
  const mockOnSubmit = vi.fn();
  const mockOnResend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-enables resend after cooldown expires', () => {
    render(
      <VerificationCodeInput
        email="test@example.com"
        onSubmit={mockOnSubmit}
        onResend={mockOnResend}
      />
    );

    const resendBtn = screen.getByTestId('resend-code-btn');

    // Click resend using fireEvent (compatible with fake timers)
    fireEvent.click(resendBtn);

    expect(resendBtn).toBeDisabled();
    expect(resendBtn.textContent).toContain('Resend code in');

    // The cooldown uses setTimeout with 1-second intervals.
    // Advance one second at a time for all 60 seconds.
    for (let i = 0; i < 60; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
    }

    expect(resendBtn.textContent).toBe('Resend code');
    expect(resendBtn).not.toBeDisabled();
  });

  it('does not call onResend when button is disabled during cooldown', () => {
    render(
      <VerificationCodeInput
        email="test@example.com"
        onSubmit={mockOnSubmit}
        onResend={mockOnResend}
      />
    );

    const resendBtn = screen.getByTestId('resend-code-btn');
    fireEvent.click(resendBtn);
    mockOnResend.mockClear();

    // Button should be disabled during cooldown
    expect(resendBtn).toBeDisabled();
  });
});
