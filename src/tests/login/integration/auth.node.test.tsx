/**
 * Integration tests for the full authentication flow.
 *
 * Unlike the unit tests in `login/unit/EmailLoginForm.node.test.tsx` which mock
 * child components (VerificationCodeInput, ForgotPasswordForm, PasswordStrengthIndicator),
 * these tests render the REAL child components together and verify the full
 * user interaction flow end-to-end.
 *
 * Mocked: next-auth/react, next/navigation, framer-motion, TurnstileWidget, APIs (via MSW)
 * Real:   EmailLoginForm, VerificationCodeInput, ForgotPasswordForm, PasswordStrengthIndicator
 *
 * @group integration
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks (external dependencies only) ──────────────────────────────────────

const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated', update: vi.fn() }),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

// Framer-motion: pass through children without animation
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// TurnstileWidget: CAPTCHA cannot run in jsdom
vi.mock('@/components/Common/Auth/TurnstileWidget', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(null),
}));

// next/image: not available in jsdom
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// UnifyLogo: avoid SVG import issues
vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  __esModule: true,
  default: () => <div data-testid="unify-logo">Logo</div>,
}));

// Import REAL components (no mocking)
import EmailLoginForm from '@/components/Pages/Login/EmailLoginForm';

describe('Authentication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/login',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/login',
        search: '',
        hash: '',
        assign: vi.fn(),
        replace: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // ─── Full Registration → Verification → Sign-In Flow ────────────────

  describe('Registration → Verification → Sign-In', () => {
    it('completes full registration flow with real VerificationCodeInput', async () => {
      // API handlers
      server.use(
        http.post('/api/auth/email/register', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            email: body.email,
            requiresVerification: true,
          });
        }),
        http.post('/api/auth/email/verify', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === '123456') {
            return HttpResponse.json({
              id: 'user-new-1',
              email: body.email,
              name: 'Test',
            });
          }
          return HttpResponse.json(
            { message: 'Invalid code' },
            { status: 400 },
          );
        }),
      );
      mockSignIn.mockResolvedValueOnce({
        url: '/login/onboarding',
        error: null,
        ok: true,
      });

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Step 1: Switch to registration view
      await user.click(screen.getByTestId('switch-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();

      // Step 2: Fill out the registration form
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');

      // Verify real PasswordStrengthIndicator renders rule checklist
      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toBeInTheDocument();
      });
      // All 5 rules should be passed for "StrongP@ss1"
      expect(
        screen.getByTestId('password-rule-lowercase').className,
      ).toContain('text-green');
      expect(
        screen.getByTestId('password-rule-uppercase').className,
      ).toContain('text-green');
      expect(screen.getByTestId('password-rule-digit').className).toContain(
        'text-green',
      );
      expect(screen.getByTestId('password-rule-special').className).toContain(
        'text-green',
      );
      expect(
        screen.getByTestId('password-rule-minLength').className,
      ).toContain('text-green');

      // Fill name fields
      await user.type(screen.getByTestId('email-first-name-input'), 'Test');
      await user.type(screen.getByTestId('email-last-name-input'), 'User');

      // Step 3: Submit registration
      await user.click(screen.getByTestId('email-submit-btn'));

      // Step 4: Real VerificationCodeInput should appear
      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Verify the email context is shown
      expect(screen.getByText('new@test.com')).toBeInTheDocument();

      // Step 5: Enter 6 digits one by one in the real VerificationCodeInput
      const digit0 = screen.getByTestId('code-digit-0');
      const digit1 = screen.getByTestId('code-digit-1');
      const digit2 = screen.getByTestId('code-digit-2');
      const digit3 = screen.getByTestId('code-digit-3');
      const digit4 = screen.getByTestId('code-digit-4');
      const digit5 = screen.getByTestId('code-digit-5');

      await user.type(digit0, '1');
      await user.type(digit1, '2');
      await user.type(digit2, '3');
      await user.type(digit3, '4');
      await user.type(digit4, '5');
      await user.type(digit5, '6');

      // Step 6: Verify signIn was called after auto-submit
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({
            email: 'new@test.com',
            password: 'StrongP@ss1',
            redirect: false,
            callbackUrl: '/login/onboarding',
          }),
        );
      });
    });

    it('shows real VerificationCodeInput error on invalid code', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({
            email: 'new@test.com',
            requiresVerification: true,
          }),
        ),
        http.post('/api/auth/email/verify', () =>
          HttpResponse.json(
            { message: 'Invalid or expired code' },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Navigate to register
      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      // Wait for real verification code input
      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Enter an invalid code
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '9');
      }

      // The error should appear in the real VerificationCodeInput
      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Invalid or expired code',
        );
      });
    });

    it('shows PasswordStrengthIndicator rules failing for weak password', async () => {
      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));

      // Type a weak password (only lowercase, short)
      await user.type(screen.getByTestId('email-password-input'), 'abc');

      // Real PasswordStrengthIndicator should show mixed pass/fail
      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toBeInTheDocument();
      });
      // lowercase: passed
      expect(
        screen.getByTestId('password-rule-lowercase').className,
      ).toContain('text-green');
      // uppercase: NOT passed
      expect(
        screen.getByTestId('password-rule-uppercase').className,
      ).toContain('text-muted');
      // digit: NOT passed
      expect(screen.getByTestId('password-rule-digit').className).toContain(
        'text-muted',
      );
      // special: NOT passed
      expect(screen.getByTestId('password-rule-special').className).toContain(
        'text-muted',
      );
      // minLength: NOT passed (only 3 chars)
      expect(
        screen.getByTestId('password-rule-minLength').className,
      ).toContain('text-muted');
    });

    it('rejects registration with weak password client-side before API call', async () => {
      const fetchSpy = vi.fn();
      server.use(
        http.post('/api/auth/email/register', async ({ request }) => {
          fetchSpy(await request.json());
          return HttpResponse.json({ email: 'x@x.com' });
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'test@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'weak');
      await user.click(screen.getByTestId('email-submit-btn'));

      // Should show client-side error
      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toBeInTheDocument();
      });

      // Register API should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Full Login Flow ─────────────────────────────────────────────────

  describe('Login → Success', () => {
    it('completes login and redirects on success', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({
            id: 'user-1',
            email: 'user@test.com',
            name: 'Test User',
            preAuthToken: 'pre-auth-jwt-token',
          }),
        ),
      );
      mockSignIn.mockResolvedValueOnce({
        url: '/assistants',
        error: null,
        ok: true,
      });

      const user = userEvent.setup();
      render(<EmailLoginForm callbackUrl="/assistants" />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'MyP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({
            email: 'user@test.com',
            password: 'MyP@ss1',
            preAuthToken: 'pre-auth-jwt-token',
            redirect: false,
            callbackUrl: '/assistants',
          }),
        );
      });

      // Verify redirect
      await waitFor(() => {
        expect(window.location.href).toBe('/assistants');
      });
    });

    it('shows error for invalid credentials from authenticate API', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json(
            { error: 'invalid_credentials' },
            { status: 401 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'wrong');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Invalid email or password',
        );
      });

      // signIn should NOT have been called
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows provider error when email registered with different provider', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json(
            { providers: ['google'] },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'google@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'test');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Google',
        );
      });
    });
  });

  // ─── Full Forgot Password → Reset Flow ────────────────────────────────

  describe('Forgot Password → Code Verification → Password Reset', () => {
    it('completes the full 3-step password reset flow', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'Code sent' }),
        ),
        http.post('/api/auth/email/verify-reset-code', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === '654321') {
            return HttpResponse.json({ token: 'reset-token-abc' });
          }
          return HttpResponse.json(
            { message: 'Invalid code' },
            { status: 400 },
          );
        }),
        http.post('/api/auth/email/reset-password', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.token === 'reset-token-abc') {
            return HttpResponse.json({ message: 'Password reset' });
          }
          return HttpResponse.json(
            { error: 'invalid_token' },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Pre-fill email
      await user.type(screen.getByTestId('email-input'), 'forgot@test.com');

      // Step 1: Click "Forgot password?"
      await user.click(screen.getByTestId('forgot-password-link'));

      // ForgotPasswordForm should render with email pre-filled
      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });
      expect(screen.getByTestId('forgot-email-input')).toHaveValue(
        'forgot@test.com',
      );

      // Submit email to request code
      await user.click(screen.getByTestId('send-reset-btn'));

      // Step 2: Real VerificationCodeInput should appear (code view)
      await waitFor(() => {
        expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Enter 6-digit code in real VerificationCodeInput
      for (let i = 0; i < 6; i++) {
        await user.type(
          screen.getByTestId(`code-digit-${i}`),
          '654321'[i],
        );
      }

      // Step 3: New password view should appear
      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      // Real PasswordStrengthIndicator should render when typing new password
      await user.type(
        screen.getByTestId('new-password-input'),
        'NewStr0ng!Pass',
      );

      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toBeInTheDocument();
        // All rules should pass for "NewStr0ng!Pass"
        expect(
          screen.getByTestId('password-rule-lowercase').className,
        ).toContain('text-green');
        expect(
          screen.getByTestId('password-rule-uppercase').className,
        ).toContain('text-green');
      });

      await user.type(
        screen.getByTestId('confirm-password-input'),
        'NewStr0ng!Pass',
      );
      await user.click(screen.getByTestId('reset-password-btn'));

      // Success view
      await waitFor(() => {
        expect(screen.getByTestId('reset-success')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Your password has been reset/),
      ).toBeInTheDocument();
    });

    it('shows error in real VerificationCodeInput for wrong reset code', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'Code sent' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json(
            { message: 'Invalid or expired code. Please try again.' },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'test@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('send-reset-btn'));

      // Wait for verification code input
      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Enter wrong code
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '0');
      }

      // Error should appear in the real VerificationCodeInput
      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Invalid or expired code',
        );
      });

      // Should still be on the code view, not advanced
      expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
    });

    it('rejects mismatched passwords in the new password step', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'valid-token' }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Enter valid code
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), String(i + 1));
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      // Enter mismatched passwords
      await user.type(
        screen.getByTestId('new-password-input'),
        'NewStr0ng!Pass',
      );
      await user.type(
        screen.getByTestId('confirm-password-input'),
        'DifferentP@ss1',
      );
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent(
          'Passwords do not match',
        );
      });
    });
  });

  // ─── Login Error Paths ───────────────────────────────────────────────

  describe('Login error paths', () => {
    it('shows network error when authenticate API throws', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.error(),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'pass');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Network error',
        );
      });

      // signIn should NOT have been called
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows error when signIn returns an error after pre-auth succeeds', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({
            id: 'user-1',
            email: 'user@test.com',
            preAuthToken: 'token',
          }),
        ),
      );
      mockSignIn.mockResolvedValueOnce({
        error: 'CredentialsSignin',
        ok: false,
        url: null,
      });

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'MyP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Invalid email or password',
        );
      });

      // Should NOT redirect
      expect(window.location.href).toBe('http://localhost:3000/login');
    });

    it('uses generic message when authenticate returns non-specific error', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json(
            { message: 'Account locked' },
            { status: 403 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'pass');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Account locked',
        );
      });
    });
  });

  // ─── Registration Error Paths ──────────────────────────────────────

  describe('Registration error paths', () => {
    it('shows network error when register API throws', async () => {
      server.use(
        http.post('/api/auth/email/register', () => HttpResponse.error()),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Network error',
        );
      });
    });

    it('shows backend error for existing email', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json(
            { message: 'Email already registered' },
            { status: 409 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'existing@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
          'Email already registered',
        );
      });

      // Should stay on register view, not move to verify
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    });

    it('shows provider conflict during registration', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json(
            { providers: ['google', 'azure-ad'] },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'sso@corp.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        const errorText =
          screen.getByTestId('email-auth-error').textContent ?? '';
        expect(errorText).toContain('Google');
        expect(errorText).toContain('Azure-ad');
      });
    });
  });

  // ─── Verification Edge Cases ──────────────────────────────────────

  describe('Verification edge cases', () => {
    it('redirects to callbackUrl instead of /login/onboarding when provided', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
        http.post('/api/auth/email/verify', () =>
          HttpResponse.json({ id: 'user-1', email: 'new@test.com' }),
        ),
      );
      mockSignIn.mockResolvedValueOnce({
        url: '/invite?token=abc',
        ok: true,
        error: null,
      });

      const user = userEvent.setup();
      render(<EmailLoginForm callbackUrl="/invite?token=abc" />);

      // Register
      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Enter valid code
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '123456'[i]);
      }

      // Should use the provided callbackUrl, not /login/onboarding
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({
            callbackUrl: '/invite?token=abc',
          }),
        );
      });
    });

    it('shows network error when verification API throws', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
        http.post('/api/auth/email/verify', () => HttpResponse.error()),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Network error',
        );
      });
    });

    it('calls resend API and shows cooldown timer', async () => {
      let resendCalled = false;
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
        http.post('/api/auth/email/resend-verification', () => {
          resendCalled = true;
          return HttpResponse.json({ message: 'sent' });
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Click resend
      await user.click(screen.getByTestId('resend-code-btn'));

      await waitFor(() => {
        expect(resendCalled).toBe(true);
      });

      // Cooldown should be active
      expect(screen.getByTestId('resend-code-btn')).toBeDisabled();
      expect(screen.getByTestId('resend-code-btn')).toHaveTextContent(
        /Resend code in \d+s/,
      );
    });
  });

  // ─── Forgot Password Drop-offs and Edge Cases ─────────────────────

  describe('Forgot Password drop-offs', () => {
    it('allows returning to login from code view (mid-flow drop-off)', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
      });

      // Drop off: go back to login from code view
      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('allows returning to login from new-password view (mid-flow drop-off)', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      // Drop off: go back to login from new-password view
      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('returns to login from success view after full reset', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
        http.post('/api/auth/email/reset-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByTestId('new-password-input'),
        'NewStr0ng!Pass',
      );
      await user.type(
        screen.getByTestId('confirm-password-input'),
        'NewStr0ng!Pass',
      );
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-success')).toBeInTheDocument();
      });

      // Click "Back to login" from success view
      await user.click(screen.getByTestId('back-to-login-btn'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('redirects back to code view when reset token has expired', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'expired-tok' }),
        ),
        http.post('/api/auth/email/reset-password', () =>
          HttpResponse.json(
            { error: 'token_expired', message: 'Verification expired. Please request a new code.' },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByTestId('new-password-input'),
        'NewStr0ng!Pass',
      );
      await user.type(
        screen.getByTestId('confirm-password-input'),
        'NewStr0ng!Pass',
      );
      await user.click(screen.getByTestId('reset-password-btn'));

      // Should be redirected back to code view with the error message
      await waitFor(() => {
        expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Verification expired',
        );
      });
    });

    it('rejects weak new password client-side in forgot password flow', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
      );

      const resetFetchSpy = vi.fn();
      server.use(
        http.post('/api/auth/email/reset-password', async ({ request }) => {
          resetFetchSpy(await request.json());
          return HttpResponse.json({ message: 'ok' });
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      // Enter weak password
      await user.type(screen.getByTestId('new-password-input'), 'weak');
      await user.type(screen.getByTestId('confirm-password-input'), 'weak');
      await user.click(screen.getByTestId('reset-password-btn'));

      // Should show client-side error, not call API
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument();
      });
      expect(resetFetchSpy).not.toHaveBeenCalled();
    });

    it('shows network error when forgot-password email API throws', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.error(),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('forgot-email-input'), 'user@test.com');
      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-error')).toHaveTextContent(
          'Network error',
        );
      });

      // Should stay on email view
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
    });

    it('shows network error when reset-password API throws', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
        http.post('/api/auth/email/reset-password', () =>
          HttpResponse.error(),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(
          screen.getByTestId('reset-new-password-view'),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByTestId('new-password-input'),
        'NewStr0ng!Pass',
      );
      await user.type(
        screen.getByTestId('confirm-password-input'),
        'NewStr0ng!Pass',
      );
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent(
          'Network error',
        );
      });

      // Should stay on new-password view
      expect(
        screen.getByTestId('reset-new-password-view'),
      ).toBeInTheDocument();
    });

    it('resends forgot-password code', async () => {
      let resendCalled = false;
      server.use(
        http.post('/api/auth/email/forgot-password', () =>
          HttpResponse.json({ message: 'ok' }),
        ),
        http.post('/api/auth/email/resend-verification', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.purpose === 'password_reset') {
            resendCalled = true;
          }
          return HttpResponse.json({ message: 'ok' });
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Click resend
      await user.click(screen.getByTestId('resend-code-btn'));

      await waitFor(() => {
        expect(resendCalled).toBe(true);
      });

      // Cooldown should be active
      expect(screen.getByTestId('resend-code-btn')).toBeDisabled();
    });
  });

  // ─── View Switching ──────────────────────────────────────────────────

  describe('View transitions', () => {
    it('switches between login, register, verify, and forgot-password views', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({
            email: 'new@test.com',
            requiresVerification: true,
          }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Start at login
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
      expect(screen.queryByTestId('email-register-form')).toBeNull();

      // Switch to register
      await user.click(screen.getByTestId('switch-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
      // Real PasswordStrengthIndicator should NOT render yet (no password)
      expect(screen.queryByTestId('password-strength')).toBeNull();

      // Switch back to login
      await user.click(screen.getByTestId('switch-to-login'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();

      // Go to forgot password
      await user.click(screen.getByTestId('forgot-password-link'));
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();

      // Go back from forgot password to login
      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();

      // Register → submit → verify view → back to register
      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(
        screen.getByTestId('email-password-input'),
        'StrongP@ss1',
      );
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(
          screen.getByTestId('verification-code-input'),
        ).toBeInTheDocument();
      });

      // Back to registration from verify
      await user.click(screen.getByTestId('back-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    });
  });

  // ─── Disabled States ──────────────────────────────────────────────

  describe('Disabled states', () => {
    it('submit button is disabled when email or password is empty', () => {
      render(<EmailLoginForm />);

      // Both empty → disabled
      expect(screen.getByTestId('email-submit-btn')).toBeDisabled();
    });

    it('clears error when email field changes', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json(
            { error: 'invalid_credentials' },
            { status: 401 },
          ),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'wrong');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toBeInTheDocument();
      });

      // Type in email field → error should clear
      await user.type(screen.getByTestId('email-input'), 'x');
      expect(screen.queryByTestId('email-auth-error')).toBeNull();
    });
  });
});

