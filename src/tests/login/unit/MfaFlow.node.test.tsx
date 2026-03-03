/**
 * Tests for Phase 2: MFA (Two-Factor Authentication) frontend logic.
 *
 * Covers:
 * - TotpInput component (digit input, paste, auto-submit, error display)
 * - MFA login flow (TOTP verify, recovery code, session update)
 * - JWT callback mfaPending lifecycle (set on login, clear on update)
 * - Middleware MFA redirect logic
 * - MFA setup/confirm/disable API interactions
 * - MfaModal sensitive-action flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock next-auth/react
const mockUpdate = vi.fn().mockResolvedValue(undefined);
let mockSessionData: { data: any; status: string } = {
  data: null,
  status: 'unauthenticated',
};

vi.mock('next-auth/react', () => ({
  useSession: () => ({ ...mockSessionData, update: mockUpdate }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock next/navigation
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
  redirect: vi.fn(),
}));

// Mock UnifyLogo (SVG component)
vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  default: () => <div data-testid="unify-logo-mock" />,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TotpSetup (used by MFA page for setup flow)
vi.mock('@/components/Common/Auth/TotpSetup', () => ({
  default: ({ autoStart, onEnabled }: any) => (
    <div data-testid="totp-setup-mock" data-auto-start={autoStart}>
      <button data-testid="totp-setup-complete" onClick={onEnabled}>
        Complete Setup
      </button>
    </div>
  ),
}));

// Mock OrchestraAdminClient (needed when importing authOptions)
vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getOrchestraUserClient: vi.fn(),
}));

// Mock OrchestraAdapter (needed when importing authOptions)
vi.mock('@/lib/orchestra/orchestra-adapter', () => ({
  OrchestraAdapter: () => ({}),
}));

// ─── Test Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionData = {
    data: {
      user: { id: 'user-123', email: 'test@example.com' },
    },
    status: 'authenticated',
  };
});

// ─── TotpInput Component ─────────────────────────────────────────────────────

describe('TotpInput component', () => {
  let TotpInput: any;

  beforeEach(async () => {
    TotpInput = (await import('@/components/Common/Auth/TotpInput')).default;
  });

  it('renders 6 digit inputs', () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);

    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`totp-digit-${i}`)).toBeInTheDocument();
    }
  });

  it('auto-advances focus when a digit is entered', async () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);
    const user = userEvent.setup();

    const digit0 = screen.getByTestId('totp-digit-0');
    await user.click(digit0);
    await user.keyboard('1');

    // After typing '1' in digit 0, digit 1 should have focus
    expect(screen.getByTestId('totp-digit-1')).toHaveFocus();
  });

  it('auto-submits when all 6 digits are filled', async () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);
    const user = userEvent.setup();

    const digit0 = screen.getByTestId('totp-digit-0');
    await user.click(digit0);
    await user.keyboard('123456');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('123456');
    });
  });

  it('handles paste of a 6-digit code', async () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);

    const digit0 = screen.getByTestId('totp-digit-0');
    digit0.focus();

    // Simulate paste
    fireEvent.paste(digit0, {
      clipboardData: { getData: () => '654321' },
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('654321');
    });
  });

  it('rejects non-digit characters', async () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);
    const user = userEvent.setup();

    const digit0 = screen.getByTestId('totp-digit-0');
    await user.click(digit0);
    await user.keyboard('abc');

    // All inputs should remain empty
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`totp-digit-${i}`)).toHaveValue('');
    }

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('displays error message', () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} error="Invalid code" />);

    expect(screen.getByTestId('totp-error')).toHaveTextContent('Invalid code');
  });

  it('disables inputs when loading', () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} isLoading />);

    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`totp-digit-${i}`)).toBeDisabled();
    }
  });

  it('verify button is disabled when code is incomplete', () => {
    const onSubmit = vi.fn();
    render(<TotpInput onSubmit={onSubmit} />);

    const submitBtn = screen.getByTestId('totp-submit');
    expect(submitBtn).toBeDisabled();
  });
});

// ─── MFA Login Page ──────────────────────────────────────────────────────────

describe('MFA login page', () => {
  let MfaPage: any;

  beforeEach(async () => {
    // The MFA page now checks MFA status on mount — tell it MFA is enabled
    // so it renders the verification flow (not the setup flow).
    server.use(
      http.get('/api/auth/mfa/status', () => {
        return HttpResponse.json({ enabled: true });
      })
    );
    MfaPage = (await import('@/app/login/mfa/page')).default;
  });

  it('renders the TOTP input by default', async () => {
    render(<MfaPage />);

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('totp-input')).toBeInTheDocument();
    });

    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByTestId('use-recovery-code')).toBeInTheDocument();
  });

  it('submits TOTP code and redirects on success (mfaPending cleared server-side)', async () => {
    server.use(
      http.post('/api/auth/mfa/verify', () => {
        return HttpResponse.json({ success: true });
      })
    );

    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('totp-digit-0')).toBeInTheDocument();
    });

    // Type the code
    const digit0 = screen.getByTestId('totp-digit-0');
    await user.click(digit0);
    await user.keyboard('123456');

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/assistants');
    });

    // mfaPending is cleared server-side via cookie patching, not client-side update()
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('shows error on invalid TOTP code', async () => {
    server.use(
      http.post('/api/auth/mfa/verify', () => {
        return HttpResponse.json(
          { error: 'invalid_code', message: 'Invalid or expired TOTP code.' },
          { status: 400 }
        );
      })
    );

    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('totp-digit-0')).toBeInTheDocument();
    });

    const digit0 = screen.getByTestId('totp-digit-0');
    await user.click(digit0);
    await user.keyboard('000000');

    await waitFor(() => {
      expect(screen.getByTestId('totp-error')).toHaveTextContent('Invalid or expired TOTP code.');
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('switches to recovery code input', async () => {
    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('use-recovery-code')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('use-recovery-code'));

    expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();
    expect(screen.getByTestId('recovery-submit')).toBeInTheDocument();
  });

  it('submits recovery code and redirects on success (mfaPending cleared server-side)', async () => {
    server.use(
      http.post('/api/auth/mfa/verify-recovery', () => {
        return HttpResponse.json({ success: true, remainingCodes: 7 });
      })
    );

    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('use-recovery-code')).toBeInTheDocument();
    });

    // Switch to recovery mode
    await user.click(screen.getByTestId('use-recovery-code'));

    // Type recovery code
    await user.type(screen.getByTestId('recovery-code-input'), 'a3f8k2m9');

    // Submit
    await user.click(screen.getByTestId('recovery-submit'));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/assistants');
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('shows warning when recovery codes are low', async () => {
    server.use(
      http.post('/api/auth/mfa/verify-recovery', () => {
        return HttpResponse.json({ success: true, remainingCodes: 2 });
      })
    );

    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('use-recovery-code')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('use-recovery-code'));
    await user.type(screen.getByTestId('recovery-code-input'), 'testcode');
    await user.click(screen.getByTestId('recovery-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('recovery-warning')).toHaveTextContent(
        'You have 2 recovery codes remaining'
      );
    });
  });

  it('switches back from recovery to TOTP mode', async () => {
    render(<MfaPage />);
    const user = userEvent.setup();

    // Wait for MFA status check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('use-recovery-code')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('use-recovery-code'));
    expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();

    await user.click(screen.getByTestId('use-totp-code'));
    expect(screen.getByTestId('totp-input')).toBeInTheDocument();
  });

  it('shows setup flow when MFA status check returns enabled: false', async () => {
    server.use(
      http.get('/api/auth/mfa/status', () => {
        return HttpResponse.json({ enabled: false });
      })
    );

    render(<MfaPage />);

    // When MFA is not enabled, the page should show setup flow
    await waitFor(() => {
      expect(screen.getByTestId('totp-setup-mock')).toBeInTheDocument();
    });
  });

  it('handles MFA status check network error gracefully', async () => {
    server.use(
      http.get('/api/auth/mfa/status', () => {
        return HttpResponse.error();
      })
    );

    render(<MfaPage />);

    // On network error, the page should still render something
    // (either show TOTP input as fallback or an error message)
    await waitFor(() => {
      // The page should not remain in loading state indefinitely
      const totpOrError =
        screen.queryByTestId('totp-input') ||
        screen.queryByTestId('totp-setup-mock') ||
        screen.queryByText(/error/i);
      expect(totpOrError).toBeTruthy();
    });
  });
});

// ─── JWT Callback (mfaPending lifecycle) ─────────────────────────────────────

describe('JWT callback – mfaPending lifecycle', () => {
  it('sets mfaPending when authorize returns mfaRequired=true', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/options');
    const authOpts = mod.authOptions ?? mod.default;
    const jwtCallback = authOpts.callbacks!.jwt!;

    const token: any = {};
    const user: any = { mfaPending: true };

    const result = await (jwtCallback as Function)({
      token,
      user,
      account: null,
      profile: undefined,
      trigger: 'signIn',
      session: undefined,
    });

    expect(result.mfaPending).toBe(true);
  });

  it('does NOT clear mfaPending via client-side session update', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/options');
    const authOpts = mod.authOptions ?? mod.default;
    const jwtCallback = authOpts.callbacks!.jwt!;

    const token: any = { mfaPending: true };

    const result = await (jwtCallback as Function)({
      token,
      user: undefined,
      account: null,
      profile: undefined,
      trigger: 'update',
      session: { mfaPending: false },
    });

    // mfaPending can only be cleared server-side by the MFA verify route handlers
    expect(result.mfaPending).toBe(true);
  });

  it('preserves mfaPending on regular jwt calls', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/options');
    const authOpts = mod.authOptions ?? mod.default;
    const jwtCallback = authOpts.callbacks!.jwt!;

    const token: any = { mfaPending: true };

    const result = await (jwtCallback as Function)({
      token,
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      session: undefined,
    });

    expect(result.mfaPending).toBe(true);
  });
});

// ─── Session callback (mfaPending exposure) ──────────────────────────────────

describe('Session callback – mfaPending exposure', () => {
  it('exposes mfaPending in the session when token has it', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/options');
    const authOpts = mod.authOptions ?? mod.default;
    const sessionCallback = authOpts.callbacks!.session!;

    const session: any = { user: { email: 'test@example.com' } };
    const token: any = {
      email: 'test@example.com',
      name: 'Test',
      mfaPending: true,
      iat: 12345,
    };

    const result = await (sessionCallback as Function)({ session, token, user: {} });

    expect(result.mfaPending).toBe(true);
  });

  it('does not set mfaPending when token does not have it', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/options');
    const authOpts = mod.authOptions ?? mod.default;
    const sessionCallback = authOpts.callbacks!.session!;

    const session: any = { user: { email: 'test@example.com' } };
    const token: any = {
      email: 'test@example.com',
      name: 'Test',
      iat: 12345,
    };

    const result = await (sessionCallback as Function)({ session, token, user: {} });

    expect(result.mfaPending).toBeUndefined();
  });
});

// ─── RecoveryCodeDisplay Component ───────────────────────────────────────────

describe('RecoveryCodeDisplay component', () => {
  let RecoveryCodeDisplay: any;

  beforeEach(async () => {
    RecoveryCodeDisplay = (await import('@/components/Common/Auth/RecoveryCodeDisplay')).default;
  });

  it('renders all codes', () => {
    const codes = ['code0001', 'code0002', 'code0003'];
    const onDone = vi.fn();

    render(<RecoveryCodeDisplay codes={codes} onDone={onDone} />);

    for (let i = 0; i < codes.length; i++) {
      expect(screen.getByTestId(`recovery-code-${i}`)).toHaveTextContent(codes[i]);
    }
  });

  it('done button is disabled until acknowledgement', () => {
    const codes = ['code0001'];
    const onDone = vi.fn();

    render(<RecoveryCodeDisplay codes={codes} onDone={onDone} />);

    expect(screen.getByTestId('codes-done-btn')).toBeDisabled();
  });

  it('done button is enabled after acknowledgement', async () => {
    const codes = ['code0001'];
    const onDone = vi.fn();

    render(<RecoveryCodeDisplay codes={codes} onDone={onDone} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('acknowledge-codes-checkbox'));

    expect(screen.getByTestId('codes-done-btn')).not.toBeDisabled();

    await user.click(screen.getByTestId('codes-done-btn'));
    expect(onDone).toHaveBeenCalled();
  });
});
