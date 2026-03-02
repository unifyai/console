/**
 * Tests for the WorkspaceContent component (onboarding workspace selection).
 *
 * Strategy:
 *   1. Test that the selection UI renders with both options
 *   2. Test "Just for me" (personal) flow — marks step completed, patches session
 *   3. Test "For my team" flow — shows org name input, creates org, patches session
 *   4. Test validation — empty org name shows error
 *   5. Test API errors — org creation failure shows error, keeps form usable
 *   6. Test that the workspace cookie is set when org is created
 *   7. Test that onUpdateOnboarding failure is tolerated (best-effort)
 *   8. Test that the Continue button is disabled while loading
 *
 * Note: Idempotency (auto-complete when user has existing orgs) is now handled
 * server-side in the page component, not in WorkspaceContent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
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

// Mock for the patchSessionAndRedirect server action
let mockPatchSession: ReturnType<typeof vi.fn>;

beforeEach(() => {
  workspaceCookieCalls = [];
  mockPatchSession = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000/login/onboarding',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/login/onboarding',
      search: '',
      hash: '',
    },
    writable: true,
  });
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
    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        onPatchSession={mockPatchSession}
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
        onPatchSession={mockPatchSession}
      />,
    );

    expect(screen.queryByTestId('workspace-continue')).not.toBeInTheDocument();
  });

  it('shows the footer note about creating orgs later', () => {
    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        onPatchSession={mockPatchSession}
      />,
    );

    expect(screen.getByText(/You can always create an organization later/)).toBeInTheDocument();
  });
});

describe('WorkspaceContent – personal workspace flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking "Just for me" and Continue marks onboarding completed and patches session', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn();
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={onUpdateOnboarding}
        onPatchSession={mockPatchSession}
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

    // Should call the server action to patch the JWT
    expect(mockPatchSession).toHaveBeenCalledWith(
      { onboardingStep: 'completed' },
      '/assistants',
      {},
    );

    // Should NOT call onCreateOrg
    expect(onCreateOrg).not.toHaveBeenCalled();
  });

  it('does not show org name input when "Just for me" is selected', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={vi.fn()}
        onPatchSession={mockPatchSession}
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
        onPatchSession={mockPatchSession}
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
        onPatchSession={mockPatchSession}
      />,
    );

    await user.click(screen.getByTestId('workspace-organization'));

    const continueBtn = screen.getByTestId('workspace-continue');
    expect(continueBtn).toBeDisabled();
  });

  it('creates organization, sets workspace cookie, and patches session', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockResolvedValue({ id: 42, name: 'Acme Corp' });
    const onUpdateOnboarding = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={onUpdateOnboarding}
        onPatchSession={mockPatchSession}
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

    // Should call server action to patch the JWT
    expect(mockPatchSession).toHaveBeenCalledWith(
      { onboardingStep: 'completed' },
      '/assistants',
      {},
    );
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
        onPatchSession={mockPatchSession}
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

    // Should NOT patch session
    expect(mockPatchSession).not.toHaveBeenCalled();
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
        onPatchSession={mockPatchSession}
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

    expect(mockPatchSession).not.toHaveBeenCalled();
  });

  it('validates empty org name with whitespace-only input', async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn();

    render(
      <WorkspaceContent
        onCreateOrg={onCreateOrg}
        onUpdateOnboarding={vi.fn()}
        onPatchSession={mockPatchSession}
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

describe('WorkspaceContent – onUpdateOnboarding failure tolerance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still patches session even if onUpdateOnboarding fails', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onUpdateOnboarding = vi.fn().mockRejectedValue(new Error('Backend down'));

    render(
      <WorkspaceContent
        onCreateOrg={vi.fn()}
        onUpdateOnboarding={onUpdateOnboarding}
        onPatchSession={mockPatchSession}
      />,
    );

    // Select personal and continue
    await user.click(screen.getByTestId('workspace-personal'));
    await user.click(screen.getByTestId('workspace-continue'));

    // Should still call the server action despite the failure
    await waitFor(() => {
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {},
      );
    });

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
        onPatchSession={mockPatchSession}
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
