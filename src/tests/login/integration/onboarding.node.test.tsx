/**
 * Integration tests for the full onboarding (workspace selection) flow.
 *
 * Unlike the unit tests in `login/unit/WorkspaceContent.node.test.tsx` which
 * test the component with stubbed fetch/actions, these tests render the REAL
 * WorkspaceContent component with framer-motion passthroughs and verify the
 * full user interaction flow end-to-end:
 *
 * - Personal workspace selection → onboarding update → patchSession server action
 * - Organization creation → workspace cookie → patchSession server action
 * - Validation: empty org name, API errors
 *
 * Note: Idempotency (auto-complete when user has existing orgs) is now handled
 * server-side in the page component, not in WorkspaceContent.
 *
 * Mocked: next/navigation, framer-motion, APIs (via MSW)
 * Real:   WorkspaceContent, Input, Button
 *
 * @group integration
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks (external dependencies only) ──────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login/onboarding',
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

// Import the REAL component
import WorkspaceContent from '@/components/Pages/Onboarding/WorkspaceContent';

describe('Onboarding Integration', () => {
  let mockCreateOrg: any;
  let mockUpdateOnboarding: any;
  let mockPatchSession: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrg = vi.fn();
    mockUpdateOnboarding = vi.fn().mockResolvedValue(undefined);
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

    // Default MSW handler for workspace cookie
    server.use(http.post('/api/session/workspace', () => HttpResponse.json({ ok: true })));
  });

  afterEach(() => {
    server.resetHandlers();
  });

  const renderOnboarding = () =>
    render(
      <WorkspaceContent
        onCreateOrg={mockCreateOrg}
        onUpdateOnboarding={mockUpdateOnboarding}
        onPatchSession={mockPatchSession}
      />
    );

  // ─── Personal Workspace Flow ─────────────────────────────────────────

  describe('Personal Workspace', () => {
    it('selects personal workspace and completes onboarding', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      // Verify initial state
      expect(screen.getByText('Welcome to Unify')).toBeInTheDocument();
      expect(screen.getByText('Just for me')).toBeInTheDocument();
      expect(screen.getByText('For my team')).toBeInTheDocument();

      // Continue button should not exist yet (no choice made)
      expect(screen.queryByTestId('workspace-continue')).toBeNull();

      // Select personal workspace
      await user.click(screen.getByTestId('workspace-personal'));

      // Continue button should appear
      expect(screen.getByTestId('workspace-continue')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');

      // No org name input should be visible
      expect(screen.queryByTestId('org-name-input')).toBeNull();

      // Click continue
      await user.click(screen.getByTestId('workspace-continue'));

      // Verify onboarding was completed
      await waitFor(() => {
        expect(mockUpdateOnboarding).toHaveBeenCalledWith({
          currentStep: 'completed',
          stepData: { selectedType: 'personal' },
        });
      });

      // Verify server action was called
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {}
      );
    });
  });

  // ─── Organization Workspace Flow ─────────────────────────────────────

  describe('Organization Workspace', () => {
    it('creates an organization and completes onboarding', async () => {
      mockCreateOrg.mockResolvedValue({
        id: 42,
        name: 'Acme Corp',
      });

      const user = userEvent.setup();
      renderOnboarding();

      // Select organization
      await user.click(screen.getByTestId('workspace-organization'));

      // Org name input should appear
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      // Continue button should be disabled (empty name)
      expect(screen.getByTestId('workspace-continue')).toBeDisabled();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Create Organization');

      // Type org name
      await user.type(screen.getByTestId('org-name-input'), 'Acme Corp');

      // Continue should be enabled now
      expect(screen.getByTestId('workspace-continue')).not.toBeDisabled();

      // Click create organization
      await user.click(screen.getByTestId('workspace-continue'));

      // Verify org creation was called
      await waitFor(() => {
        expect(mockCreateOrg).toHaveBeenCalledWith('Acme Corp');
      });

      // Verify onboarding was completed with org details
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

      // Verify server action was called
      expect(mockPatchSession).toHaveBeenCalledWith(
        { onboardingStep: 'completed' },
        '/assistants',
        {}
      );
    });

    it('shows error when org name is empty and user clicks continue', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));

      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      // Verify button is disabled with empty input
      expect(screen.getByTestId('workspace-continue')).toBeDisabled();
    });

    it('shows error when organization creation fails', async () => {
      mockCreateOrg.mockResolvedValue({
        detail: 'Organization name already taken',
      });

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
          'Organization name already taken'
        );
      });

      // Should NOT have called server action
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
          'Failed to create organization'
        );
      });
    });
  });

  // ─── Choice Switching ───────────────────────────────────────────────

  describe('Choice switching', () => {
    it('switches between personal and organization choices', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      // Select personal
      await user.click(screen.getByTestId('workspace-personal'));
      expect(screen.queryByTestId('org-name-input')).toBeNull();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');

      // Switch to organization
      await user.click(screen.getByTestId('workspace-organization'));
      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Create Organization');

      // Switch back to personal
      await user.click(screen.getByTestId('workspace-personal'));
      expect(screen.queryByTestId('org-name-input')).toBeNull();
      expect(screen.getByTestId('workspace-continue')).toHaveTextContent('Continue');
    });
  });

  // ─── Workspace Cookie ──────────────────────────────────────────────

  describe('Workspace cookie', () => {
    it('sets workspace cookie when creating an organization', async () => {
      let cookieBody: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/session/workspace', async ({ request }) => {
          cookieBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true });
        })
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
  });

  // ─── Personal Workspace Failure Tolerance ─────────────────────────

  describe('Personal workspace failure tolerance', () => {
    it('still calls server action when onUpdateOnboarding fails for personal', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockUpdateOnboarding.mockRejectedValue(new Error('Backend down'));

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-personal'));
      await user.click(screen.getByTestId('workspace-continue'));

      // Should still call server action despite backend failure
      await waitFor(() => {
        expect(mockPatchSession).toHaveBeenCalledWith(
          { onboardingStep: 'completed' },
          '/assistants',
          {}
        );
      });

      consoleSpy.mockRestore();
    });
  });

  // ─── Organization Name Validation ────────────────────────────────

  describe('Organization name validation', () => {
    it('treats whitespace-only name as empty (button stays disabled)', async () => {
      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));

      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      // Type only spaces
      await user.type(screen.getByTestId('org-name-input'), '   ');

      // Continue should still be disabled because trim() gives empty string
      expect(screen.getByTestId('workspace-continue')).toBeDisabled();
    });
  });

  // ─── Loading / Double-click Protection ────────────────────────────

  describe('Loading state', () => {
    it('disables choice buttons during loading', async () => {
      mockCreateOrg.mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      const user = userEvent.setup();
      renderOnboarding();

      await user.click(screen.getByTestId('workspace-organization'));

      await waitFor(() => {
        expect(screen.getByTestId('org-name-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('org-name-input'), 'Corp');
      await user.click(screen.getByTestId('workspace-continue'));

      // While loading, both choice buttons should be disabled
      await waitFor(() => {
        expect(screen.getByTestId('workspace-personal')).toBeDisabled();
        expect(screen.getByTestId('workspace-organization')).toBeDisabled();
        expect(screen.getByTestId('workspace-continue')).toBeDisabled();
      });
    });
  });

  // ─── Initial State ─────────────────────────────────────────────────

  describe('Initial state', () => {
    it('does not show continue button until a choice is made', () => {
      renderOnboarding();

      expect(screen.getByText('Welcome to Unify')).toBeInTheDocument();
      expect(screen.queryByTestId('workspace-continue')).toBeNull();
      expect(screen.queryByTestId('org-name-input')).toBeNull();
    });

    it('shows footer note about creating org later', () => {
      renderOnboarding();

      expect(
        screen.getByText(
          'You can always create an organization later, with separate billing and resources.'
        )
      ).toBeInTheDocument();
    });
  });
});
