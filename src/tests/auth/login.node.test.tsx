/**
 * Login journey tests — "I'm coming back to log in."
 *
 * Covers:
 * - Email login → success/error → redirect
 * - Provider-aware error messages (email registered with different provider)
 * - Forgot password → code → new password → success (full 3-step flow)
 * - Forgot password error paths (wrong code, weak password, mismatched, expired, network)
 * - Forgot password navigation (back to login from any step)
 * - View transitions (login ↔ register ↔ forgot password)
 * - Login page token handling (invite/credit URL params → OAuth callbackUrl)
 * - Stale session signout (?signout=true loop fix)
 * - Authenticated redirect
 *
 * Real components: EmailLoginForm, VerificationCodeInput, ForgotPasswordForm,
 *                  PasswordStrengthIndicator
 * Mocked: next-auth/react, next/navigation, framer-motion, TurnstileWidget, MSW APIs
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
const mockSignOut = vi.fn().mockResolvedValue(undefined);
let mockSessionData: { data: any; status: string } = {
  data: null,
  status: 'unauthenticated',
};

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: () => ({ ...mockSessionData, update: vi.fn() }),
}));

const pushMock = vi.fn();
const mockRedirect = vi.fn();
const mockRouterReplace = vi.fn();
let mockSearchParamsMap: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: mockRouterReplace }),
  usePathname: () => '/login',
  useSearchParams: () => {
    const params = new URLSearchParams();
    Object.entries(mockSearchParamsMap).forEach(([k, v]) => params.set(k, v));
    return params;
  },
}));

vi.mock('framer-motion', () => ({
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/Common/Auth/TurnstileWidget', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(null),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  __esModule: true,
  default: () => <div data-testid="unify-logo">Logo</div>,
}));

// ─── Login page specific mocks (don't affect EmailLoginForm) ─────────────────

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/public/icons/back.svg', () => ({
  default: () => <svg data-testid="back-svg" />,
}));

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getOrchestraUserClient: vi.fn(),
}));

vi.mock('@/components/Common/Tabs/AnimatedTabs', () => ({
  default: ({ children, selected }: { children: React.ReactNode; selected: string }) => (
    <div data-testid="animated-tabs" data-selected={selected}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/Common/Loaders/LoadingElement', () => ({
  default: () => <div data-testid="loading-element" />,
}));

vi.mock('@/components/Pages/Login/CheckElement', () => ({
  default: () => <div data-testid="check-element" />,
}));

vi.mock('@/components/Pages/Login/LoginFragment', () => ({
  default: ({ onLogin, error, callbackUrl }: any) => (
    <div data-testid="login-fragment" data-callback-url={callbackUrl}>
      {error && <div data-testid="login-error">{error}</div>}
      <button data-testid="google-login" onClick={onLogin('google')}>
        Continue with Google
      </button>
      <button data-testid="microsoft-login" onClick={onLogin('azure-ad')}>
        Continue with Microsoft
      </button>
    </div>
  ),
}));

// ─── Import REAL components ──────────────────────────────────────────────────

import EmailLoginForm from '@/components/Pages/Login/EmailLoginForm';
import Login from '@/app/login/page';
import { mockWindowLocation } from './fixtures';

// ═══════════════════════════════════════════════════════════════════════════════
// Email Login Flow (using real EmailLoginForm)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Journey', () => {
  describe('Email Login', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionData = { data: null, status: 'unauthenticated' };
      mockSearchParamsMap = {};
      mockWindowLocation();
    });

    afterEach(() => server.resetHandlers());

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
      mockSignIn.mockResolvedValueOnce({ url: '/assistants', error: null, ok: true });

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

      await waitFor(() => {
        expect(window.location.href).toBe('/assistants');
      });
    });

    it('shows error for invalid credentials', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 }),
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
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows provider error when email registered with different provider', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({ providers: ['google'] }, { status: 400 }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'google@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'test');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent('Google');
      });
    });

    it('shows network error when authenticate API throws', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () => HttpResponse.error()),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'pass');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent('Network error');
      });
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows error when signIn returns an error after pre-auth succeeds', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({ id: 'user-1', email: 'user@test.com', preAuthToken: 'token' }),
        ),
      );
      mockSignIn.mockResolvedValueOnce({ error: 'CredentialsSignin', ok: false, url: null });

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
      expect(window.location.href).toBe('http://localhost:3000/login');
    });

    it('uses generic message when authenticate returns non-specific error', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({ message: 'Account locked' }, { status: 403 }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'user@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'pass');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent('Account locked');
      });
    });
  });

  // ─── Forgot Password → Code → Reset ────────────────────────────────────────

  describe('Forgot Password', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionData = { data: null, status: 'unauthenticated' };
      mockSearchParamsMap = {};
      mockWindowLocation();
    });

    afterEach(() => server.resetHandlers());

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
          return HttpResponse.json({ message: 'Invalid code' }, { status: 400 });
        }),
        http.post('/api/auth/email/reset-password', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.token === 'reset-token-abc') {
            return HttpResponse.json({ message: 'Password reset' });
          }
          return HttpResponse.json({ error: 'invalid_token' }, { status: 400 });
        }),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.type(screen.getByTestId('email-input'), 'forgot@test.com');
      await user.click(screen.getByTestId('forgot-password-link'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      });
      expect(screen.getByTestId('forgot-email-input')).toHaveValue('forgot@test.com');

      await user.click(screen.getByTestId('send-reset-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '654321'[i]);
      }

      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'NewStr0ng!Pass');
      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('confirm-password-input'), 'NewStr0ng!Pass');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-success')).toBeInTheDocument();
      });
      expect(screen.getByText(/Your password has been reset/)).toBeInTheDocument();
    });

    it('shows error for wrong reset code', async () => {
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

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '0');
      }

      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Invalid or expired code',
        );
      });
      expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
    });

    it('rejects mismatched passwords in the new password step', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'NewStr0ng!Pass');
      await user.type(screen.getByTestId('confirm-password-input'), 'DifferentP@ss1');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent('Passwords do not match');
      });
    });

    it('redirects back to code view when reset token has expired', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'expired-tok' }),
        ),
        http.post('/api/auth/email/reset-password', () =>
          HttpResponse.json(
            {
              error: 'token_expired',
              message: 'Verification expired. Please request a new code.',
            },
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }
      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'NewStr0ng!Pass');
      await user.type(screen.getByTestId('confirm-password-input'), 'NewStr0ng!Pass');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-code-view')).toBeInTheDocument();
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Verification expired',
        );
      });
    });

    it('rejects weak new password client-side', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }
      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'weak');
      await user.type(screen.getByTestId('confirm-password-input'), 'weak');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toBeInTheDocument();
      });
      expect(resetFetchSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Forgot Password Navigation ────────────────────────────────────────────

  describe('Forgot Password Navigation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionData = { data: null, status: 'unauthenticated' };
      mockSearchParamsMap = {};
      mockWindowLocation();
    });

    afterEach(() => server.resetHandlers());

    it('allows returning to login from code view', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
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

      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('allows returning to login from new-password view', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }
      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('returns to login from success view after full reset', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
        http.post('/api/auth/email/reset-password', () => HttpResponse.json({ message: 'ok' })),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }
      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'NewStr0ng!Pass');
      await user.type(screen.getByTestId('confirm-password-input'), 'NewStr0ng!Pass');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-success')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('back-to-login-btn'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    });

    it('shows network error when forgot-password API throws', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.error()),
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
        expect(screen.getByTestId('forgot-error')).toHaveTextContent('Network error');
      });
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
    });

    it('shows network error when reset-password API throws', async () => {
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
        http.post('/api/auth/email/verify-reset-code', () =>
          HttpResponse.json({ token: 'tok' }),
        ),
        http.post('/api/auth/email/reset-password', () => HttpResponse.error()),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }
      await waitFor(() => {
        expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-password-input'), 'NewStr0ng!Pass');
      await user.type(screen.getByTestId('confirm-password-input'), 'NewStr0ng!Pass');
      await user.click(screen.getByTestId('reset-password-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent('Network error');
      });
      expect(screen.getByTestId('reset-new-password-view')).toBeInTheDocument();
    });

    it('resends forgot-password code', async () => {
      let resendCalled = false;
      server.use(
        http.post('/api/auth/email/forgot-password', () => HttpResponse.json({ message: 'ok' })),
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
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('resend-code-btn'));

      await waitFor(() => {
        expect(resendCalled).toBe(true);
      });
      expect(screen.getByTestId('resend-code-btn')).toBeDisabled();
    });
  });

  // ─── View Transitions ──────────────────────────────────────────────────────

  describe('View Transitions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionData = { data: null, status: 'unauthenticated' };
      mockSearchParamsMap = {};
      mockWindowLocation();
    });

    afterEach(() => server.resetHandlers());

    it('switches between login, register, verify, and forgot-password views', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Start at login
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();

      // Switch to register
      await user.click(screen.getByTestId('switch-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();

      // Switch back to login
      await user.click(screen.getByTestId('switch-to-login'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();

      // Go to forgot password
      await user.click(screen.getByTestId('forgot-password-link'));
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();

      // Go back from forgot password
      await user.click(screen.getByTestId('back-to-login-link'));
      expect(screen.getByTestId('email-login-form')).toBeInTheDocument();

      // Register → submit → verify → back
      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('back-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    });
  });

  // ─── Disabled States ───────────────────────────────────────────────────────

  describe('Disabled States', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionData = { data: null, status: 'unauthenticated' };
      mockSearchParamsMap = {};
      mockWindowLocation();
    });

    afterEach(() => server.resetHandlers());

    it('submit button is disabled when email or password is empty', () => {
      render(<EmailLoginForm />);
      expect(screen.getByTestId('email-submit-btn')).toBeDisabled();
    });

    it('clears error when email field changes', async () => {
      server.use(
        http.post('/api/auth/email/authenticate', () =>
          HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 }),
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

      await user.type(screen.getByTestId('email-input'), 'x');
      expect(screen.queryByTestId('email-auth-error')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Login Page — Token Handling (using Login page with mocked LoginFragment)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Token Handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSearchParamsMap = {};
      mockSessionData = { data: null, status: 'unauthenticated' };
    });

    it('renders without banners when no tokens present', () => {
      render(<Login />);
      expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('login-fragment')).toBeInTheDocument();
    });

    it('shows invite banner when ?invite=<token> is in URL', () => {
      mockSearchParamsMap = { invite: 'inv_token_123' };
      render(<Login />);

      const banner = screen.getByTestId('invite-banner');
      expect(banner).toBeInTheDocument();
      expect(banner.textContent).toContain('invited to join an organization');
    });

    it('shows invite banner (not credit) when both tokens present', () => {
      mockSearchParamsMap = { invite: 'inv_token', credit: 'cred_token' };
      render(<Login />);

      expect(screen.getByTestId('invite-banner')).toBeInTheDocument();
      expect(screen.queryByTestId('credit-banner')).not.toBeInTheDocument();
    });

    it('sets callback URL to /login/invite when invite token present', async () => {
      mockSearchParamsMap = { invite: 'inv_abc' };
      render(<Login />);

      await userEvent.click(screen.getByTestId('google-login'));

      expect(mockSignIn).toHaveBeenCalledWith(
        'google',
        expect.objectContaining({
          callbackUrl: expect.stringContaining('/login/invite'),
        }),
      );

      const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
      const parsed = new URL(callbackUrl);
      expect(parsed.pathname).toBe('/login/invite');
      expect(parsed.searchParams.get('token')).toBe('inv_abc');
    });

    it('sets callback URL to /assistants when credit token present', async () => {
      mockSearchParamsMap = { credit: 'cred_xyz' };
      render(<Login />);

      await userEvent.click(screen.getByTestId('microsoft-login'));

      const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
      const parsed = new URL(callbackUrl);
      expect(parsed.pathname).toBe('/assistants');
      expect(parsed.searchParams.get('token')).toBe('cred_xyz');
    });

    it('uses explicit callbackUrl when no tokens present', async () => {
      mockSearchParamsMap = { callbackUrl: '/billing' };
      render(<Login />);

      await userEvent.click(screen.getByTestId('google-login'));

      const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
      const parsed = new URL(callbackUrl);
      expect(parsed.pathname).toBe('/billing');
    });

    it('invite token takes priority over callbackUrl', async () => {
      mockSearchParamsMap = { invite: 'inv_priority', callbackUrl: '/billing' };
      render(<Login />);

      await userEvent.click(screen.getByTestId('google-login'));

      const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
      const parsed = new URL(callbackUrl);
      expect(parsed.pathname).toBe('/login/invite');
      expect(parsed.searchParams.get('token')).toBe('inv_priority');
    });
  });

  // ─── Stale Session Signout (?signout=true) ─────────────────────────────────

  describe('Stale Session Signout', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSearchParamsMap = {};
      mockSessionData = { data: null, status: 'unauthenticated' };
    });

    it('calls signOut and shows loading when signout=true with authenticated session', async () => {
      mockSearchParamsMap = { signout: 'true' };
      mockSessionData = {
        data: { user: { email: 'deleted@example.com' } },
        status: 'authenticated',
      };

      render(<Login />);

      expect(screen.getByTestId('loading-element')).toBeInTheDocument();
      expect(screen.queryByTestId('login-fragment')).not.toBeInTheDocument();
      expect(mockRedirect).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
      });
    });

    it('cleans up URL after signing out', async () => {
      mockSearchParamsMap = { signout: 'true' };
      mockSessionData = {
        data: { user: { email: 'deleted@example.com' } },
        status: 'authenticated',
      };

      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });

      render(<Login />);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
      });

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('shows login form directly when signout=true but session is already gone', () => {
      mockSearchParamsMap = { signout: 'true' };
      mockSessionData = { data: null, status: 'unauthenticated' };

      render(<Login />);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('does NOT call signOut when signout param is absent', () => {
      mockSearchParamsMap = {};
      mockSessionData = { data: null, status: 'unauthenticated' };

      render(<Login />);

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(screen.getByTestId('login-fragment')).toBeInTheDocument();
    });
  });

  // ─── Authenticated Redirect ────────────────────────────────────────────────

  describe('Authenticated Redirect', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSearchParamsMap = {};
    });

    it('redirects to /assistants when session exists and signout is not requested', () => {
      mockSessionData = {
        data: { user: { email: 'active@example.com' } },
        status: 'authenticated',
      };

      render(<Login />);
      expect(mockRedirect).toHaveBeenCalledWith('/assistants');
    });

    it('does NOT redirect when session exists but signout=true', () => {
      mockSearchParamsMap = { signout: 'true' };
      mockSessionData = {
        data: { user: { email: 'deleted@example.com' } },
        status: 'authenticated',
      };

      render(<Login />);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});

