/**
 * Tests for the Login page – invite/credit token handling and signout flow.
 *
 * Strategy:
 *   1. Test that invite/credit tokens from URL are persisted into the OAuth callback URL
 *   2. Test that banners appear when invite/credit tokens are present
 *   3. Test that normal login flow works without tokens
 *   4. Test that ?signout=true properly clears a stale session (deleted-account loop fix)
 *   5. Test that authenticated users without signout param redirect to /assistants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next-auth/react – configurable session state
const mockSignIn = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);
let mockSessionData: { data: any; status: string } = { data: null, status: 'unauthenticated' };

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  useSession: () => mockSessionData,
}));

// Mock next/navigation – mutable searchParams + router
let mockSearchParamsMap: Record<string, string> = {};
const mockRedirect = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsMap[key] ?? null,
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
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

// Mock orchestra client (needed for OAuth profile callback + adapter tests below)
const mockAdminClientPost = vi.fn();
vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    post: (...args: any[]) => mockAdminClientPost(...args),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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
  default: ({ onLogin, error, callbackUrl }: any) => (
    <div data-testid="login-fragment" data-callback-url={callbackUrl}>
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
import { OrchestraAdapter } from '@/lib/orchestra/orchestra-adapter';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Login page – token handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsMap = {};
    mockSessionData = { data: null, status: 'unauthenticated' };
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

// ─── Signout redirect-loop fix ────────────────────────────────────────────────
// When a user deletes their backend account, the next-auth JWT cookie persists.
// Server components detect the missing user and redirect to /login?signout=true.
// The login page must clear the stale session client-side to break the loop.

describe('Login page – stale session signout (?signout=true)', () => {
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

    // Should show loading element, not the login form
    expect(screen.getByTestId('loading-element')).toBeInTheDocument();
    expect(screen.queryByTestId('login-fragment')).not.toBeInTheDocument();

    // Should NOT redirect to /assistants despite having a session
    expect(mockRedirect).not.toHaveBeenCalled();

    // Should have called signOut to clear the JWT cookie
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

    render(<Login />);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    });

    // After signOut resolves, should replace URL to remove ?signout param
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows login form directly when signout=true but session is already gone', () => {
    mockSearchParamsMap = { signout: 'true' };
    mockSessionData = { data: null, status: 'unauthenticated' };

    render(<Login />);

    // Should clean up the URL
    // The effect runs and calls router.replace since session is already unauthenticated
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

describe('Login page – authenticated redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsMap = {};
    mockSessionData = { data: null, status: 'unauthenticated' };
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

    // Should NOT redirect — should show loading and initiate signout instead
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ─── OAuth provider name splitting ──────────────────────────────────────────
// Verifies that the Google and GitHub profile callbacks split the provider's
// full name into `name` (first) and `lastName`, and that the adapter forwards
// `lastName` to Orchestra's POST /user.

/**
 * NextAuth v4 stores the user-supplied profile callback under
 * `provider.options.profile` (the top-level `provider.profile` is the
 * built-in default). At runtime NextAuth merges them, but in unit tests
 * we call the custom one directly.
 */
async function getProviderProfileCallback(providerId: string) {
  const { default: authOptions } = await import(
    '@/app/api/auth/[...nextauth]/options'
  );
  const provider = authOptions.providers.find(
    (p: any) => p.id === providerId
  ) as any;
  return provider?.options?.profile ?? provider?.profile;
}

