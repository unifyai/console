/**
 * Tests for the SecuritySettings component (Profile → Security).
 *
 * Covers manual test cases:
 *   8.1  — Viewing MFA status (enabled/disabled)
 *   10.1 — Disable MFA with correct TOTP code
 *   10.2 — Disable MFA with incorrect TOTP code (error shown)
 *   10.3 — Disable MFA with recovery code
 *   10.4 — Disable MFA blocked by org enforcement
 *   10.5 — After disabling, MFA section reverts to setup
 *   11.2 — Regenerate recovery codes
 *   11.5 — Low recovery codes warning (< 3 remaining)
 *
 * Strategy:
 *   - Mock TotpSetup, TotpInput, RecoveryCodeDisplay as thin shims
 *   - Use MSW to mock /api/auth/mfa/status, /api/auth/mfa/disable,
 *     /api/auth/mfa/recovery-codes
 *   - Test expected behavior (what the user sees) not implementation details
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('lucide-react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('lucide-react')>();
  return {
    ...mod,
    Loader2: (props: any) => <span data-testid="loader" {...props} />,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * TotpSetup mock: renders a button; calls onEnabled when clicked.
 * autoStart prop is forwarded for assertion.
 */
vi.mock('@/components/Common/Auth/TotpSetup', () => ({
  default: ({ onEnabled, autoStart }: any) => (
    <div data-testid="totp-setup-mock" data-auto-start={autoStart}>
      <button data-testid="mock-enable-2fa" onClick={onEnabled}>
        Enable 2FA
      </button>
    </div>
  ),
}));

/**
 * TotpInput mock: renders a form that fires onSubmit with a fixed code.
 */
vi.mock('@/components/Common/Auth/TotpInput', () => ({
  default: ({ onSubmit, error, isLoading }: any) => (
    <div data-testid="totp-input-mock">
      {error && <span data-testid="totp-error">{error}</span>}
      <button
        data-testid="mock-submit-totp"
        onClick={() => onSubmit('123456')}
        disabled={isLoading}
      >
        Submit TOTP
      </button>
    </div>
  ),
}));

/**
 * RecoveryCodeDisplay mock: renders codes and a done button.
 */
vi.mock('@/components/Common/Auth/RecoveryCodeDisplay', () => ({
  default: ({ codes, onDone }: any) => (
    <div data-testid="recovery-display-mock">
      <span data-testid="recovery-code-count">{codes.length} codes</span>
      <button data-testid="mock-recovery-done" onClick={onDone}>
        Done
      </button>
    </div>
  ),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import SecuritySettings from '@/components/Pages/Profile/SecuritySettings';
import { toast } from 'sonner';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Sets up the /api/auth/mfa/status handler. */
const mockMfaStatus = (status: {
  enabled: boolean;
  method?: string;
  confirmedAt?: string;
  recoveryCodesRemaining?: number;
}) => {
  server.use(
    http.get('/api/auth/mfa/status', () => HttpResponse.json(status))
  );
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SecuritySettings – loading & MFA disabled state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching status', () => {
    // Never resolve the fetch so we stay in loading state
    server.use(
      http.get('/api/auth/mfa/status', () => new Promise(() => {}))
    );

    render(<SecuritySettings />);
    expect(screen.getByText('Loading 2FA status...')).toBeInTheDocument();
  });

  it('shows TotpSetup when MFA is not enabled', async () => {
    mockMfaStatus({ enabled: false });

    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('totp-setup-mock')).toBeInTheDocument();
    });
  });

  it('passes autoStart to TotpSetup', async () => {
    mockMfaStatus({ enabled: false });

    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('totp-setup-mock')).toHaveAttribute('data-auto-start', 'true');
    });
  });

  it('falls back to MFA disabled on status fetch error', async () => {
    server.use(
      http.get('/api/auth/mfa/status', () => HttpResponse.error())
    );

    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('totp-setup-mock')).toBeInTheDocument();
    });
  });
});

describe('SecuritySettings – MFA enabled state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMfaStatus({
      enabled: true,
      method: 'totp',
      confirmedAt: '2025-01-01T00:00:00Z',
      recoveryCodesRemaining: 8,
    });
  });

  it('shows MFA enabled section with disable button', async () => {
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('mfa-enabled-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    expect(screen.getByText(/Recovery codes remaining: 8/)).toBeInTheDocument();
  });

  it('shows low recovery codes warning when < 3 remaining', async () => {
    mockMfaStatus({
      enabled: true,
      recoveryCodesRemaining: 2,
    });

    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByText(/Consider regenerating your codes/)).toBeInTheDocument();
    });
  });

  it('shows regenerate recovery codes button', async () => {
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('regenerate-codes-btn')).toBeInTheDocument();
    });
  });
});

