/**
 * Tests for the ChangePasswordForm component.
 *
 * Strategy:
 *   A. Change Password mode (hasEmailAccount=true):
 *     1. Test that it renders the "Change password" form with current-password field
 *     2. Test password mismatch validation
 *     3. Test password strength validation
 *     4. Test same-as-current validation
 *     5. Test successful password change
 *     6. Test API error handling (wrong current password)
 *     7. Test network error handling
 *     8. Test button disabled state
 *
 *   B. Set Password mode (hasEmailAccount=false — OAuth-only users):
 *     1. Test that it renders the "Set password" form without current-password field
 *     2. Test it calls /api/auth/email/set-password (not change-password)
 *     3. Test it sends only { newPassword } (no currentPassword)
 *     4. Test success shows "Password set successfully" toast
 *     5. Test onPasswordSet callback is called on success
 *     6. Test password strength validation still applies
 *     7. Test password mismatch validation still applies
 *     8. Test "same as current" validation is NOT applied (no current pw field)
 *     9. Test button label says "Set password"
 *     10. Test API error handling
 *     11. Test network error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/Common/Input/Password', () => ({
  PasswordInput: ({ ...props }: any) => <input {...props} type="password" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import ChangePasswordForm from '@/components/Pages/Profile/ChangePassword';
import { toast } from 'sonner';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A password that passes every strength rule. */
const STRONG_PW = 'New@Pass1';
/** A different strong password for the "current" field. */
const CURRENT_PW = 'Old@Pass1';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ChangePasswordForm – visibility', () => {
  it('renders "Set password" form when hasEmailAccount is false (OAuth-only user)', () => {
    render(<ChangePasswordForm hasEmailAccount={false} />);
    expect(screen.getByTestId('set-password-section')).toBeInTheDocument();
    // No current-password field in set mode
    expect(screen.queryByTestId('current-password-input')).not.toBeInTheDocument();
    // Button says "Set password"
    expect(screen.getByTestId('set-password-btn')).toBeInTheDocument();
    expect(screen.getByTestId('set-password-btn').textContent).toBe('Set password');
  });

  it('renders "Change password" form when hasEmailAccount is true', () => {
    render(<ChangePasswordForm hasEmailAccount={true} />);
    expect(screen.getByTestId('change-password-section')).toBeInTheDocument();
    expect(screen.getByText('Change password')).toBeInTheDocument();
    // Current-password field is present
    expect(screen.getByTestId('current-password-input')).toBeInTheDocument();
  });
});

describe('ChangePasswordForm – validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when passwords do not match', async () => {
    const changeSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/change-password', async ({ request }) => {
        changeSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), CURRENT_PW);
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), 'Different@1');
    await user.click(screen.getByTestId('change-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toBe(
      'Passwords do not match'
    );
    // Validation fires before API call — spy should NOT have been called
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('shows error when new password fails strength rules', async () => {
    const changeSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/change-password', async ({ request }) => {
        changeSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), CURRENT_PW);
    // 'short' — fails minLength, uppercase, digit, special
    await user.type(screen.getByTestId('new-password-input'), 'short');
    await user.type(screen.getByTestId('confirm-password-input'), 'short');
    await user.click(screen.getByTestId('change-password-btn'));

    const errorText = screen.getByTestId('change-password-error').textContent!;
    // Should mention at least one missing rule
    expect(errorText).toContain('Password must have');
    expect(errorText).toContain('8 characters');
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('shows error when new password equals current password', async () => {
    const changeSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/change-password', async ({ request }) => {
        changeSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    // Use a strong password for both current and new
    await user.type(screen.getByTestId('current-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('change-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toBe(
      'New password must be different from current password'
    );
    expect(changeSpy).not.toHaveBeenCalled();
  });
});

describe('ChangePasswordForm – API interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the change-password API on valid submission', async () => {
    const changeSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/change-password', async ({ request }) => {
        changeSpy(await request.json());
        return HttpResponse.json({ message: 'Password changed' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), CURRENT_PW);
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('change-password-btn'));

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith({
        currentPassword: CURRENT_PW,
        newPassword: STRONG_PW,
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully');
    });
  });

  it('clears form fields after successful change', async () => {
    server.use(
      http.post('/api/auth/email/change-password', () =>
        HttpResponse.json({ message: 'done' })
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), CURRENT_PW);
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('change-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('current-password-input')).toHaveValue('');
      expect(screen.getByTestId('new-password-input')).toHaveValue('');
      expect(screen.getByTestId('confirm-password-input')).toHaveValue('');
    });
  });

  it('shows error from API on failure', async () => {
    server.use(
      http.post('/api/auth/email/change-password', () =>
        HttpResponse.json(
          { message: 'Current password is incorrect' },
          { status: 401 }
        )
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'wrongOldPass');
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('change-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('change-password-error').textContent).toBe(
        'Current password is incorrect'
      );
    });
  });

  it('handles network error', async () => {
    server.use(
      http.post('/api/auth/email/change-password', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), CURRENT_PW);
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('change-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('change-password-error').textContent).toContain('Network error');
    });
  });
});

