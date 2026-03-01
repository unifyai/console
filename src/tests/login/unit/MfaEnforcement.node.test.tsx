/**
 * Tests for Organization MFA Enforcement frontend components.
 *
 * Covers:
 * - MfaEnforcementBanner rendering (org name, CTA button, test IDs)
 * - MfaEnforcementGate conditional rendering (modal + children)
 * - getCurrentUser MFA enforcement check logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockPathname = '/assistants';

// Mock next/navigation (used by the modal's CTA button and pathname check)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => mockPathname,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ShieldAlert: (props: any) => <svg data-testid="shield-alert-icon" {...props} />,
  ShieldCheck: (props: any) => <svg data-testid="shield-check-icon" {...props} />,
}));

// Mock Dialog components (Radix-based)
vi.mock('@/components/UI/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  DialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));

// Mock TotpSetup (embedded inline in the banner now)
vi.mock('@/components/Common/Auth/TotpSetup', () => ({
  default: ({ autoStart, onEnabled }: any) => (
    <div data-testid="totp-setup-inline" data-auto-start={autoStart}>
      <button data-testid="totp-complete-btn" onClick={onEnabled}>
        Complete Setup
      </button>
    </div>
  ),
}));

// ─── MfaEnforcementBanner (modal) ─────────────────────────────────────────────

describe('MfaEnforcementBanner', () => {
  let MfaEnforcementBanner: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPathname = '/assistants'; // default: not on profile page
    MfaEnforcementBanner = (
      await import('@/components/Common/Auth/MfaEnforcementBanner')
    ).default;
  });

  it('renders the modal with org name', () => {
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

  it('embeds TotpSetup inline with autoStart', () => {
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    const totpSetup = screen.getByTestId('totp-setup-inline');
    expect(totpSetup).toBeInTheDocument();
    expect(totpSetup.getAttribute('data-auto-start')).toBe('true');
  });

  it('refreshes router when TotpSetup completes', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    const completeBtn = screen.getByTestId('totp-complete-btn');
    await userEvent.setup().click(completeBtn);

    // After setup completes, the component calls router.refresh()
    // to re-evaluate MfaEnforcementGate server-side
    expect(refreshMock).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows success state after TotpSetup completes', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { waitFor } = await import('@testing-library/react');
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    // Initially shows shield-alert icon and requirement message
    expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
    expect(screen.getByText(/requires all members to enable two-factor/i)).toBeInTheDocument();

    // Complete setup
    const completeBtn = screen.getByTestId('totp-complete-btn');
    await userEvent.setup().click(completeBtn);

    // After completion, should show shield-check icon and success message
    await waitFor(() => {
      expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument();
      expect(screen.getByText(/Two-factor authentication enabled/i)).toBeInTheDocument();
      expect(screen.getByText(/account is now secured/i)).toBeInTheDocument();
    });
  });

  it('does not render on the profile page', () => {
    mockPathname = '/profile';
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.queryByTestId('mfa-enforcement-banner')).not.toBeInTheDocument();
  });

  it('does not render on the invite page', () => {
    mockPathname = '/invite';
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.queryByTestId('mfa-enforcement-banner')).not.toBeInTheDocument();
  });

  it('does not render on the login invite page', () => {
    mockPathname = '/login/invite';
    render(<MfaEnforcementBanner orgName="Acme Corp" />);

    expect(screen.queryByTestId('mfa-enforcement-banner')).not.toBeInTheDocument();
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

  it('renders children without modal when user has no mfaSetupRequired', async () => {
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

  it('renders modal + children when mfaSetupRequired is set', async () => {
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

  it('renders modal + children even when blocking=true (modal overlays content)', async () => {
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
      children: <div data-testid="child-content">Should still render</div>,
      blocking: true,
    });

    render(result);

    expect(screen.getByTestId('mfa-enforcement-banner')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
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
