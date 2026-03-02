/**
 * Tests for the InviteContent component (invite acceptance flow).
 *
 * Strategy:
 *   1. Test that the processing state is shown immediately on mount
 *   2. Test that a successful invite acceptance shows the success state with org name
 *   3. Test that MFA-required invites show the mfa_required state and auto-redirect
 *   4. Test that a generic error from onAccept shows the error state
 *   5. Test that an email-mismatch error shows the two-button layout
 *   6. Test that "Get Started" calls the patchSession server action
 *   7. Test that "Back to Login" signs out and redirects
 *   8. Test that "Continue anyway" navigates to /login/onboarding
 *   9. Test that an unexpected exception shows a generic error message
 *  10. Test that onAccept is called exactly once (strict-mode guard)
 *
 * Note: Session updates now go through the `onPatchSession` server action
 * (CSRF-safe, not URL-accessible) instead of useSession().update().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('next-auth/react', () => ({
  signOut: (...args: any[]) => mockSignOut(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Simplify framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Simplify UI mocks
vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  default: () => <div data-testid="unify-logo" />,
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import InviteContent from '@/components/Pages/Invite/Main';

// Mock for the patchSessionAndRedirect server action
let mockPatchSession: ReturnType<typeof vi.fn>;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InviteContent – processing state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSession = vi.fn().mockResolvedValue(undefined);
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
      },
      writable: true,
    });
  });

  it('shows processing UI immediately on mount', () => {
    const onAccept = vi.fn(() => new Promise<void>(() => {}));

    render(<InviteContent token="tok_123" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    expect(screen.getByText('Joining Organization...')).toBeInTheDocument();
    expect(screen.getByText(/Please wait/)).toBeInTheDocument();
  });

  it('calls onAccept with the provided token', async () => {
    const onAccept = vi.fn().mockResolvedValue({ success: true });

    render(<InviteContent token="tok_abc" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith('tok_abc');
    });
  });

  it('calls onAccept exactly once (strict-mode guard)', async () => {
    const onAccept = vi.fn().mockResolvedValue({ success: true });

    render(<InviteContent token="tok_once" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(1);
    });
  });
});

describe('InviteContent – success state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSession = vi.fn().mockResolvedValue(undefined);
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
      },
      writable: true,
    });
  });

  it('shows success state with org name after acceptance', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      success: true,
      organizationName: 'Acme Corp',
    });

    render(<InviteContent token="tok_ok" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-btn')).toBeInTheDocument();
  });

  it('shows generic success text when org name is absent', async () => {
    const onAccept = vi.fn().mockResolvedValue({ success: true });

    render(<InviteContent token="tok_no_name" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    expect(screen.getByText(/the organization/)).toBeInTheDocument();
  });

  it('calls server action when "Get Started" is clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue({ success: true });

    render(<InviteContent token="tok_nav" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('get-started-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('get-started-btn'));

    expect(mockPatchSession).toHaveBeenCalledWith(
      { onboardingStep: 'completed' },
      '/assistants',
      {},
    );
  });
});

describe('InviteContent – MFA required state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSession = vi.fn().mockResolvedValue(undefined);
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
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows MFA required message when org requires MFA setup', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      success: true,
      mfaSetupRequired: true,
      organizationName: 'Secure Inc',
    });

    render(<InviteContent token="tok_mfa" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText(/requires two-factor authentication/)).toBeInTheDocument();
    });

    expect(screen.getByText('Secure Inc')).toBeInTheDocument();
  });

  it('auto-redirects via server action after a short delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const onAccept = vi.fn().mockResolvedValue({
      success: true,
      mfaSetupRequired: true,
      organizationName: 'MFA Org',
    });

    render(<InviteContent token="tok_mfa_redirect" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText(/requires two-factor authentication/)).toBeInTheDocument();
    });

    // Server action should not have been called yet
    expect(mockPatchSession).not.toHaveBeenCalled();

    // Advance past the 2s delay
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
});

describe('InviteContent – error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSession = vi.fn().mockResolvedValue(undefined);
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
      },
      writable: true,
    });
  });

  it('shows error state when onAccept returns a detail error', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'Invitation has expired',
    });

    render(<InviteContent token="tok_expired" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Invitation has expired')).toBeInTheDocument();
  });

  it('shows "Return to Console" button for generic errors', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'Something went wrong',
    });

    render(<InviteContent token="tok_err" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Return to Console')).toBeInTheDocument();
    });
  });

  it('shows generic error when onAccept throws', async () => {
    const onAccept = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(<InviteContent token="tok_throw" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
    });
  });

  it('does NOT call server action on error', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'Token invalid',
    });

    render(<InviteContent token="tok_no_clear" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Invitation Failed')).toBeInTheDocument();
    });

    expect(mockPatchSession).not.toHaveBeenCalled();
  });
});

describe('InviteContent – email mismatch error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSession = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'location', {
      value: {
        get href() { return 'http://localhost:3000/login/invite'; },
        set href(val: string) { /* allow signOut redirect */ },
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/login/invite',
        search: '',
        hash: '',
      },
      writable: true,
    });
  });

  it('shows two buttons when the error is an email mismatch', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'This invite is for a different email address',
    });

    render(<InviteContent token="tok_mismatch" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('back-to-login-btn')).toBeInTheDocument();
      expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();
    });

    expect(screen.queryByText('Return to Console')).not.toBeInTheDocument();
  });

  it('"Back to Login" calls signOut and redirects to /login', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'This invite is for a different email address',
    });

    let locationHref = 'http://localhost:3000/login/invite';
    Object.defineProperty(window, 'location', {
      value: {
        get href() { return locationHref; },
        set href(val: string) { locationHref = val; },
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/login/invite',
        search: '',
        hash: '',
      },
      writable: true,
    });

    render(<InviteContent token="tok_back" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('back-to-login-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('back-to-login-btn'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    });

    expect(locationHref).toBe('/login');
  });

  it('"Continue anyway" navigates to /login/onboarding', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'This invite is for a different email address',
    });

    render(<InviteContent token="tok_continue" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('continue-anyway-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('continue-anyway-btn'));

    expect(mockRouterPush).toHaveBeenCalledWith('/login/onboarding');
  });

  it('does NOT show two-button layout for non-mismatch errors', async () => {
    const onAccept = vi.fn().mockResolvedValue({
      detail: 'Invitation already used',
    });

    render(<InviteContent token="tok_used" onAccept={onAccept} onPatchSession={mockPatchSession} />);

    await waitFor(() => {
      expect(screen.getByText('Invitation already used')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('back-to-login-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('continue-anyway-btn')).not.toBeInTheDocument();
  });
});
