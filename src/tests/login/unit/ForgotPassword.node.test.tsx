/**
 * Tests for the ForgotPasswordForm component.
 *
 * Strategy:
 *   1. Test initial email entry view
 *   2. Test requesting a reset code (always transitions regardless of email existence)
 *   3. Test code + new password view
 *   4. Test successful password reset → success view
 *   5. Test error on invalid code
 *   6. Test new password validation (min 8 chars)
 *   7. Test back navigation
 *   8. Test resend reset code
 *   9. Test network error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

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

import ForgotPasswordForm from '@/app/login/forgot-password';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ForgotPasswordForm – email entry', () => {
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

describe('ForgotPasswordForm – code + new password', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const goToCodeView = async () => {
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

  it('shows new password input and verification code component', async () => {
    await goToCodeView();
    expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('verification-code-mock')).toBeInTheDocument();
  });

  it('shows error when new password is too short', async () => {
    const user = await goToCodeView();

    // Enter short password
    await user.type(screen.getByTestId('new-password-input'), 'short');

    // Submit code — validation fires before API call
    await user.click(screen.getByTestId('submit-reset-code'));

    await waitFor(() => {
      expect(screen.getByTestId('reset-verification-error').textContent).toContain(
        'min. 8 characters'
      );
    });
  });

  it('resets password successfully and shows success view', async () => {
    const user = await goToCodeView();

    // Set up reset-password handler
    const resetSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/reset-password', async ({ request }) => {
        resetSpy(await request.json());
        return HttpResponse.json({ message: 'Password reset' });
      })
    );

    await user.type(screen.getByTestId('new-password-input'), 'newpassword123');
    await user.click(screen.getByTestId('submit-reset-code'));

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ code: '654321', email: 'test@test.com' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('reset-success')).toBeInTheDocument();
    });
  });

  it('shows error on invalid reset code', async () => {
    const user = await goToCodeView();

    server.use(
      http.post('/api/auth/email/reset-password', () =>
        HttpResponse.json(
          { error: 'invalid_code', message: 'Code expired' },
          { status: 400 }
        )
      )
    );

    await user.type(screen.getByTestId('new-password-input'), 'newpassword123');
    await user.click(screen.getByTestId('submit-reset-code'));

    await waitFor(() => {
      expect(screen.getByTestId('reset-verification-error').textContent).toContain('Code expired');
    });
  });

  it('handles network error during reset', async () => {
    const user = await goToCodeView();

    server.use(
      http.post('/api/auth/email/reset-password', () => HttpResponse.error())
    );

    await user.type(screen.getByTestId('new-password-input'), 'newpassword123');
    await user.click(screen.getByTestId('submit-reset-code'));

    await waitFor(() => {
      expect(screen.getByTestId('reset-verification-error').textContent).toContain('Network error');
    });
  });

  it('calls resend API for password reset', async () => {
    const resendSpy = vi.fn();
    const user = await goToCodeView();

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
    const user = await goToCodeView();

    await user.click(screen.getByTestId('back-to-login-link'));
    expect(mockOnBack).toHaveBeenCalled();
  });
});

describe('ForgotPasswordForm – success view', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success view has back to login button', async () => {
    // Set up all needed handlers for the full flow
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

    // Request reset code
    await user.click(screen.getByTestId('send-reset-btn'));
    await waitFor(() => expect(screen.getByTestId('reset-code-view')).toBeInTheDocument());

    // Enter new password and submit code
    await user.type(screen.getByTestId('new-password-input'), 'newpassword123');
    await user.click(screen.getByTestId('submit-reset-code'));

    // Wait for success view
    await waitFor(() => expect(screen.getByTestId('reset-success')).toBeInTheDocument());

    // Click back to login
    await user.click(screen.getByTestId('back-to-login-btn'));
    expect(mockOnBack).toHaveBeenCalled();
  });
});
