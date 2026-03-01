/**
 * Tests for the WorkspaceContent component (onboarding workspace selection).
 *
 * Strategy:
 *   1. Test that the selection UI renders with both options
 *   2. Test "Just for me" (personal) flow — marks step completed, redirects
 *   3. Test "For my team" flow — shows org name input, creates org, redirects
 *   4. Test idempotency — auto-completes when user already has an org
 *   5. Test validation — empty org name shows error
 *   6. Test API errors — org creation failure shows error, keeps form usable
 *   7. Test that the workspace cookie is set when org is created
 *   8. Test that onUpdateOnboarding failure is tolerated (best-effort)
 *   9. Test that the Continue button is disabled while loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockRouterPush = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1', email: 'me@test.com' } },
    status: 'authenticated',
    update: mockUpdate,
  }),
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

// Mock UI components
vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/UI/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  default: () => <div data-testid="unify-logo" />,
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import WorkspaceContent from '@/components/Pages/Onboarding/WorkspaceContent';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Track workspace cookie calls via MSW
let workspaceCookieCalls: { workspaceId: string }[] = [];

beforeEach(() => {
  workspaceCookieCalls = [];
  server.use(
    http.post('/api/session/workspace', async ({ request }) => {
      const body = (await request.json()) as { workspaceId: string };
      workspaceCookieCalls.push(body);
      return HttpResponse.json({ ok: true });
    }),
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkspaceContent – initial render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both workspace options', () => {
    const onCreateOrg = vi.fn();
    const onUpdateOnboarding = vi.fn();

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[]}
      />,
    );

    expect(screen.getByTestId('workspace-personal')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-organization')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Unify')).toBeInTheDocument();
    expect(screen.getByText(/How do you plan to use the platform/)).toBeInTheDocument();
  });

  it('does not show the Continue button until a choice is made', () => {
    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    expect(screen.queryByTestId('workspace-continue')).not.toBeInTheDocument();
  });

  it('shows the footer note about creating orgs later', () => {
    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    expect(screen.getByText(/You can always create an organization later/)).toBeInTheDocument();
  });
});

describe('WorkspaceContent – personal workspace flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking "Just for me" and Continue marks onboarding completed and redirects', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn();
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[]}
      />,
    );

    // Select personal
    await user.click(screen.getByTestId('workspace-personal'));

    // Continue button should appear
    const continueBtn = screen.getByTestId('workspace-continue');
    expect(continueBtn).toBeInTheDocument();
    expect(continueBtn).toHaveTextContent('Continue');

    // Click Continue
    await user.click(continueBtn);

    // Should call onUpdateOnboarding with completed step
    await waitFor(() => {
      expect(onUpdateOnboarding).toHaveBeenCalledWith({
        currentStep: 'completed',
        stepData: { selectedType: 'personal' },
      });
    });

    // Should clear onboardingStep in session
    expect(mockUpdate).toHaveBeenCalledWith({ onboardingStep: 'completed' });

    // Should redirect to /assistants
    expect(mockRouterPush).toHaveBeenCalledWith('/assistants');

    // Should NOT call onCreateOrg
    expect(onCreateOrg).not.toHaveBeenCalled();
  });

  it('does not show org name input when "Just for me" is selected', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-personal'));

    expect(screen.queryByTestId('org-name-input')).not.toBeInTheDocument();
  });
});

describe('WorkspaceContent – organization flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows org name input when "For my team" is selected', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));

    expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
    expect(screen.getByText('Organization name')).toBeInTheDocument();
  });

  it('Continue button is disabled when org name is empty', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));

    const continueBtn = screen.getByTestId('workspace-continue');
    expect(continueBtn).toBeDisabled();
  });

  it('creates organization, sets workspace cookie, and redirects', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockResolvedValue({ id: 42, name: 'Acme Corp' });
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[]}
      />,
    );

    // Select organization
    await user.click(screen.getByTestId('workspace-organization'));

    // Type org name
    await user.type(screen.getByTestId('org-name-input'), 'Acme Corp');

    // Click Continue (should show "Create Organization")
    const continueBtn = screen.getByTestId('workspace-continue');
    expect(continueBtn).toHaveTextContent('Create Organization');
    await user.click(continueBtn);

    // Should call onCreateOrg with trimmed name
    await waitFor(() => {
      expect(onCreateOrg).toHaveBeenCalledWith('Acme Corp');
    });

    // Should set the workspace cookie
    await waitFor(() => {
      expect(workspaceCookieCalls).toEqual([{ workspaceId: '42' }]);
    });

    // Should call onUpdateOnboarding with org details
    await waitFor(() => {
      expect(onUpdateOnboarding).toHaveBeenCalledWith({
        currentStep: 'completed',
        stepData: {
          selectedType: 'organization',
          organizationId: '42',
          organizationName: 'Acme Corp',
        },
      });
    });

    // Should clear session and redirect
    expect(mockUpdate).toHaveBeenCalledWith({ onboardingStep: 'completed' });
    expect(mockRouterPush).toHaveBeenCalledWith('/assistants');
  });

  it('shows error when org creation returns a detail error', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockResolvedValue({
      detail: 'Organization name already exists',
    });

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));
    await user.type(screen.getByTestId('org-name-input'), 'Duplicate Org');
    await user.click(screen.getByTestId('workspace-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-error')).toHaveTextContent(
        'Organization name already exists',
      );
    });

    // Should NOT redirect
    expect(mockRouterPush).not.toHaveBeenCalled();
    // Form should still be usable (not loading)
    expect(screen.getByTestId('workspace-continue')).not.toBeDisabled();
  });

  it('shows generic error when org creation throws', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));
    await user.type(screen.getByTestId('org-name-input'), 'New Org');
    await user.click(screen.getByTestId('workspace-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-error')).toHaveTextContent(
        'Failed to create organization. Please try again.',
      );
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('validates empty org name with whitespace-only input', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn();

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));
    await user.type(screen.getByTestId('org-name-input'), '   ');

    // Button should be disabled with whitespace-only input since trim() results in empty
    const continueBtn = screen.getByTestId('workspace-continue');
    expect(continueBtn).toBeDisabled();

    // Should NOT call onCreateOrg
    expect(onCreateOrg).not.toHaveBeenCalled();
  });
});

describe('WorkspaceContent – idempotency (auto-complete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-completes when user already has an organization', async () => {
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[{ id: 99, name: 'Pre-existing Org' }]}
      />,
    );

    // Should show loading state
    expect(screen.getByText('Setting up your workspace...')).toBeInTheDocument();

    // Should NOT show the choice UI
    expect(screen.queryByTestId('workspace-personal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-organization')).not.toBeInTheDocument();

    // Should auto-complete with the latest org
    await waitFor(() => {
      expect(onUpdateOnboarding).toHaveBeenCalledWith({
        currentStep: 'completed',
        stepData: {
          selectedType: 'organization',
          organizationId: '99',
          organizationName: 'Pre-existing Org',
          autoCompleted: true,
        },
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith({ onboardingStep: 'completed' });
    expect(mockRouterPush).toHaveBeenCalledWith('/assistants');
  });

  it('uses the LAST organization when multiple exist', async () => {
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[
          { id: 10, name: 'First Org' },
          { id: 20, name: 'Second Org' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(onUpdateOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          stepData: expect.objectContaining({
            organizationId: '20',
            organizationName: 'Second Org',
          }),
        }),
      );
    });
  });

  it('does NOT auto-complete when existingOrgs is empty', () => {
    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        existingOrgs={[]}
      />,
    );

    // Should show the choice UI, not the loading state
    expect(screen.getByTestId('workspace-personal')).toBeInTheDocument();
    expect(screen.queryByText('Setting up your workspace...')).not.toBeInTheDocument();
  });
});

describe('WorkspaceContent – onUpdateOnboarding failure tolerance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still completes and redirects even if onUpdateOnboarding fails', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onUpdateOnboarding = vi.fn().mockRejectedValue(new Error('Backend down'));

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={onUpdateOnboarding}
        existingOrgs={[]}
      />,
    );

    // Select personal and continue
    await user.click(screen.getByTestId('workspace-personal'));
    await user.click(screen.getByTestId('workspace-continue'));

    // Should still clear session and redirect despite the failure
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ onboardingStep: 'completed' });
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/assistants');

    consoleSpy.mockRestore();
  });
});

describe('WorkspaceContent – switching choices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears error when switching from organization to personal', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockResolvedValue({
      detail: 'Name taken',
    });

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={vi.fn().mockResolvedValue(undefined)}
        existingOrgs={[]}
      />,
    );

    // Select organization, type name, submit to get error
    await user.click(screen.getByTestId('workspace-organization'));
    await user.type(screen.getByTestId('org-name-input'), 'Taken Name');
    await user.click(screen.getByTestId('workspace-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-error')).toBeInTheDocument();
    });

    // Switch to personal — error should be cleared
    await user.click(screen.getByTestId('workspace-personal'));

    expect(screen.queryByTestId('workspace-error')).not.toBeInTheDocument();
  });
});

