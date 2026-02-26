/**
 * Tests for the EmailLoginForm component.
 *
 * Strategy:
 *   1. Test login/register view toggle
 *   2. Test registration flow: form → API call → verification screen
 *   3. Test login flow: pre-validation → signIn → redirect
 *   4. Test provider-aware error messages
 *   5. Test forgot password link navigation
 *   6. Test validation (empty fields, short password)
 *   7. Test verification code submission → signIn
 *   8. Test network error handling
 *   9. Test back navigation from verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSignIn = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}));

vi.mock('@/components/UI/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/Common/Input/Password', () => ({
  PasswordInput: ({ ...props }: any) => <input {...props} type="password" />,
}));

// Mock the verification code component to simplify testing
vi.mock('@/app/login/verification-code', () => ({
  default: ({ onSubmit, onResend, error, email }: any) => (
    <div data-testid="verification-code-mock">
      <span data-testid="verification-email">{email}</span>
      {error && <span data-testid="verification-error">{error}</span>}
      <button data-testid="submit-code" onClick={() => onSubmit('123456')}>
        Submit Code
      </button>
      <button data-testid="resend-code" onClick={onResend}>
        Resend
      </button>
    </div>
  ),
}));

// Mock the forgot password component
vi.mock('@/app/login/forgot-password', () => ({
  default: ({ onBack, initialEmail }: any) => (
    <div data-testid="forgot-password-mock">
      <span data-testid="forgot-email">{initialEmail}</span>
      <button data-testid="forgot-back" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

// Mock the Turnstile widget — auto-fires onVerify with a test token
vi.mock('@/components/Common/Auth/TurnstileWidget', () => ({
  default: ({ onVerify }: any) => {
    // Simulate Turnstile resolving immediately
    if (onVerify) setTimeout(() => onVerify('test-turnstile-token'), 0);
    return <div data-testid="turnstile-widget-mock" />;
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import EmailLoginForm from '@/app/login/email-login';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EmailLoginForm – view management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in login view', () => {
    render(<EmailLoginForm />);
    expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('email-register-form')).not.toBeInTheDocument();
  });

  it('switches to register view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    expect(screen.queryByTestId('email-login-form')).not.toBeInTheDocument();
  });

  it('switches back to login view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.click(screen.getByTestId('switch-to-login'));
    expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
  });

  it('shows first/last name fields only in register view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    expect(screen.queryByTestId('email-first-name-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-last-name-input')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('switch-to-register'));
    expect(screen.getByTestId('email-first-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-last-name-input')).toBeInTheDocument();
  });

  it('shows forgot password link only in login view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();

    await user.click(screen.getByTestId('switch-to-register'));
    expect(screen.queryByTestId('forgot-password-link')).not.toBeInTheDocument();
  });

  it('navigates to forgot password view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('forgot-password-link'));
    expect(screen.getByTestId('forgot-password-mock')).toBeInTheDocument();
  });

  it('passes email to forgot password view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    const emailInput = screen.getByTestId('email-input');
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByTestId('forgot-password-link'));

    expect(screen.getByTestId('forgot-email').textContent).toBe('test@example.com');
  });

  it('returns from forgot password to login view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('forgot-password-link'));
    await user.click(screen.getByTestId('forgot-back'));
    expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
  });
});

describe('EmailLoginForm – registration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls register API and shows verification on success', async () => {
    const registerSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/register', async ({ request }) => {
        registerSpy(await request.json());
        return HttpResponse.json({ email: 'new@example.com', requiresVerification: true });
      })
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-first-name-input'), 'Jane');
    await user.type(screen.getByTestId('email-last-name-input'), 'Doe');
    await user.type(screen.getByTestId('email-input'), 'new@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', name: 'Jane', lastName: 'Doe' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('email-verify-view')).toBeInTheDocument();
    });
  });

  it('displays provider-aware error when email exists with different provider', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json(
          { error: 'email_exists', message: 'already registered', providers: ['google'] },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'existing@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('Google');
    });
  });

  it('displays generic error when registration fails', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json(
          { error: 'disposable_email', message: 'Please use a permanent email' },
          { status: 400 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'junk@temp.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-auth-error').textContent).toContain('permanent email');
    });
  });

  it('handles network error during registration', async () => {
    server.use(
      http.post('/api/auth/email/register', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-auth-error').textContent).toContain('Network error');
    });
  });
});

describe('EmailLoginForm – verification flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls verify and signIn on successful code submission', async () => {
    const verifySpy = vi.fn();
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json({ email: 'new@test.com', requiresVerification: true })
      ),
      http.post('/api/auth/email/verify', async ({ request }) => {
        verifySpy(await request.json());
        return HttpResponse.json({ id: 'user-1', email: 'new@test.com', name: null });
      })
    );
    mockSignIn.mockResolvedValueOnce({ url: '/assistants', error: null, ok: true });

    const user = userEvent.setup();
    render(<EmailLoginForm callbackUrl="/assistants" />);

    // Go through registration
    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'new@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-verify-view')).toBeInTheDocument();
    });

    // Submit verification code
    await user.click(screen.getByTestId('submit-code'));

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com', code: '123456' })
      );
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        'credentials',
        expect.objectContaining({
          email: 'new@test.com',
          password: 'Pass1234!',
          redirect: false,
        })
      );
    });
  });

  it('displays verification error on invalid code', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json({ email: 'test@test.com', requiresVerification: true })
      ),
      http.post('/api/auth/email/verify', () =>
        HttpResponse.json(
          { error: 'invalid_code', message: 'Code is incorrect' },
          { status: 400 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-verify-view')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('submit-code'));

    await waitFor(() => {
      expect(screen.getByTestId('verification-error').textContent).toContain('Code is incorrect');
    });
  });

  it('calls resend API when resend is clicked', async () => {
    const resendSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json({ email: 'test@test.com', requiresVerification: true })
      ),
      http.post('/api/auth/email/resend-verification', async ({ request }) => {
        resendSpy(await request.json());
        return HttpResponse.json({ message: 'Code resent' });
      })
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-verify-view')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('resend-code'));

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@test.com', purpose: 'signup' })
      );
    });
  });

  it('allows navigating back from verification to register', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json({ email: 'test@test.com', requiresVerification: true })
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-verify-view')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('back-to-register'));
    expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
  });
});

describe('EmailLoginForm – login flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-validates and then calls signIn on success', async () => {
    const authSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/authenticate', async ({ request }) => {
        authSpy(await request.json());
        return HttpResponse.json({
          id: 'user-1',
          email: 'user@test.com',
          name: 'User',
          mfaRequired: false,
        });
      })
    );
    mockSignIn.mockResolvedValueOnce({ url: '/assistants', error: null, ok: true });

    const user = userEvent.setup();
    render(<EmailLoginForm callbackUrl="/assistants" />);

    await user.type(screen.getByTestId('email-input'), 'user@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'mypassword');
    await user.click(screen.getByTestId('email-submit-btn'));

    // Pre-validation was called with correct body
    await waitFor(() => {
      expect(authSpy).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@test.com', password: 'mypassword' })
      );
    });

    // NextAuth signIn was called
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        'credentials',
        expect.objectContaining({
          email: 'user@test.com',
          password: 'mypassword',
          redirect: false,
          callbackUrl: '/assistants',
        })
      );
    });
  });

  it('shows provider error when email has no email account', async () => {
    server.use(
      http.post('/api/auth/email/authenticate', () =>
        HttpResponse.json(
          { error: 'no_email_account', message: 'Not registered', providers: ['github'] },
          { status: 401 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'oauth@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'password');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('Github');
    });
  });

  it('shows invalid credentials error on wrong password', async () => {
    server.use(
      http.post('/api/auth/email/authenticate', () =>
        HttpResponse.json(
          { error: 'invalid_credentials', message: 'Wrong password' },
          { status: 401 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'user@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'wrongpass');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-auth-error').textContent).toContain('Invalid email or password');
    });
  });

  it('shows error if NextAuth signIn fails after pre-validation', async () => {
    server.use(
      http.post('/api/auth/email/authenticate', () =>
        HttpResponse.json({ id: 'user-1', email: 'user@test.com' })
      )
    );
    mockSignIn.mockResolvedValueOnce({ url: null, error: 'CredentialsSignin', ok: false });

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'user@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'password');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-auth-error').textContent).toContain('Invalid email or password');
    });
  });

  it('handles network error during login', async () => {
    server.use(
      http.post('/api/auth/email/authenticate', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'user@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'password');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-auth-error').textContent).toContain('Network error');
    });
  });
});

describe('EmailLoginForm – provider-aware error formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats single provider correctly', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json(
          { error: 'x', message: 'x', providers: ['google'] },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'a@b.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('Google');
      expect(error.textContent).toContain('Please sign in with Google');
    });
  });

  it('formats multiple providers correctly', async () => {
    server.use(
      http.post('/api/auth/email/register', () =>
        HttpResponse.json(
          { error: 'x', message: 'x', providers: ['google', 'github'] },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'a@b.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('Google and Github');
    });
  });

  it('formats email + oauth providers correctly', async () => {
    server.use(
      http.post('/api/auth/email/authenticate', () =>
        HttpResponse.json(
          { error: 'x', message: 'x', providers: ['google', 'email'] },
          { status: 401 }
        )
      )
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'a@b.com');
    await user.type(screen.getByTestId('email-password-input'), 'password');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('Google and Email');
    });
  });
});

describe('EmailLoginForm – submit button state', () => {
  it('disables submit when email is empty', () => {
    render(<EmailLoginForm />);
    expect(screen.getByTestId('email-submit-btn')).toBeDisabled();
  });

  it('disables submit when password is empty', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    expect(screen.getByTestId('email-submit-btn')).toBeDisabled();
  });

  it('enables submit when both email and password are filled', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'test@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'password');
    expect(screen.getByTestId('email-submit-btn')).not.toBeDisabled();
  });
});

describe('EmailLoginForm – external error', () => {
  it('displays external error from props', () => {
    render(<EmailLoginForm externalError="OAuth failed" />);
    // The error is set via useState initial value — it will show in the error span
    expect(screen.getByTestId('email-auth-error').textContent).toBe('OAuth failed');
  });
});

describe('EmailLoginForm – Turnstile CAPTCHA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Turnstile widget in register view but not login view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    // Login view: no Turnstile
    expect(screen.queryByTestId('turnstile-widget-mock')).not.toBeInTheDocument();

    // Switch to register view: Turnstile rendered
    await user.click(screen.getByTestId('switch-to-register'));
    expect(screen.getByTestId('turnstile-widget-mock')).toBeInTheDocument();
  });

  it('includes captchaToken in registration request', async () => {
    const registerSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/register', async ({ request }) => {
        registerSpy(await request.json());
        return HttpResponse.json({ email: 'cap@test.com', requiresVerification: true });
      })
    );

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));

    // Wait for Turnstile mock to fire onVerify (setTimeout 0)
    await waitFor(() => {
      // Turnstile mock should have rendered
      expect(screen.getByTestId('turnstile-widget-mock')).toBeInTheDocument();
    });

    // Small delay for the setTimeout(0) in the mock
    await new Promise((r) => setTimeout(r, 10));

    await user.type(screen.getByTestId('email-input'), 'cap@test.com');
    await user.type(screen.getByTestId('email-password-input'), 'Pass1234!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith(
          expect.objectContaining({ captchaToken: 'test-turnstile-token' })
        );
    });
  });
});
