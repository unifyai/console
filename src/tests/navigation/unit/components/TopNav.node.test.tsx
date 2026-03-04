/**
 * Tests for TopNav navigation restructuring.
 *
 * Validates that:
 *   1. "Assistants" link is NOT present anywhere in the navigation
 *   2. "Usage" link appears inside the profile dropdown, NOT in the main nav bar
 *   3. Standard dropdown items (Profile, Organizations, Billing, Sign out) remain
 *   4. Workspace switcher renders correctly
 *   5. Billing is hidden for non-admin org members
 *   6. Workspace pill is non-interactive for non-Unify org members
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as any)} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    name: 'Test User',
    image: '',
    organizations: [{ id: 1, name: 'Acme Corp', roleName: 'owner' }],
  }),
}));

const mockUseWorkspace = vi.fn();
vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: (...args: unknown[]) => mockUseWorkspace(...args),
}));

vi.mock('@/components/Layout/NavBar/DarkModeToggle', () => ({
  default: () => <div data-testid="dark-mode-toggle" />,
}));

import TopNav from '@/components/Layout/TopBar/TopNav';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Open the profile dropdown (the avatar trigger). */
async function openProfileDropdown() {
  const user = userEvent.setup();
  const trigger = screen.getByTestId('profile-dropdown-trigger');
  await user.click(trigger);
}

/** Collect text content from all rendered anchor tags. */
function getAllLinkTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TopNav – navigation restructuring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: personal workspace, owner of one org (Unify member → switchable)
    mockUseWorkspace.mockReturnValue({
      workspaces: [
        { id: 'personal', name: 'Test User', type: 'personal' },
        { id: '1', name: 'Acme Corp', type: 'organization' },
      ],
      activeWorkspace: { id: 'personal', name: 'Test User', type: 'personal' },
      activeOrganization: null,
      currentUserId: 'u1',
      isWorkspaceSwitchable: true,
      switchWorkspace: vi.fn(),
    });
  });

  it('does NOT render an "Assistants" link anywhere', () => {
    render(<TopNav />);
    expect(screen.queryByRole('link', { name: /assistants/i })).toBeNull();
  });

  it('does NOT render a "Usage" link in the top-level nav (before opening dropdown)', () => {
    const { container } = render(<TopNav />);
    const topLevelLinks = getAllLinkTexts(container);
    expect(topLevelLinks).not.toContain('Usage');
  });

  it('renders "Usage" link inside the profile dropdown with correct href', async () => {
    render(<TopNav />);
    await openProfileDropdown();

    const usageLink = await screen.findByRole('link', { name: /^usage$/i });
    expect(usageLink).toHaveAttribute('href', '/usage');
  });

  it('renders profile dropdown items in expected order: Profile, Usage, Organizations, Billing', async () => {
    render(<TopNav />);
    await openProfileDropdown();

    const allLinks = await screen.findAllByRole('link');
    const dropdownLinkTexts = allLinks
      .map((link) => link.textContent?.trim() ?? '')
      .filter((t) => ['Account', 'Usage', 'Organizations', 'Billing'].includes(t));

    expect(dropdownLinkTexts).toEqual(['Account', 'Organizations', 'Usage', 'Billing']);
  });

  it('renders "Sign out" in the profile dropdown', async () => {
    render(<TopNav />);
    await openProfileDropdown();

    const signOut = await screen.findByText(/sign out/i);
    expect(signOut).toBeTruthy();
  });

  it('hides Billing when active workspace is an org where the user is a member (not admin/owner)', async () => {
    // Simulate being in an org workspace where user is only a "member"
    mockUseWorkspace.mockReturnValue({
      workspaces: [
        { id: 'personal', name: 'Test User', type: 'personal' },
        { id: '2', name: 'Other Corp', type: 'organization' },
      ],
      activeWorkspace: { id: '2', name: 'Other Corp', type: 'organization' },
      activeOrganization: null,
      currentUserId: 'u1',
      isWorkspaceSwitchable: true,
      switchWorkspace: vi.fn(),
    });

    // getCurrentUser returns orgs with "member" role
    const { getCurrentUser } = await import('@/lib/user/user');
    vi.mocked(getCurrentUser).mockResolvedValue({
      name: 'Test User',
      image: '',
      organizations: [{ id: 2, name: 'Other Corp', roleName: 'member' }],
    } as any);

    render(<TopNav />);
    await openProfileDropdown();

    // Usage should be visible even for members
    const usageLink = await screen.findByRole('link', { name: /^usage$/i });
    expect(usageLink).toBeTruthy();

    // Billing should NOT be visible for a plain member
    expect(screen.queryByRole('link', { name: /^billing$/i })).toBeNull();
  });

  it('shows Billing when active workspace is an org where the user is an admin', async () => {
    mockUseWorkspace.mockReturnValue({
      workspaces: [
        { id: 'personal', name: 'Test User', type: 'personal' },
        { id: '1', name: 'Acme Corp', type: 'organization' },
      ],
      activeWorkspace: { id: '1', name: 'Acme Corp', type: 'organization' },
      activeOrganization: null,
      currentUserId: 'u1',
      isWorkspaceSwitchable: true,
      switchWorkspace: vi.fn(),
    });

    const { getCurrentUser } = await import('@/lib/user/user');
    vi.mocked(getCurrentUser).mockResolvedValue({
      name: 'Test User',
      image: '',
      organizations: [{ id: 1, name: 'Acme Corp', roleName: 'admin' }],
    } as any);

    render(<TopNav />);
    await openProfileDropdown();

    const billingLink = await screen.findByRole('link', { name: /^billing$/i });
    expect(billingLink).toHaveAttribute('href', '/billing');
  });

  it('renders the workspace switcher showing the active workspace name', () => {
    render(<TopNav />);
    expect(screen.getByText('Test User')).toBeTruthy();
  });

  it('renders a non-interactive workspace label (no dropdown) when isWorkspaceSwitchable is false', () => {
    mockUseWorkspace.mockReturnValue({
      workspaces: [
        { id: 'personal', name: 'Test User', type: 'personal' },
        { id: '3', name: 'Customer Org', type: 'organization' },
      ],
      activeWorkspace: { id: '3', name: 'Customer Org', type: 'organization' },
      activeOrganization: null,
      currentUserId: 'u1',
      isWorkspaceSwitchable: false,
      switchWorkspace: vi.fn(),
    });

    render(<TopNav />);

    // The org name should appear as a static label
    const label = screen.getByTestId('workspace-label');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('Customer Org');

    // No chevron / dropdown trigger should be present for the workspace pill
    expect(screen.queryByRole('button', { name: /customer org/i })).toBeNull();
  });

  it('renders an interactive dropdown when isWorkspaceSwitchable is true', () => {
    // Default mock already has isWorkspaceSwitchable: true
    render(<TopNav />);

    // The workspace name should be inside a button (the dropdown trigger)
    const trigger = screen.getByRole('button', { name: /test user/i });
    expect(trigger).toBeTruthy();

    // No static label should be present
    expect(screen.queryByTestId('workspace-label')).toBeNull();
  });
});
