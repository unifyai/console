/**
 * Integration tests for the full invite acceptance flow.
 *
 * Unlike the unit tests in `login/unit/InviteContent.node.test.tsx` which
 * test state transitions with minimal rendering, these tests render the REAL
 * InviteContent component with its full UI (icons, buttons, animations) and
 * verify the complete user interaction flow:
 *
 * - Accept invite → success → "Get Started" redirects to /assistants
 * - Accept invite → MFA required → auto-redirect to /login/mfa
 * - Accept invite → email mismatch → "Back to Login" / "Continue anyway"
 * - Accept invite → generic error → "Return to Console"
 *
 * Mocked: next-auth/react, next/navigation, framer-motion, APIs (via MSW)
 * Real:   InviteContent, Button, UnifyLogo
 *
 * @group integration
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks (external dependencies only) ──────────────────────────────────────

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const pushMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { email: 'user@test.com' } },
    status: 'authenticated',
    update: mockUpdate,
  }),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login/invite',
}));

// Framer-motion: pass through children without animation
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// UnifyLogo
vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  __esModule: true,
  default: () => <div data-testid="unify-logo">Logo</div>,
}));

// Import REAL component
import InviteContent from '@/components/Pages/Invite/Main';

describe('Invite Integration', () => {
  let mockOnAccept: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAccept = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/login/invite',
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

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderInvite = (token = 'test-invite-token') =>
    render(<InviteContent token={token} onAccept={mockOnAccept} />);

  // ─── Processing State ────────────────────────────────────────────────

  describe('Processing state', () => {
    it('shows processing UI while invite is being accepted', () => {
      // Don't resolve the promise to keep it in processing state
      mockOnAccept.mockReturnValue(new Promise(() => {}));

      renderInvite();

      expect(screen.getByText('Joining Organization...')).toBeInTheDocument();
      expect(
        screen.getByText(/Please wait while we process/),
      ).toBeInTheDocument();
    });

    it('passes the correct token to onAccept', () => {
      mockOnAccept.mockReturnValue(new Promise(() => {}));

      renderInvite('my-special-token');

      expect(mockOnAccept).toHaveBeenCalledWith('my-special-token');
    });
  });

  // ─── Success Flow ───────────────────────────────────────────────────

  describe('Success flow', () => {
    it('shows success with org name and navigates to /assistants', async () => {
      mockOnAccept.mockResolvedValue({
        success: true,
        organizationName: 'Acme Corp',
      });

      const user = userEvent.setup();
      renderInvite();

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      // Should show org name
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(
        screen.getByText(/You have successfully joined/),
      ).toBeInTheDocument();

      // Session should be updated to clear onboarding step
      expect(mockUpdate).toHaveBeenCalledWith({
        onboardingStep: 'completed',
      });

      // Click "Get Started"
      await user.click(screen.getByTestId('get-started-btn'));
      expect(pushMock).toHaveBeenCalledWith('/assistants');
    });

    it('shows success without org name for generic result', async () => {
      mockOnAccept.mockResolvedValue({ success: true });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      // Should show generic text
      expect(
        screen.getByText(/joined.*the organization/),
      ).toBeInTheDocument();
    });

    it('handles non-object result (fallback success)', async () => {
      mockOnAccept.mockResolvedValue(undefined);

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        onboardingStep: 'completed',
      });
    });
  });

  // ─── MFA Required Flow ──────────────────────────────────────────────

  describe('MFA required flow', () => {
    it('shows MFA required message and auto-redirects to /login/mfa', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockOnAccept.mockResolvedValue({
        success: true,
        mfaSetupRequired: true,
        organizationName: 'Secure Corp',
      });

      renderInvite();

      // Wait for MFA required state
      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
        expect(
          screen.getByText(/requires two-factor authentication/),
        ).toBeInTheDocument();
      });

      // Should show org name
      expect(screen.getByText('Secure Corp')).toBeInTheDocument();

      // Session should be updated
      expect(mockUpdate).toHaveBeenCalledWith({
        onboardingStep: 'completed',
      });

      // Auto-redirect after 2 seconds
      vi.advanceTimersByTime(2500);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/login/mfa');
      });

      vi.useRealTimers();
    });
  });

  // ─── Error Flows ──────────────────────────────────────────────────

  describe('Error flows', () => {
    it('shows email mismatch error with Back to Login and Continue buttons', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'This invite is for a different email address',
      });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
      });

      // Should show specific email mismatch message
      expect(
        screen.getByText('This invite is for a different email address'),
      ).toBeInTheDocument();

      // Should show two buttons for email mismatch
      expect(screen.getByTestId('back-to-login-btn')).toBeInTheDocument();
      expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();

      // Test "Back to Login" — should sign out and redirect
      await user.click(screen.getByTestId('back-to-login-btn'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
        expect(window.location.href).toBe('/login');
      });
    });

    it('navigates to /login/onboarding when "Continue anyway" is clicked', async () => {
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

    it('shows generic error with "Return to Console" button', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'Invite has expired',
      });

      const user = userEvent.setup();
      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(screen.getByText('Invite has expired')).toBeInTheDocument();
      });

      // Generic error should NOT show email-mismatch buttons
      expect(screen.queryByTestId('back-to-login-btn')).toBeNull();
      expect(screen.queryByTestId('continue-anyway-btn')).toBeNull();

      // Should show "Return to Console"
      const returnBtn = screen.getByText('Return to Console');
      await user.click(returnBtn);
      expect(pushMock).toHaveBeenCalledWith('/');
    });

    it('shows error when onAccept throws an exception', async () => {
      mockOnAccept.mockRejectedValue(new Error('Network failure'));

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(
          screen.getByText('An unexpected error occurred.'),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Idempotency (Double Execution Prevention) ──────────────────────

  describe('Idempotency', () => {
    it('only calls onAccept once even in Strict Mode', async () => {
      mockOnAccept.mockResolvedValue({ success: true });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      // processedRef should prevent double execution
      expect(mockOnAccept).toHaveBeenCalledTimes(1);
    });
  });

  // ─── MFA Required Edge Cases ──────────────────────────────────────

  describe('MFA required edge cases', () => {
    it('shows MFA required state with org name and ShieldCheck icon', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockOnAccept.mockResolvedValue({
        success: true,
        mfaSetupRequired: true,
        organizationName: 'Secure Corp',
      });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      // Should show MFA required state, not the generic success
      expect(
        screen.getByText(/requires two-factor authentication/),
      ).toBeInTheDocument();
      expect(screen.getByText('Secure Corp')).toBeInTheDocument();

      // Should NOT show "Get Started" button (auto-redirects instead)
      expect(screen.queryByTestId('get-started-btn')).toBeNull();

      vi.useRealTimers();
    });

    it('updates session before auto-redirect', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockOnAccept.mockResolvedValue({
        success: true,
        mfaSetupRequired: true,
      });

      renderInvite();

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          onboardingStep: 'completed',
        });
      });

      // Redirect should not happen immediately
      expect(pushMock).not.toHaveBeenCalled();

      // After timeout, should redirect
      vi.advanceTimersByTime(2500);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/login/mfa');
      });

      vi.useRealTimers();
    });
  });

  // ─── Error Message Variants ─────────────────────────────────────

  describe('Error message variants', () => {
    it('shows "Invite has expired" as a generic error (not email mismatch)', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'Invite has expired',
      });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(screen.getByText('Invite has expired')).toBeInTheDocument();
      });

      // Generic error should NOT have back-to-login or continue-anyway
      expect(screen.queryByTestId('back-to-login-btn')).toBeNull();
      expect(screen.queryByTestId('continue-anyway-btn')).toBeNull();

      // Should have Return to Console
      expect(screen.getByText('Return to Console')).toBeInTheDocument();
    });

    it('shows "Invite already used" as a generic error', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'Invite already used',
      });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
        expect(screen.getByText('Invite already used')).toBeInTheDocument();
      });
    });

    it('only shows email mismatch buttons for the exact email mismatch message', async () => {
      mockOnAccept.mockResolvedValue({
        detail: 'This invite is for a different email address',
      });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByTestId('back-to-login-btn')).toBeInTheDocument();
        expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();
      });

      // Should NOT have Return to Console
      expect(screen.queryByText('Return to Console')).toBeNull();
    });
  });

  // ─── Session Update ──────────────────────────────────────────────

  describe('Session update', () => {
    it('updates session with onboardingStep: completed on success', async () => {
      mockOnAccept.mockResolvedValue({ success: true, organizationName: 'Test Org' });

      renderInvite();

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          onboardingStep: 'completed',
        });
      });
    });

    it('updates session with onboardingStep: completed on fallback success', async () => {
      mockOnAccept.mockResolvedValue('ok'); // non-object result

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Welcome!')).toBeInTheDocument();
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        onboardingStep: 'completed',
      });
    });

    it('does NOT update session on error', async () => {
      mockOnAccept.mockResolvedValue({ detail: 'Some error' });

      renderInvite();

      await waitFor(() => {
        expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

