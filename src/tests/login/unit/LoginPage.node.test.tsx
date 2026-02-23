/**
 * Tests for the Login page – invite and credit token handling.
 *
 * Strategy:
 *   1. Test that invite/credit tokens from URL are persisted into the OAuth callback URL
 *   2. Test that banners appear when invite/credit tokens are present
 *   3. Test that normal login flow works without tokens
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next-auth/react
const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

// Mock next/navigation – mutable searchParams
let mockSearchParamsMap: Record<string, string> = {};
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsMap[key] ?? null,
  }),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

// Mock framer-motion (skip animations in tests)
vi.mock('framer-motion', () => ({
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock SVG imports
vi.mock('@/public/icons/back.svg', () => ({
  default: () => <svg data-testid="back-svg" />,
}));

// Mock child components to keep tests focused
vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  default: () => <div data-testid="unify-logo" />,
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

vi.mock('../../../app/login/check', () => ({
  default: () => <div data-testid="check-element" />,
}));

vi.mock('../../../app/login/login', () => ({
  default: ({ onLogin, error }: any) => (
    <div data-testid="login-fragment">
      {error && <div data-testid="login-error">{error}</div>}
      <button
        data-testid="google-login"
        onClick={onLogin('google')}
      >
        Continue with Google
      </button>
      <button
        data-testid="github-login"
        onClick={onLogin('github')}
      >
        Continue with Github
      </button>
    </div>
  ),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import Login from '@/app/login/page';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Login page – token handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsMap = {};
  });

  it('renders without banners when no tokens present', () => {
    render(<Login />);

    expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('credit-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-fragment')).toBeInTheDocument();
  });

  it('shows invite banner when ?invite=<token> is in URL', () => {
    mockSearchParamsMap = { invite: 'inv_token_123' };

    render(<Login />);

    const banner = screen.getByTestId('invite-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('invited to join an organization');
    expect(screen.queryByTestId('credit-banner')).not.toBeInTheDocument();
  });

  it('shows credit banner when ?credit=<token> is in URL', () => {
    mockSearchParamsMap = { credit: 'cred_token_456' };

    render(<Login />);

    const banner = screen.getByTestId('credit-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('credit grant waiting');
    expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
  });

  it('shows invite banner (not credit) when both tokens present', () => {
    mockSearchParamsMap = { invite: 'inv_token', credit: 'cred_token' };

    render(<Login />);

    expect(screen.getByTestId('invite-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('credit-banner')).not.toBeInTheDocument();
  });

  it('sets callback URL to /invite?token=<token> when invite token present', async () => {
    mockSearchParamsMap = { invite: 'inv_abc' };

    render(<Login />);

    const googleBtn = screen.getByTestId('google-login');
    await userEvent.click(googleBtn);

    expect(mockSignIn).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({
        callbackUrl: expect.stringContaining('/invite'),
      })
    );

    // Verify the callback URL includes the token
    const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
    const parsed = new URL(callbackUrl);
    expect(parsed.pathname).toBe('/invite');
    expect(parsed.searchParams.get('token')).toBe('inv_abc');
  });

  it('sets callback URL to /assistants?token=<token> when credit token present', async () => {
    mockSearchParamsMap = { credit: 'cred_xyz' };

    render(<Login />);

    const githubBtn = screen.getByTestId('github-login');
    await userEvent.click(githubBtn);

    expect(mockSignIn).toHaveBeenCalledWith(
      'github',
      expect.objectContaining({
        callbackUrl: expect.stringContaining('/assistants'),
      })
    );

    const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
    const parsed = new URL(callbackUrl);
    expect(parsed.pathname).toBe('/assistants');
    expect(parsed.searchParams.get('token')).toBe('cred_xyz');
  });

  it('uses default callback URL when no tokens present', async () => {
    mockSearchParamsMap = {};

    render(<Login />);

    const googleBtn = screen.getByTestId('google-login');
    await userEvent.click(googleBtn);

    expect(mockSignIn).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({
        callbackUrl: expect.stringContaining('/'),
      })
    );

    const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
    const parsed = new URL(callbackUrl);
    // Should NOT have invite or credit params
    expect(parsed.searchParams.get('token')).toBeNull();
  });

  it('uses explicit callbackUrl when no tokens present', async () => {
    mockSearchParamsMap = { callbackUrl: '/billing' };

    render(<Login />);

    const googleBtn = screen.getByTestId('google-login');
    await userEvent.click(googleBtn);

    const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
    const parsed = new URL(callbackUrl);
    expect(parsed.pathname).toBe('/billing');
  });

  it('invite token takes priority over callbackUrl', async () => {
    mockSearchParamsMap = { invite: 'inv_priority', callbackUrl: '/billing' };

    render(<Login />);

    const googleBtn = screen.getByTestId('google-login');
    await userEvent.click(googleBtn);

    const callbackUrl = mockSignIn.mock.calls[0][1].callbackUrl;
    const parsed = new URL(callbackUrl);
    expect(parsed.pathname).toBe('/invite');
    expect(parsed.searchParams.get('token')).toBe('inv_priority');
  });
});

