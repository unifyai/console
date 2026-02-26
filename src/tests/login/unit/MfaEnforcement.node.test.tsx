/**
 * Tests for Organization MFA Enforcement frontend components.
 *
 * Covers:
 * - MfaEnforcementBanner rendering (org name, CTA link, test IDs)
 * - MfaEnforcementGate conditional rendering (banner + children, blocking mode)
 * - getCurrentUser MFA enforcement check logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ShieldAlert: (props: any) => <svg data-testid="shield-alert-icon" {...props} />,
}));

// ─── MfaEnforcementBanner ─────────────────────────────────────────────────────

describe('MfaEnforcementBanner', () => {
  let MfaEnforcementBanner: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    MfaEnforcementBanner = (
      await import('@/components/Common/Auth/MfaEnforcementBanner')
    ).default;
  });

  it('renders the banner with org name', () => {
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.getByTestId('mfa-enforcement-banner')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('displays the 2FA requirement message', () => {
    render(<MfaEnforcementBanner orgName="Secure Inc" />);

    expect(
      screen.getByText(/requires all members to enable two-factor/i),
    ).toBeInTheDocument();
  });

  it('has a link to profile settings', () => {
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/profile#security');
  });

  it('renders the setup button with correct test ID', () => {
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.getByTestId('mfa-setup-redirect-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mfa-setup-redirect-btn')).toHaveTextContent(
      'Set up two-factor authentication',
    );
  });

  it('renders the shield alert icon', () => {
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
  });

  it('displays org name prominently with strong tag', () => {
    render(<MfaEnforcementBanner orgName="Test Organization" />);

    const strongElements = screen.getAllByText('Test Organization');
    // At least one should be in a strong tag
    const hasStrong = strongElements.some(
      (el) => el.tagName === 'STRONG',
    );
    expect(hasStrong).toBe(true);
  });

  it('renders correctly with special characters in org name', () => {
    render(<MfaEnforcementBanner orgName='Org "With" <Special> & Chars' />);

    expect(
      screen.getByText('Org "With" <Special> & Chars'),
    ).toBeInTheDocument();
  });
});

// ─── MfaEnforcementGate ───────────────────────────────────────────────────────

// The MfaEnforcementGate is a server component that calls getCurrentUser.
// We test its logic by mocking getCurrentUser and verifying rendering behavior.

describe('MfaEnforcementGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('renders children without banner when user has no mfaSetupRequired', async () => {
    vi.doMock('@/lib/user/user', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        mfaSetupRequired: undefined,
      }),
    }));

    const { default: MfaEnforcementGate } = await import(
      '@/components/Common/Auth/MfaEnforcementGate'
    );

    const result = await MfaEnforcementGate({
      children: <div data-testid="child-content">Hello</div>,
    });

    render(result);

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-enforcement-banner')).not.toBeInTheDocument();
  });

  it('renders banner + children when mfaSetupRequired is set (non-blocking)', async () => {
    vi.doMock('@/lib/user/user', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        mfaSetupRequired: { orgId: 42, orgName: 'Enforced Corp' },
      }),
    }));

    const { default: MfaEnforcementGate } = await import(
      '@/components/Common/Auth/MfaEnforcementGate'
    );

    const result = await MfaEnforcementGate({
      children: <div data-testid="child-content">Dashboard</div>,
    });

    render(result);

    expect(screen.getByTestId('mfa-enforcement-banner')).toBeInTheDocument();
    expect(screen.getByText('Enforced Corp')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders only banner when blocking=true and mfaSetupRequired is set', async () => {
    vi.doMock('@/lib/user/user', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        mfaSetupRequired: { orgId: 42, orgName: 'Enforced Corp' },
      }),
    }));

    const { default: MfaEnforcementGate } = await import(
      '@/components/Common/Auth/MfaEnforcementGate'
    );

    const result = await MfaEnforcementGate({
      children: <div data-testid="child-content">Should not appear</div>,
      blocking: true,
    });

    render(result);

    expect(screen.getByTestId('mfa-enforcement-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('renders children when user is null (not logged in)', async () => {
    vi.doMock('@/lib/user/user', () => ({
      getCurrentUser: vi.fn().mockResolvedValue(null),
    }));

    const { default: MfaEnforcementGate } = await import(
      '@/components/Common/Auth/MfaEnforcementGate'
    );

    const result = await MfaEnforcementGate({
      children: <div data-testid="child-content">Public page</div>,
    });

    render(result);

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-enforcement-banner')).not.toBeInTheDocument();
  });
});

// ─── User type: mfaSetupRequired shape ────────────────────────────────────────

describe('User type – mfaSetupRequired', () => {
  it('type allows orgId and orgName fields', () => {
    // This is a compile-time check, exercised here to ensure
    // the shape we depend on exists in the User interface
    const user: import('@/types/user').User = {
      id: 'user-1',
      name: 'Test',
      lastName: 'User',
      jobTitle: '',
      bio: '',
      image: '',
      timezone: null,
      email: 'test@test.com',
      phoneNumber: null,
      createdAt: '',
      apiKey: '',
      stripeCustomerId: '',
      organization: { name: 'Org', roleId: 1, roleName: 'member' },
      organizations: [],
      assistantHiringApproval: null,
      hasClaimedApprovalLink: '',
      mfaSetupRequired: {
        orgId: 1,
        orgName: 'Enforced Org',
      },
    };

    expect(user.mfaSetupRequired).toBeDefined();
    expect(user.mfaSetupRequired!.orgId).toBe(1);
    expect(user.mfaSetupRequired!.orgName).toBe('Enforced Org');
  });

  it('type allows mfaSetupRequired to be undefined', () => {
    const user: import('@/types/user').User = {
      id: 'user-2',
      name: 'No MFA',
      lastName: 'User',
      jobTitle: '',
      bio: '',
      image: '',
      timezone: null,
      email: 'no-mfa@test.com',
      phoneNumber: null,
      createdAt: '',
      apiKey: '',
      stripeCustomerId: '',
      organization: { name: 'Org', roleId: 1, roleName: 'member' },
      organizations: [],
      assistantHiringApproval: null,
      hasClaimedApprovalLink: '',
    };

    expect(user.mfaSetupRequired).toBeUndefined();
  });
});

