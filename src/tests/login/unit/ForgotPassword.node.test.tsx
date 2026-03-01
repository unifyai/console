/**
 * Tests for the ForgotPasswordForm component.
 *
 * The component has a 3-step flow:
 *   Step 1: Email entry → request reset code
 *   Step 2: Code entry (verification-code mock) → stores code, advances to new-password
 *   Step 3: New password + confirm → validates strength → calls reset-password API
 *   Success: confirmation message
 *
 * Strategy:
 *   1. Test initial email entry view
 *   2. Test requesting a reset code (always transitions regardless of email existence)
 *   3. Test code step → advances to new-password step
 *   4. Test password strength validation in new-password step
 *   5. Test successful password reset → success view
 *   6. Test error on invalid code from backend
 *   7. Test back navigation
 *   8. Test resend reset code
 *   9. Test network error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Constants ──────────────────────────────────────────────────────────────

/** A password that passes every strength rule. */
const STRONG_PW = 'New@Pass1';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/UI/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/Common/Input/Password', () => ({
  PasswordInput: ({ ...props }: any) => <input {...props} type="password" />,
}));

// Mock the verification code component
vi.mock('@/app/login/verification-code', () => ({
  default: ({ onSubmit, onResend, error }: any) => (
    <div data-testid="verification-code-mock">
      {error && <span data-testid="reset-verification-error">{error}</span>}
      <button data-testid="submit-reset-code" onClick={() => onSubmit('654321')}>
        Submit Code
      </button>
      <button data-testid="resend-reset-code" onClick={onResend}>
        Resend
      </button>
    </div>
  ),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import ForgotPasswordForm from '@/components/Pages/Login/ForgotPasswordForm';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Navigates through Step 1 (email) → Step 2 (code view).
 * Returns the userEvent handle for further interaction.
 */
const goToCodeView = async (mockOnBack: ReturnType<typeof vi.fn>) => {
  server.use(
    http.post('/api/auth/email/forgot-password', () =>
      HttpResponse.json({ message: 'sent' })
    )
  );

  const user = userEvent.setup();
  render(<ForgotPasswordForm onBack={mockOnBack} initialEmail="test@test.com" />);

  await user.click(screen.getByTestId('send-reset-btn'));

  await waitFor(() => {
    expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
  });

  return user;
};

/**
 * Navigates through Step 1 → Step 2 → Step 3 (new-password view).
 * Submits the code in Step 2 to arrive at the password entry form.
 */
const goToNewPasswordView = async (mockOnBack: ReturnType<typeof vi.fn>) => {
  const user = await goToCodeView(mockOnBack);

  // Submit the code (verification-code mock fires onSubmit('654321'))
  await user.click(screen.getByTestId('submit-reset-code'));

  await waitFor(() => {
    expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
  });

  return user;
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ForgotPasswordForm – email entry (Step 1)', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email entry view by default', () => {
    render(<ForgotPasswordForm onBack={mockOnBack} />);
    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
    expect(screen.getByText(/Forgot your password/)).toBeInTheDocument();
  });

  it('pre-fills email from props', () => {
    render(<ForgotPasswordForm onBack={mockOnBack} initialEmail="prefilled@test.com" />);
    expect(screen.getByTestId('forgot-email-input')).toHaveValue('prefilled@test.com');
  });

  it('calls onBack when back link is clicked', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm onBack={mockOnBack} />);

    await user.click(screen.getByTestId('back-to-login-link'));
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('transitions to code view after requesting reset (no enumeration)', async () => {
    const forgotSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/forgot-password', async ({ request }) => {
        forgotSpy(await request.json());
        return HttpResponse.json({ message: 'If an account exists, a code was sent' });
      })
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm onBack={mockOnBack} />);

    await user.type(screen.getByTestId('forgot-email-input'), 'test@example.com');
    await user.click(screen.getByTestId('send-reset-btn'));

    await waitFor(() => {
      expect(forgotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
    });
  });

  it('shows network error when fetch fails entirely', async () => {
    server.use(
      http.post('/api/auth/email/forgot-password', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm onBack={mockOnBack} />);

    await user.type(screen.getByTestId('forgot-email-input'), 'test@example.com');
    await user.click(screen.getByTestId('send-reset-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('forgot-error').textContent).toContain('Network error');
    });
  });
});