describe('ChangePasswordForm – button state', () => {
  it('button is disabled when all fields are empty', () => {
    render(<ChangePasswordForm hasEmailAccount={true} />);
    expect(screen.getByTestId('change-password-btn')).toBeDisabled();
  });

  it('button is disabled when only current password is filled', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'password');
    expect(screen.getByTestId('change-password-btn')).toBeDisabled();
  });

  it('button is enabled when all fields are filled', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'current');
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    expect(screen.getByTestId('change-password-btn')).not.toBeDisabled();
  });
});

// ─── Set Password mode (OAuth-only users, hasEmailAccount=false) ──────────

describe('ChangePasswordForm – Set Password mode – API interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /api/auth/email/set-password with only newPassword', async () => {
    const setSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/set-password', async ({ request }) => {
        setSpy(await request.json());
        return HttpResponse.json({ message: 'Password set' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith({ newPassword: STRONG_PW });
    });

    // Should NOT include currentPassword in the payload
    expect(setSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ currentPassword: expect.anything() })
    );
  });

  it('shows "Password set successfully" toast on success', async () => {
    server.use(
      http.post('/api/auth/email/set-password', () =>
        HttpResponse.json({ message: 'Password set' })
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Password set successfully');
    });
  });

  it('calls onPasswordSet callback on success', async () => {
    const onPasswordSet = vi.fn();
    server.use(
      http.post('/api/auth/email/set-password', () =>
        HttpResponse.json({ message: 'Password set' })
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} onPasswordSet={onPasswordSet} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(onPasswordSet).toHaveBeenCalled();
    });
  });

  it('clears form fields after successful set', async () => {
    server.use(
      http.post('/api/auth/email/set-password', () =>
        HttpResponse.json({ message: 'done' })
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('new-password-input')).toHaveValue('');
      expect(screen.getByTestId('confirm-password-input')).toHaveValue('');
    });
  });

  it('shows error from API on failure', async () => {
    server.use(
      http.post('/api/auth/email/set-password', () =>
        HttpResponse.json(
          { message: 'Email account linking failed' },
          { status: 400 }
        )
      )
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('change-password-error').textContent).toBe(
        'Email account linking failed'
      );
    });
  });

  it('handles network error', async () => {
    server.use(
      http.post('/api/auth/email/set-password', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('change-password-error').textContent).toContain('Network error');
    });
  });
});

describe('ChangePasswordForm – Set Password mode – validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects weak password in set mode', async () => {
    const setSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/set-password', async ({ request }) => {
        setSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    // 'short' — fails minLength, uppercase, digit, special
    await user.type(screen.getByTestId('new-password-input'), 'short');
    await user.type(screen.getByTestId('confirm-password-input'), 'short');
    await user.click(screen.getByTestId('set-password-btn'));

    const errorText = screen.getByTestId('change-password-error').textContent!;
    expect(errorText).toContain('Password must have');
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords in set mode', async () => {
    const setSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/set-password', async ({ request }) => {
        setSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), 'Different@1');
    await user.click(screen.getByTestId('set-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toBe(
      'Passwords do not match'
    );
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('does NOT apply "same as current" validation in set mode', async () => {
    const setSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/set-password', async ({ request }) => {
        setSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    // In set mode there is no "current" password, so no "same as current" check
    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    await user.click(screen.getByTestId('set-password-btn'));

    // Should proceed to API call — no "same as current" error
    await waitFor(() => {
      expect(setSpy).toHaveBeenCalled();
    });
  });
});

describe('ChangePasswordForm – Set Password mode – button state', () => {
  it('button is enabled without current-password (only new + confirm needed)', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={false} />);

    await user.type(screen.getByTestId('new-password-input'), STRONG_PW);
    await user.type(screen.getByTestId('confirm-password-input'), STRONG_PW);
    expect(screen.getByTestId('set-password-btn')).not.toBeDisabled();
  });

  it('button is disabled when password fields are empty', () => {
    render(<ChangePasswordForm hasEmailAccount={false} />);
    expect(screen.getByTestId('set-password-btn')).toBeDisabled();
  });
});
