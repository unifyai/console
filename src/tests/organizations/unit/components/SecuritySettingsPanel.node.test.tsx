/**
 * Tests for the SecuritySettingsPanel component (Organization Settings → Security).
 *
 * Covers manual test cases:
 *   13.1 — Org admin enables MFA enforcement (toggle on, success toast)
 *   13.2 — Org admin disables MFA enforcement (toggle off, success toast)
 *   13.3 — Non-admin cannot toggle MFA enforcement (toggle disabled)
 *
 * Strategy:
 *   - Inject getMfaSettings / updateMfaSettings via the `actions` prop
 *   - Test expected user-visible behavior: loading, toggle state, toasts, errors
 *   - The component is pure — it delegates all API calls to the injected actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('lucide-react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('lucide-react')>();
  return {
    ...mod,
    Loader2: (props: any) => <span data-testid="loader" {...props} />,
  };
});

vi.mock('@/components/UI/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      disabled={disabled}
      {...props}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

vi.mock('@/components/UI/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import SecuritySettingsPanel from '@/components/Pages/Organization/SecuritySettingsPanel';
import { toast } from 'sonner';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ORG_ID = 42;

const createActions = (overrides = {}) => ({
  getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
  updateMfaSettings: vi.fn().mockResolvedValue({ requireMfa: true }),
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SecuritySettingsPanel – loading', () => {
  it('shows loading state while fetching settings', () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    expect(screen.getByText('Loading security settings...')).toBeInTheDocument();
  });

  it('calls getMfaSettings with the organization ID on mount', async () => {
    const actions = createActions();

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(actions.getMfaSettings).toHaveBeenCalledWith(ORG_ID);
    });
  });
});

describe('SecuritySettingsPanel – display state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toggle in "off" position when requireMfa is false', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-settings-panel')).toBeInTheDocument();
    });

    const toggle = screen.getByTestId('require-mfa-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('renders the toggle in "on" position when requireMfa is true', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: true }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      const toggle = screen.getByTestId('require-mfa-toggle');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('displays description text about MFA enforcement', async () => {
    const actions = createActions();

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/all members must set up 2FA to access this organization/)
      ).toBeInTheDocument();
    });
  });
});

describe('SecuritySettingsPanel – admin actions (13.1, 13.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables MFA enforcement on toggle on (13.1)', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
      updateMfaSettings: vi.fn().mockResolvedValue({ requireMfa: true }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('require-mfa-toggle')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('require-mfa-toggle'));

    await waitFor(() => {
      expect(actions.updateMfaSettings).toHaveBeenCalledWith(ORG_ID, true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'MFA enforcement enabled — all members will be required to set up 2FA'
      );
    });
  });

  it('disables MFA enforcement on toggle off (13.2)', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: true }),
      updateMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      const toggle = screen.getByTestId('require-mfa-toggle');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    fireEvent.click(screen.getByTestId('require-mfa-toggle'));

    await waitFor(() => {
      expect(actions.updateMfaSettings).toHaveBeenCalledWith(ORG_ID, false);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('MFA enforcement disabled');
    });
  });

  it('shows error toast when update fails', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
      updateMfaSettings: vi.fn().mockResolvedValue({ detail: 'Permission denied' }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('require-mfa-toggle')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('require-mfa-toggle'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Permission denied');
    });
  });

  it('shows generic error toast when update throws', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
      updateMfaSettings: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={true}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('require-mfa-toggle')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('require-mfa-toggle'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update MFA settings');
    });
  });
});

describe('SecuritySettingsPanel – non-admin (13.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggle is disabled when canEdit is false', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={false}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('require-mfa-toggle')).toBeDisabled();
    });
  });

  it('does not call updateMfaSettings when canEdit is false', async () => {
    const actions = createActions({
      getMfaSettings: vi.fn().mockResolvedValue({ requireMfa: false }),
    });

    render(
      <SecuritySettingsPanel
        organizationId={ORG_ID}
        canEdit={false}
        actions={actions}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('require-mfa-toggle')).toBeInTheDocument();
    });

    // Clicking a disabled button should not trigger the handler
    fireEvent.click(screen.getByTestId('require-mfa-toggle'));

    // Wait a tick to confirm no async call was made
    await new Promise((r) => setTimeout(r, 50));
    expect(actions.updateMfaSettings).not.toHaveBeenCalled();
  });
});