describe('SecuritySettings – disable MFA flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMfaStatus({
      enabled: true,
      method: 'totp',
      recoveryCodesRemaining: 8,
    });
  });

  it('shows TOTP confirmation form when disable button is clicked', async () => {
    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));

    expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByTestId('totp-input-mock')).toBeInTheDocument();
  });

  it('disables MFA with correct TOTP code (10.1)', async () => {
    let deleteCompleted = false;
    server.use(
      http.delete('/api/auth/mfa/disable', () => {
        deleteCompleted = true;
        return HttpResponse.json({ message: 'MFA disabled' });
      }),
      http.get('/api/auth/mfa/status', () => {
        if (deleteCompleted) {
          return HttpResponse.json({ enabled: false });
        }
        return HttpResponse.json({ enabled: true, method: 'totp', recoveryCodesRemaining: 8 });
      })
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Two-factor authentication has been disabled.'
      );
    });

    // After disabling, reverts to setup state (10.5)
    await waitFor(() => {
      expect(screen.getByTestId('totp-setup-mock')).toBeInTheDocument();
    });
  });

  it('shows error for incorrect TOTP code (10.2)', async () => {
    server.use(
      http.delete('/api/auth/mfa/disable', () =>
        HttpResponse.json(
          { message: 'Invalid TOTP code' },
          { status: 400 }
        )
      )
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(screen.getByTestId('totp-error').textContent).toBe('Invalid TOTP code');
    });
  });

  it('switches to recovery code input for disable (10.3)', async () => {
    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    await user.click(screen.getByText('Use a recovery code instead'));

    expect(screen.getByTestId('disable-recovery-input')).toBeInTheDocument();
    expect(screen.getByTestId('disable-recovery-submit')).toBeInTheDocument();
  });

  it('disables MFA with recovery code (10.3)', async () => {
    let deleteCompleted = false;
    const disableSpy = vi.fn();
    server.use(
      http.delete('/api/auth/mfa/disable', async ({ request }) => {
        disableSpy(await request.json());
        deleteCompleted = true;
        return HttpResponse.json({ message: 'MFA disabled' });
      }),
      http.get('/api/auth/mfa/status', () => {
        if (deleteCompleted) {
          return HttpResponse.json({ enabled: false });
        }
        return HttpResponse.json({ enabled: true, method: 'totp', recoveryCodesRemaining: 8 });
      })
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    await user.click(screen.getByText('Use a recovery code instead'));

    await user.type(screen.getByTestId('disable-recovery-input'), 'a3f8k2m9');
    await user.click(screen.getByTestId('disable-recovery-submit'));

    await waitFor(() => {
      expect(disableSpy).toHaveBeenCalledWith(
        expect.objectContaining({ recoveryCode: 'a3f8k2m9' })
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Two-factor authentication has been disabled.'
      );
    });
  });

  it('shows org enforcement error when disable is blocked (10.4)', async () => {
    server.use(
      http.delete('/api/auth/mfa/disable', () =>
        HttpResponse.json(
          {
            error: 'mfa_required_by_org',
            message: 'MFA is required by Acme Corp. You cannot disable it while you are a member.',
          },
          { status: 403 }
        )
      )
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(screen.getByTestId('totp-error').textContent).toBe(
        'MFA is required by Acme Corp. You cannot disable it while you are a member.'
      );
    });
  });

  it('can cancel the disable flow', async () => {
    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));
    // TOTP confirmation input is now visible
    expect(screen.getByTestId('totp-input-mock')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    // Should be back to the normal enabled view — TOTP input gone, disable button visible
    expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('totp-input-mock')).not.toBeInTheDocument();
  });
});

describe('SecuritySettings – regenerate recovery codes (11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMfaStatus({
      enabled: true,
      method: 'totp',
      recoveryCodesRemaining: 5,
    });
  });

  it('regenerates codes and displays them', async () => {
    server.use(
      http.post('/api/auth/mfa/recovery-codes', () =>
        HttpResponse.json({
          recoveryCodes: ['code1', 'code2', 'code3', 'code4', 'code5',
                          'code6', 'code7', 'code8', 'code9', 'code10'],
        })
      )
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('regenerate-codes-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('regenerate-codes-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('recovery-display-mock')).toBeInTheDocument();
      expect(screen.getByTestId('recovery-code-count').textContent).toBe('10 codes');
    });
  });

  it('returns to normal view after acknowledging regenerated codes', async () => {
    server.use(
      http.post('/api/auth/mfa/recovery-codes', () =>
        HttpResponse.json({ recoveryCodes: ['c1', 'c2', 'c3'] })
      ),
      // After done, status is re-fetched
      http.get('/api/auth/mfa/status', () =>
        HttpResponse.json({ enabled: true, recoveryCodesRemaining: 10 })
      )
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('regenerate-codes-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('regenerate-codes-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('recovery-display-mock')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mock-recovery-done'));

    await waitFor(() => {
      expect(screen.getByTestId('regenerate-codes-btn')).toBeInTheDocument();
    });
  });

  it('shows error toast when regeneration fails', async () => {
    server.use(
      http.post('/api/auth/mfa/recovery-codes', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    render(<SecuritySettings />);

    await waitFor(() => {
      expect(screen.getByTestId('regenerate-codes-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('regenerate-codes-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to regenerate recovery codes.');
    });
  });
});

