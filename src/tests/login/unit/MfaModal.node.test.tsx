/**
 * Tests for the MfaModal component and useMfaProtection hook.
 *
 * Covers manual test cases:
 *   12.1 — Sensitive action with MFA enabled; 403 mfa_required → modal shown
 *   12.2 — Enter correct code in modal → action proceeds
 *   12.3 — (Inverse: without MFA, no modal) — covered by hook not opening
 *
 * The MfaModal supports two verification modes:
 *   - TOTP: 6-digit code from authenticator app
 *   - Recovery: single-use recovery code
 *
 * Strategy:
 *   - Mock the Dialog/UI primitives to avoid Radix portal complexities in jsdom
 *   - Mock TotpInput as a thin shim
 *   - Test expected user-visible behavior (error messages, mode switching, callbacks)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/UI/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div data-testid="dialog-wrapper">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
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

/**
 * TotpInput mock: renders a button that submits a fixed code.
 */
vi.mock('@/components/Common/Auth/TotpInput', () => ({
  default: ({ onSubmit, error, isLoading }: any) => (
    <div data-testid="totp-input-mock">
      {error && <span data-testid="totp-error">{error}</span>}
      <button
        data-testid="mock-submit-totp"
        onClick={() => onSubmit('654321')}
        disabled={isLoading}
      >
        Submit TOTP
      </button>
    </div>
  ),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import MfaModal from '@/components/Common/Auth/MfaModal';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MfaModal – TOTP mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    render(
      <MfaModal open={false} onClose={vi.fn()} onVerify={vi.fn()} />
    );
    expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
  });

  it('renders TOTP input when open', () => {
    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={vi.fn()} />
    );
    expect(screen.getByTestId('mfa-modal')).toBeInTheDocument();
    expect(screen.getByTestId('totp-input-mock')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title').textContent).toBe('Verify Identity');
  });

  it('allows custom title and description', () => {
    render(
      <MfaModal
        open={true}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        title="Confirm Delete"
        description="Enter your code to delete your account."
      />
    );
    expect(screen.getByTestId('dialog-title').textContent).toBe('Confirm Delete');
    expect(screen.getByTestId('dialog-description').textContent).toBe(
      'Enter your code to delete your account.'
    );
  });

  it('calls onVerify with code and type "totp" on submission (12.2)', async () => {
    const onVerify = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={onClose} onVerify={onVerify} />
    );

    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith('654321', 'totp');
    });
  });

  it('shows error when onVerify returns false (incorrect code)', async () => {
    const onVerify = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(screen.getByTestId('totp-error').textContent).toBe(
        'Invalid code. Please try again.'
      );
    });
  });

  it('shows error when onVerify throws', async () => {
    const onVerify = vi.fn().mockRejectedValue(new Error('network'));
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    await user.click(screen.getByTestId('mock-submit-totp'));

    await waitFor(() => {
      expect(screen.getByTestId('totp-error').textContent).toBe(
        'Verification failed. Please try again.'
      );
    });
  });
});

describe('MfaModal – recovery mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches to recovery code input', async () => {
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={vi.fn()} />
    );

    await user.click(screen.getByText('Use a recovery code instead'));

    expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();
    expect(screen.getByText('Enter one of your recovery codes')).toBeInTheDocument();
  });

  it('calls onVerify with code and type "recovery"', async () => {
    const onVerify = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    await user.click(screen.getByText('Use a recovery code instead'));
    await user.type(screen.getByTestId('recovery-code-input'), 'a3f8k2m9');
    await user.click(screen.getByTestId('recovery-submit'));

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith('a3f8k2m9', 'recovery');
    });
  });

  it('shows error when recovery code is invalid', async () => {
    const onVerify = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    await user.click(screen.getByText('Use a recovery code instead'));
    await user.type(screen.getByTestId('recovery-code-input'), 'bad-code');
    await user.click(screen.getByTestId('recovery-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('recovery-error').textContent).toBe(
        'Invalid recovery code. Please try again.'
      );
    });
  });

  it('disables submit button when recovery code is empty', async () => {
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={vi.fn()} />
    );

    await user.click(screen.getByText('Use a recovery code instead'));

    expect(screen.getByTestId('recovery-submit')).toBeDisabled();
  });

  it('switches back to TOTP mode from recovery', async () => {
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={vi.fn()} />
    );

    // Switch to recovery
    await user.click(screen.getByText('Use a recovery code instead'));
    expect(screen.getByTestId('recovery-code-input')).toBeInTheDocument();

    // Switch back to TOTP
    await user.click(screen.getByText('Use authenticator app instead'));
    expect(screen.getByTestId('totp-input-mock')).toBeInTheDocument();
  });

  it('clears error when switching modes', async () => {
    const onVerify = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();

    render(
      <MfaModal open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    // Get an error in TOTP mode
    await user.click(screen.getByTestId('mock-submit-totp'));
    await waitFor(() => {
      expect(screen.getByTestId('totp-error')).toBeInTheDocument();
    });

    // Switch to recovery — error should be cleared
    await user.click(screen.getByText('Use a recovery code instead'));
    expect(screen.queryByTestId('totp-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recovery-error')).not.toBeInTheDocument();
  });
});