describe('ForgotPasswordForm – code entry (Step 2)', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows verification code component in code view', async () => {
    await goToCodeView(mockOnBack);
    expect(screen.getByTestId('verification-code-mock')).toBeInTheDocument();
  });

  it('submitting code advances to new-password view', async () => {
    const user = await goToCodeView(mockOnBack);

    await user.click(screen.getByTestId('submit-reset-code'));

    await waitFor(() => {
      expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    });
  });

  it('calls resend API for password reset', async () => {
    const resendSpy = vi.fn();
    const user = await goToCodeView(mockOnBack);

    server.use(
      http.post('/api/auth/email/resend-verification', async ({ request }) => {
        resendSpy(await request.json());
        return HttpResponse.json({ message: 'Code resent' });
      })
    );

    await user.click(screen.getByTestId('resend-reset-code'));

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@test.com', purpose: 'password_reset' })
      );
    });
  });

  it('navigates back from code view to login', async () => {
    const user = await goToCodeView(mockOnBack);

    await user.click(screen.getByTestId('back-to-login-link'));
    expect(mockOnBack).toHaveBeenCalled();
  });
});

describe('ForgotPasswordForm – new password (Step 3)', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows password strength indicator when typing', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    await user.type(screen.getByTestId('new-password-input'), 'abc');
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  it('shows error when new password fails strength rules', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    // 'short' is too short and missing uppercase, digit, special
    await user.type(screen.getByTestId('new-password-input'), 'short');
    await user.type(screen.getByTestId('confirm-password-input'), 'short');
    await user.click(screen.getByTestId('reset-password-btn'));

    await waitFor(() => {
      const errorText = screen.getByTestId('password-error').textContent!;
      expect(errorText).toContain('Password must have');
      expect(errorText).toContain('8 characters');
    });
  });

  it('shows error when passwords do not match', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), 'Diff@Pass1');
    await user.click(screen.getByTestId('reset-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('password-error').textContent).toContain(
        'Passwords do not match'
      );
    });
  });

  it('resets password successfully and shows success view', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    const resetSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/reset-password', async ({ request }) => {
        resetSpy(await request.json());
        return HttpResponse.json({ message: 'Password reset' });
      })
    );

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('reset-password-btn'));

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ code: '654321', email: 'test@test.com', newPassword: STRONG_PW })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('reset-success')).toBeInTheDocument();
    });
  });

  it('shows error on invalid reset code from backend', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    server.use(
      http.post('/api/auth/email/reset-password', () =>
        HttpResponse.json(
          { error: 'invalid_code', message: 'Code expired' },
          { status: 400 }
        )
      )
    );

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('reset-password-btn'));

    // Invalid code sends the user back to the code view with an error
    await waitFor(() => {
      expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
      expect(screen.getByTestId('reset-verification-error').textContent).toContain('Code expired');
    });
  });

  it('handles network error during reset', async () => {
    const user = await goToNewPasswordView(mockOnBack);

    server.use(
      http.post('/api/auth/email/reset-password', () => HttpResponse.error())
    );

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('reset-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('password-error').textContent).toContain('Network error');
    });
  });
});

describe('ForgotPasswordForm – success view', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success view has back to login button', async () => {
    // Set up handler for reset API
    server.use(
      http.post('/api/auth/email/forgot-password', () =>
        HttpResponse.json({ message: 'sent' })
      ),
      http.post('/api/auth/email/reset-password', () =>
        HttpResponse.json({ message: 'done' })
      )
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm onBack={mockOnBack} initialEmail="test@test.com" />);

    // Step 1: Request reset code
    await user.click(screen.getByTestId('send-reset-btn'));
    await waitFor(() => expect(screen.getByTestId('reset-code-view')).toBeInTheDocument());

    // Step 2: Submit code → new-password view
    await user.click(screen.getByTestId('submit-reset-code'));
    await waitFor(() => expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument());

    // Step 3: Enter new password and submit
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('reset-password-btn'));

    // Wait for success view
    await waitFor(() => expect(screen.getByTestId('reset-success')).toBeInTheDocument());

    // Click back to login
    await user.click(screen.getByTestId('back-to-login-btn'));
    expect(mockOnBack).toHaveBeenCalled();
  });
});