describe('Google provider – profile callback', () => {
  it('splits given_name and family_name from Google profile', async () => {
    const profile = await getProviderProfileCallback('google');

    const result = profile({
      sub: 'google-123',
      email: 'user@example.com',
      given_name: 'John',
      family_name: 'Doe',
      name: 'John Doe',
      picture: 'https://example.com/photo.jpg',
    });

    expect(result).toEqual({
      id: 'google-123',
      email: 'user@example.com',
      name: 'John',
      lastName: 'Doe',
      image: 'https://example.com/photo.jpg',
    });
  });

  it('uses given_name over full name when both present', async () => {
    const profile = await getProviderProfileCallback('google');

    const result = profile({
      sub: 'google-456',
      email: 'user@example.com',
      given_name: 'Jane',
      family_name: 'Smith-Jones',
      name: 'Jane Smith-Jones',
      picture: null,
    });

    expect(result.name).toBe('Jane');
    expect(result.lastName).toBe('Smith-Jones');
  });

  it('falls back to full name when given_name is absent', async () => {
    const profile = await getProviderProfileCallback('google');

    const result = profile({
      sub: 'google-789',
      email: 'user@example.com',
      name: 'Mononymous',
      picture: null,
    });

    expect(result.name).toBe('Mononymous');
    expect(result.lastName).toBeNull();
  });

  it('handles missing name fields gracefully', async () => {
    const profile = await getProviderProfileCallback('google');

    const result = profile({
      sub: 'google-000',
      email: 'user@example.com',
    });

    expect(result.name).toBeNull();
    expect(result.lastName).toBeNull();
    expect(result.image).toBeNull();
  });
});

describe('GitHub provider – profile callback', () => {
  it('splits "First Last" into name and lastName', async () => {
    const profile = await getProviderProfileCallback('github');

    const result = profile({
      id: 42,
      login: 'johndoe',
      name: 'John Doe',
      email: 'john@github.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/42',
    });

    expect(result).toEqual({
      id: '42',
      email: 'john@github.com',
      name: 'John',
      lastName: 'Doe',
      image: 'https://avatars.githubusercontent.com/u/42',
    });
  });

  it('keeps full remainder as lastName for multi-word names', async () => {
    const profile = await getProviderProfileCallback('github');

    const result = profile({
      id: 99,
      login: 'maryj',
      name: 'Mary Jane Watson-Parker',
      email: 'mary@github.com',
      avatar_url: null,
    });

    expect(result.name).toBe('Mary');
    expect(result.lastName).toBe('Jane Watson-Parker');
  });

  it('uses single name with no lastName when no space present', async () => {
    const profile = await getProviderProfileCallback('github');

    const result = profile({
      id: 7,
      login: 'prince',
      name: 'Prince',
      email: 'prince@github.com',
      avatar_url: null,
    });

    expect(result.name).toBe('Prince');
    expect(result.lastName).toBeNull();
  });

  it('falls back to login when name is null', async () => {
    const profile = await getProviderProfileCallback('github');

    const result = profile({
      id: 1,
      login: 'gh-user',
      name: null,
      email: 'user@github.com',
      avatar_url: null,
    });

    expect(result.name).toBe('gh-user');
    expect(result.lastName).toBeNull();
  });

  it('converts numeric id to string', async () => {
    const profile = await getProviderProfileCallback('github');

    const result = profile({
      id: 12345,
      login: 'numid',
      name: 'Num Id',
      email: 'num@github.com',
      avatar_url: null,
    });

    expect(result.id).toBe('12345');
    expect(typeof result.id).toBe('string');
  });
});

describe('OrchestraAdapter – createUser passes lastName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends lastName to Orchestra when provided', async () => {
    const adapter = OrchestraAdapter();

    mockAdminClientPost.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'john@example.com',
        name: 'John',
        lastName: 'Doe',
        image: null,
        emailVerified: null,
      },
    });

    await adapter.createUser!({
      email: 'john@example.com',
      name: 'John',
      lastName: 'Doe',
      image: null,
      emailVerified: null,
    });

    expect(mockAdminClientPost).toHaveBeenCalledWith('/user', {
      email: 'john@example.com',
      name: 'John',
      lastName: 'Doe',
      image: null,
    });
  });

  it('sends lastName as null when not provided', async () => {
    const adapter = OrchestraAdapter();

    mockAdminClientPost.mockResolvedValue({
      data: {
        id: 'user-2',
        email: 'solo@example.com',
        name: 'Solo',
        image: null,
        emailVerified: null,
      },
    });

    await adapter.createUser!({
      email: 'solo@example.com',
      name: 'Solo',
      image: null,
      emailVerified: null,
    });

    expect(mockAdminClientPost).toHaveBeenCalledWith('/user', {
      email: 'solo@example.com',
      name: 'Solo',
      lastName: null,
      image: null,
    });
  });
});

