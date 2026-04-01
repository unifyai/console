/**
 * MFA journey tests — "I'm using two-factor authentication."
 *
 * Covers:
 * - TOTP verification: 6-digit code entry → success/error → redirect
 * - Recovery code: switch to recovery mode → enter code → verify → redirect
 * - MFA setup: QR scan → confirm code → recovery codes displayed → done
 * - Back to login (signout from MFA page)
 * - Error paths: invalid codes, network errors, setup failures
 * - MFA status check: loading state, failure fallback
 *
 * Real components: MfaPage, TotpInput, TotpSetup, RecoveryCodeDisplay
 * Mocked: next-auth/react, next/navigation, framer-motion, next/image, MSW APIs
 *
 * @group integration
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks (external dependencies only) ──────────────────────────────────────

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const pushMock = vi.fn();
let mockMfaSearchParams: Record<string, string> = {};

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { email: 'user@test.com' } },
    status: 'authenticated',
    update: mockUpdate,
  }),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login/mfa',
  useSearchParams: () => {
    const params = new URLSearchParams();
    Object.entries(mockMfaSearchParams).forEach(([k, v]) => params.set(k, v));
    return params;
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

vi.mock('@/components/Common/Misc/UnifyLogo', () => ({
  __esModule: true,
  default: () => <div data-testid="unify-logo">Logo</div>,
}));

// Import REAL MFA page (uses real TotpInput, TotpSetup, RecoveryCodeDisplay)
import MfaPage from '@/app/login/mfa/page';
import { mockWindowLocation } from './fixtures';

// ═══════════════════════════════════════════════════════════════════════════════

describe('MFA Journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMfaSearchParams = {};
    mockWindowLocation('/login/mfa');
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // ─── TOTP Verification (MFA already enabled) ──────────────────────────────

  describe('TOTP Verification', () => {
    beforeEach(() => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: true })));
    });

    it('completes full TOTP verification with real 6-digit input', async () => {
      server.use(
        http.post('/api/auth/mfa/verify', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === '123456') {
            return HttpResponse.json({ success: true });
          }
          return HttpResponse.json({ message: 'Invalid code' }, { status: 400 });
        })
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '123456'[i]);
      }

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants');
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('shows error for invalid TOTP code', async () => {
      server.use(
        http.post('/api/auth/mfa/verify', () =>
          HttpResponse.json({ message: 'Invalid code. Please try again.' }, { status: 400 })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '0');
      }

      await waitFor(() => {
        expect(screen.getByTestId('totp-error')).toHaveTextContent('Invalid code');
      });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('shows network error when TOTP verify API throws', async () => {
      server.use(http.post('/api/auth/mfa/verify', () => HttpResponse.error()));

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(screen.getByTestId('totp-error')).toHaveTextContent('Verification failed');
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('clears error when switching between TOTP and recovery views', async () => {
      server.use(
        http.post('/api/auth/mfa/verify', () =>
          HttpResponse.json({ message: 'Invalid code.' }, { status: 400 })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '0');
      }

      await waitFor(() => {
        expect(screen.getByTestId('totp-error')).toBeInTheDocument();
      });

      // Switch to recovery — error should clear
      await user.click(screen.getByTestId('use-recovery-code'));
      expect(screen.queryByTestId('recovery-error')).toBeNull();

      // Switch back — error should stay cleared
      await user.click(screen.getByTestId('use-totp-code'));
      expect(screen.queryByTestId('totp-error')).toBeNull();
    });
  });

  // ─── Recovery Code Verification ────────────────────────────────────────────

  describe('Recovery Code Verification', () => {
    beforeEach(() => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: true })));
    });

    it('switches to recovery code input and verifies successfully', async () => {
      server.use(
        http.post('/api/auth/mfa/verify-recovery', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === 'ABCD-1234-EFGH') {
            return HttpResponse.json({ remainingCodes: 5 });
          }
          return HttpResponse.json({ message: 'Invalid recovery code' }, { status: 400 });
        })
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();
      expect(screen.queryByTestId('totp-input')).toBeNull();

      await user.type(screen.getByTestId('recovery-code-input'), 'ABCD-1234-EFGH');
      await user.click(screen.getByTestId('recovery-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants');
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('shows warning when few recovery codes remain', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      server.use(
        http.post('/api/auth/mfa/verify-recovery', () => HttpResponse.json({ remainingCodes: 2 }))
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      await user.type(screen.getByTestId('recovery-code-input'), 'VALID-CODE');
      await user.click(screen.getByTestId('recovery-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('recovery-warning')).toHaveTextContent(
          '2 recovery codes remaining'
        );
      });

      vi.advanceTimersByTime(3500);
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants');
      });
      expect(mockUpdate).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('shows error for invalid recovery code', async () => {
      server.use(
        http.post('/api/auth/mfa/verify-recovery', () =>
          HttpResponse.json({ message: 'Invalid recovery code.' }, { status: 400 })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      await user.type(screen.getByTestId('recovery-code-input'), 'WRONG-CODE');
      await user.click(screen.getByTestId('recovery-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('recovery-error')).toHaveTextContent('Invalid recovery code');
      });
      expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('shows network error when recovery verify API throws', async () => {
      server.use(http.post('/api/auth/mfa/verify-recovery', () => HttpResponse.error()));

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      await user.type(screen.getByTestId('recovery-code-input'), 'SOME-CODE');
      await user.click(screen.getByTestId('recovery-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('recovery-error')).toHaveTextContent(
          'Recovery code verification failed'
        );
      });
    });

    it('disables recovery submit button when code input is empty', async () => {
      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      expect(screen.getByTestId('recovery-submit')).toBeDisabled();
    });

    it('switches between TOTP and recovery code views', async () => {
      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();
      expect(screen.queryByTestId('totp-input')).toBeNull();

      await user.click(screen.getByTestId('use-totp-code'));
      expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      expect(screen.queryByTestId('recovery-code-input')).toBeNull();
    });
  });

  // ─── MFA Setup (first time) ────────────────────────────────────────────────

  describe('MFA Setup', () => {
    beforeEach(() => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: false })));
    });

    it('completes full MFA setup: QR → confirm code → recovery codes → done', async () => {
      server.use(
        http.post('/api/auth/mfa/setup', () =>
          HttpResponse.json({
            qrCodeUri: 'otpauth://totp/Unify:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=Unify',
          })
        ),
        http.post('/api/auth/mfa/confirm', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (body.code === '654321') {
            return HttpResponse.json({
              recoveryCodes: [
                'CODE-1111-AAAA',
                'CODE-2222-BBBB',
                'CODE-3333-CCCC',
                'CODE-4444-DDDD',
              ],
            });
          }
          return HttpResponse.json({ message: 'Invalid code' }, { status: 400 });
        })
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-qr-step')).toBeInTheDocument();
      });
      expect(screen.getByTestId('totp-qr-image')).toBeInTheDocument();

      await user.click(screen.getByTestId('qr-scanned-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('totp-confirm-step')).toBeInTheDocument();
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '654321'[i]);
      }

      await waitFor(() => {
        expect(screen.getByTestId('recovery-codes-display')).toBeInTheDocument();
      });

      expect(screen.getByTestId('recovery-code-0')).toHaveTextContent('CODE-1111-AAAA');
      expect(screen.getByTestId('recovery-code-1')).toHaveTextContent('CODE-2222-BBBB');
      expect(screen.getByTestId('recovery-code-2')).toHaveTextContent('CODE-3333-CCCC');
      expect(screen.getByTestId('recovery-code-3')).toHaveTextContent('CODE-4444-DDDD');

      expect(screen.getByTestId('codes-done-btn')).toBeDisabled();
      await user.click(screen.getByTestId('acknowledge-codes-checkbox'));
      expect(screen.getByTestId('codes-done-btn')).not.toBeDisabled();

      await user.click(screen.getByTestId('codes-done-btn'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants');
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('shows error when confirmation code is wrong', async () => {
      server.use(
        http.post('/api/auth/mfa/setup', () =>
          HttpResponse.json({
            qrCodeUri: 'otpauth://totp/Unify:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=Unify',
          })
        ),
        http.post('/api/auth/mfa/confirm', () =>
          HttpResponse.json({ message: 'Invalid code.' }, { status: 400 })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-qr-step')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('qr-scanned-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '0');
      }

      await waitFor(() => {
        expect(screen.getByTestId('totp-error')).toHaveTextContent('Invalid code');
      });
      expect(screen.queryByTestId('recovery-codes-display')).not.toBeInTheDocument();
    });

    it('shows error when setup API fails', async () => {
      server.use(
        http.post('/api/auth/mfa/setup', () =>
          HttpResponse.json({ message: 'MFA setup failed' }, { status: 500 })
        )
      );

      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByText('MFA setup failed')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('totp-qr-step')).not.toBeInTheDocument();
    });

    it('shows error when setup API throws network error', async () => {
      server.use(http.post('/api/auth/mfa/setup', () => HttpResponse.error()));

      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to start 2FA setup.')).toBeInTheDocument();
      });
    });
  });

  // ─── Recovery Code Actions During Setup ────────────────────────────────────

  describe('Recovery Code Actions During Setup', () => {
    it('displays all recovery codes and supports copy/download', async () => {
      server.use(
        http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: false })),
        http.post('/api/auth/mfa/setup', () =>
          HttpResponse.json({
            qrCodeUri: 'otpauth://totp/Unify:user@test.com?secret=SECRET&issuer=Unify',
          })
        ),
        http.post('/api/auth/mfa/confirm', () =>
          HttpResponse.json({
            recoveryCodes: ['CODE-AAAA', 'CODE-BBBB', 'CODE-CCCC'],
          })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-qr-step')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('qr-scanned-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(screen.getByTestId('recovery-codes-display')).toBeInTheDocument();
      });

      expect(screen.getByTestId('recovery-code-0')).toHaveTextContent('CODE-AAAA');
      expect(screen.getByTestId('recovery-code-1')).toHaveTextContent('CODE-BBBB');
      expect(screen.getByTestId('recovery-code-2')).toHaveTextContent('CODE-CCCC');

      // Copy button should be present
      expect(screen.getByTestId('copy-codes-btn')).toHaveTextContent('Copy');
      await user.click(screen.getByTestId('copy-codes-btn'));
      expect(screen.getByTestId('recovery-codes-display')).toBeInTheDocument();
    });

    it('downloads recovery codes as text file', async () => {
      const clickSpy = vi.fn();
      const createElementOrig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = createElementOrig(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', { value: clickSpy });
        }
        return el;
      });

      server.use(
        http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: false })),
        http.post('/api/auth/mfa/setup', () =>
          HttpResponse.json({
            qrCodeUri: 'otpauth://totp/Unify:user@test.com?secret=SECRET&issuer=Unify',
          })
        ),
        http.post('/api/auth/mfa/confirm', () =>
          HttpResponse.json({ recoveryCodes: ['CODE-1111'] })
        )
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-qr-step')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('qr-scanned-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '1');
      }

      await waitFor(() => {
        expect(screen.getByTestId('recovery-codes-display')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('download-codes-btn'));
      expect(clickSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  // ─── Back to Login ─────────────────────────────────────────────────────────

  describe('Back to Login', () => {
    it('signs out and redirects to login page', async () => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: true })));

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('back-to-login')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('back-to-login'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
        expect(window.location.href).toBe('/login');
      });
    });
  });

  // ─── MFA Status Check ─────────────────────────────────────────────────────

  describe('MFA Status Check', () => {
    it('defaults to verification flow when status check fails', async () => {
      server.use(
        http.get('/api/auth/mfa/status', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });
    });

    it('defaults to verification flow when status check throws network error', async () => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.error()));

      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });
    });

    it('shows loading state before MFA status is determined', () => {
      server.use(http.get('/api/auth/mfa/status', () => new Promise(() => {})));

      render(<MfaPage />);

      expect(screen.getByText('Checking authentication status...')).toBeInTheDocument();
      expect(screen.queryByTestId('totp-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('totp-qr-step')).not.toBeInTheDocument();
    });
  });

  // ─── Credit Token Forwarding ──────────────────────────────────────────────

  describe('Credit Token Forwarding', () => {
    beforeEach(() => {
      server.use(http.get('/api/auth/mfa/status', () => HttpResponse.json({ enabled: true })));
    });

    it('forwards credit token to /assistants after TOTP verification', async () => {
      mockMfaSearchParams = { token: 'credit_abc' };
      server.use(http.post('/api/auth/mfa/verify', () => HttpResponse.json({ success: true })));

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '123456'[i]);
      }

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants?token=credit_abc');
      });
    });

    it('forwards credit token after recovery code verification', async () => {
      mockMfaSearchParams = { token: 'credit_xyz' };
      server.use(
        http.post('/api/auth/mfa/verify-recovery', () => HttpResponse.json({ remainingCodes: 5 }))
      );

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('use-recovery-code'));
      await user.type(screen.getByTestId('recovery-code-input'), 'ABCD-1234-EFGH');
      await user.click(screen.getByTestId('recovery-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants?token=credit_xyz');
      });
    });

    it('redirects to bare /assistants when no credit token is present', async () => {
      server.use(http.post('/api/auth/mfa/verify', () => HttpResponse.json({ success: true })));

      const user = userEvent.setup();
      render(<MfaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('totp-input')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        await user.type(screen.getByTestId(`totp-digit-${i}`), '123456'[i]);
      }

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/assistants');
      });
    });
  });
});
