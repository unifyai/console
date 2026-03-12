/**
 * Signup journey tests — "I'm creating an account for the first time."
 *
 * Covers:
 * - Registration form → email verification → sign-in
 * - Registration error paths (weak password, existing email, provider conflict, network)
 * - Verification edge cases (callbackUrl, network error, resend + cooldown)
 * - Onboarding (workspace selection: personal vs organization)
 * - Invite acceptance (success, MFA required, email mismatch, errors)
 *
 * Real components: EmailLoginForm, WorkspaceContent, InviteContent
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

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: () => ({ data: null, status: 'unauthenticated', update: vi.fn() }),
}));

const pushMock = vi.fn();
let mockPathname = '/login';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('framer-motion', () => ({
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

// Import REAL components
import EmailLoginForm from '@/components/Pages/Login/EmailLoginForm';
import WorkspaceContent from '@/components/Pages/Onboarding/WorkspaceContent';
import InviteContent from '@/components/Pages/Invite/Main';
import { mockWindowLocation } from './fixtures';

// ═══════════════════════════════════════════════════════════════════════════════
// Registration → Verification → Sign-In
// ═══════════════════════════════════════════════════════════════════════════════

describe('Signup Journey', () => {
  describe('Registration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockPathname = '/login';
      mockWindowLocation('/login');
    });

    afterEach(() => server.resetHandlers());

    it('completes full registration → verification → sign-in flow', async () => {
      server.use(
        http.post('/api/auth/email/register', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ email: body.email, requiresVerification: true });
        }),
        http.post('/api/auth/email/verify', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === '123456') {
            return HttpResponse.json({ id: 'user-new-1', email: body.email, name: 'Test' });
          }
          return HttpResponse.json({ message: 'Invalid code' }, { status: 400 });
        }),
      );
      mockSignIn.mockResolvedValueOnce({ url: '/login/onboarding', error: null, ok: true });

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      // Switch to registration
      await user.click(screen.getByTestId('switch-to-register'));
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();

      // Fill form
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');

      // Password strength indicator renders with all rules passing
      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('email-first-name-input'), 'Test');
      await user.type(screen.getByTestId('email-last-name-input'), 'User');

      // Submit registration
      await user.click(screen.getByTestId('email-submit-btn'));

      // Verification code input appears
      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });
      expect(screen.getByText('new@test.com')).toBeInTheDocument();

      // Enter 6-digit code
      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '123456'[i]);
      }

      // signIn called with correct args
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

    it('shows error on invalid verification code', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
        http.post('/api/auth/email/verify', () =>
          HttpResponse.json({ message: 'Invalid or expired code' }, { status: 400 }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '9');
      }

      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent(
          'Invalid or expired code',
        );
      });
    });

    it('rejects registration with weak password client-side', async () => {
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

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toBeInTheDocument();
      });
      // Register API should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('shows network error when register API throws', async () => {
      server.use(http.post('/api/auth/email/register', () => HttpResponse.error()));

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent('Network error');
      });
    });

    it('shows backend error for existing email', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ message: 'Email already registered' }, { status: 409 }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'existing@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('email-auth-error')).toHaveTextContent('Email already registered');
      });
      expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    });

    it('shows provider conflict during registration', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ providers: ['google', 'azure-ad'] }, { status: 400 }),
        ),
      );

      const user = userEvent.setup();
      render(<EmailLoginForm />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'sso@corp.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        const errorText = screen.getByTestId('email-auth-error').textContent ?? '';
        expect(errorText).toContain('Google');
        expect(errorText).toContain('Azure-ad');
      });
    });
  });

  // ─── Verification Edge Cases ───────────────────────────────────────────────

  describe('Verification Edge Cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockPathname = '/login';
      mockWindowLocation('/login');
    });

    afterEach(() => server.resetHandlers());

    it('redirects to callbackUrl instead of /login/onboarding when provided', async () => {
      server.use(
        http.post('/api/auth/email/register', () =>
          HttpResponse.json({ email: 'new@test.com', requiresVerification: true }),
        ),
        http.post('/api/auth/email/verify', () =>
          HttpResponse.json({ id: 'user-1', email: 'new@test.com' }),
        ),
      );
      mockSignIn.mockResolvedValueOnce({ url: '/invite?token=abc', ok: true, error: null });

      const user = userEvent.setup();
      render(<EmailLoginForm callbackUrl="/invite?token=abc" />);

      await user.click(screen.getByTestId('switch-to-register'));
      await user.type(screen.getByTestId('email-input'), 'new@test.com');
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '123456'[i]);
      }

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({ callbackUrl: '/invite?token=abc' }),
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
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`code-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(screen.getByTestId('verification-error')).toHaveTextContent('Network error');
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
      await user.type(screen.getByTestId('email-password-input'), 'StrongP@ss1');
      await user.click(screen.getByTestId('email-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('resend-code-btn'));

      await waitFor(() => {
        expect(resendCalled).toBe(true);
      });

      expect(screen.getByTestId('resend-code-btn')).toBeDisabled();
      expect(screen.getByTestId('resend-code-btn')).toHaveTextContent(/Resend code in \d+s/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Onboarding — Workspace Selection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Onboarding', () => {
    let mockCreateOrg: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
    let mockUpdateOnboarding: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
    let mockPatchSession: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockPathname = '/login/onboarding';
      mockWindowLocation('/login/onboarding');
      mockCreateOrg = vi.fn();
      mockUpdateOnboarding = vi.fn().mockResolvedValue(undefined);
      mockPatchSession = vi.fn().mockResolvedValue(undefined);
      server.use(http.post('/api/session/workspace', () => HttpResponse.json({ ok: true })));
    });

    afterEach(() => server.resetHandlers());

    const renderOnboarding = () =>
      render(
        <WorkspaceContent
          onCreateOrg={mockCreateOrg}
          onUpdateOnboarding={mockUpdateOnboarding}
          onPatchSession={mockPatchSession}
        />,
      );

    it('selects personal workspace and completes onboarding', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      expect(screen.getByText('Welcome to Unify')).toBeInTheDocument();
      expect(screen.queryByTestId('workspace-continue')).toBeNull();

      await user.click(screen.getByTestId('workspace-personal'));
      expect(screen.getByTestId('workspace-continue')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');
      expect(screen.queryByTestId('org-name-input')).toBeNull();

      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(mockUpdateOnboarding).toHaveBeenCalledWith({
          currentStep: 'completed',
          stepData: { selectedType: 'personal' },
        });
      });
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {},
      );
    });

    it('creates an organization and completes onboarding', async () => {
      mockCreateOrg.mockResolvedValue({ id: 42, name: 'Acme Corp' });

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));

      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      expect(screen.getByTestId('workspace-continue')).toBeDisabled();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Create Organization');

      await user.type(screen.getByTestId('org-name-input'), 'Acme Corp');
      expect(screen.getByTestId('workspace-continue')).not.toBeDisabled();

      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(mockCreateOrg).toHaveBeenCalledWith('Acme Corp');
      });

      await waitFor(() => {
        expect(mockUpdateOnboarding).toHaveBeenCalledWith({
          currentStep: 'completed',
          stepData: {
            selectedType: 'organization',
            organizationId: '42',
            organizationName: 'Acme Corp',
          },
        });
      });
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {},
      );
    });

    it('shows error when organization creation fails', async () => {
      mockCreateOrg.mockResolvedValue({ detail: 'Organization name already taken' });

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), 'Existing Corp');
      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-error')).toHaveTextContent(
          'Organization name already taken',
        );
      });
      expect(mockPatchSession).not.toHaveBeenCalled();
    });

    it('shows error when org creation throws an exception', async () => {
      mockCreateOrg.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), 'New Corp');
      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-error')).toHaveTextContent(
          'Failed to create organization',
        );
      });
    });

    it('switches between personal and organization choices', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-personal'));
      expect(screen.queryByTestId('org-name-input')).toBeNull();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Create Organization');

      await user.click(screen.getByTestId('workspace-personal'));
      expect(screen.queryByTestId('org-name-input')).toBeNull();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');
    });

    it('sets workspace cookie when creating an organization', async () => {
      let cookieBody: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/session/workspace', async ({ request }) => {
          cookieBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true });
        }),
      );
      mockCreateOrg.mockResolvedValue({ id: 55, name: 'New Corp' });

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), 'New Corp');
      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(cookieBody).toEqual({ workspaceId: '55' });
      });
    });

    it('treats whitespace-only name as empty (button stays disabled)', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), '   ');
      expect(screen.getByTestId('workspace-continue')).toBeDisabled();
    });

    it('disables choice buttons during loading', async () => {
      mockCreateOrg.mockImplementation(() => new Promise(() => {})); // never resolves

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), 'Corp');
      await user.click(screen.getByTestId('workspace-continue'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-personal')).toBeDisabled();
        expect(screen.getByTestId('workspace-organization')).toBeDisabled();
        expect(screen.getByTestId('workspace-continue')).toBeDisabled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Invite Acceptance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Invite Acceptance', () => {
    let mockOnAccept: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
    let mockPatchSession: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
    let locationHref: string;

    beforeEach(() => {
      vi.clearAllMocks();
      mockPathname = '/login/invite';
      mockOnAccept = vi.fn();
      mockPatchSession = vi.fn().mockResolvedValue(undefined);
      locationHref = 'http://localhost:3000/login/invite';
      Object.defineProperty(window, 'location', {
        value: {
          get href() {
            return locationHref;
          },
          set href(val: string) {
            locationHref = val;
          },
          origin: 'http://localhost:3000',
          protocol: 'http:',
          host: 'localhost:3000',
          hostname: 'localhost',
          port: '3000',
          pathname: '/login/invite',
          search: '',
          hash: '',
          assign: vi.fn(),
          replace: vi.fn(),
        },
        writable: true,
      });
    });

    afterEach(() => vi.useRealTimers());

    const renderInvite = (token = 'test-invite-token') =>
      render(
        <InviteContent token={token} onAccept={mockOnAccept} onPatchSession={mockPatchSession} />,
      );

    it('passes the correct token to onAccept', () => {
      mockOnAccept.mockReturnValue(new Promise(() => {}));
      renderInvite('my-special-token');
      expect(mockOnAccept).toHaveBeenCalledWith('my-special-token');
    });

    it('shows processing UI while invite is being accepted', () => {
      mockOnAccept.mockReturnValue(new Promise(() => {}));
      renderInvite();

      expect(screen.getByText('Joining Organization...')).toBeInTheDocument();
      expect(screen.getByText(/Please wait while we process/)).toBeInTheDocument();
    });

    it('shows success with org name and calls server action', async () => {
      mockOnAccept.mockResolvedValue({ success: true, organizationName: 'Acme Corp' });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText(/You have successfully joined/)).toBeInTheDocument();

      await user.click(screen.getByTestId('get-started-btn'));
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {},
      );
    });

    it('shows MFA required message and auto-redirects', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockOnAccept.mockResolvedValue({
        success: true,
        mfaSetupRequired: true,
        organizationName: 'Secure Corp',
      });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
        expect(screen.getByText(/requires two-factor authentication/)).toBeInTheDocument();
      });
      expect(screen.getByText('Secure Corp')).toBeInTheDocument();
      expect(mockPatchSession).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2500);

      await waitFor(() => {
        expect(mockPatchSession).toHaveBeenCalledWith(
          { onboardingStep: 'completed' },
          '/login/mfa',
          {},
        );
      });

      vi.useRealTimers();
    });

    it('shows email mismatch error with Back to Login and Continue buttons', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'This invite is for a different email address',
      });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
      });
      expect(
        screen.getByText('This invite is for a different email address'),
      ).toBeInTheDocument();

      expect(screen.getByTestId('back-to-login-btn')).toBeInTheDocument();
      expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();

      await user.click(screen.getByTestId('back-to-login-btn'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
        expect(locationHref).toBe('/login');
      });
    });

    it('navigates to /login/onboarding when Continue anyway clicked', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'This invite is for a different email address',
      });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('continue-anyway-btn'));
      expect(pushMock).toHaveBeenCalledWith('/login/onboarding');
    });

    it('shows generic error with Return to Console button', async () => {
      mockOnAccept.mockResolvedValue({ detail: 'Invite has expired' });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(screen.getByText('Invite has expired')).toBeInTheDocument();
      });

      // Generic error should NOT show email-mismatch buttons
      expect(screen.queryByTestId('back-to-login-btn')).toBeNull();
      expect(screen.queryByTestId('continue-anyway-btn')).toBeNull();

      const returnBtn = screen.getByText('Return to Console');
      await user.click(returnBtn);
      expect(pushMock).toHaveBeenCalledWith('/');
    });

    it('shows error when onAccept throws an exception', async () => {
      mockOnAccept.mockRejectedValue(new Error('Network failure'));

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
      });
    });

    it('only calls onAccept once (idempotency)', async () => {
      mockOnAccept.mockResolvedValue({ success: true });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      expect(mockOnAccept).toHaveBeenCalledTimes(1);
    });
  });
});

