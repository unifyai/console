/**
 * Tests for the ChangePasswordForm component.
 *
 * Strategy:
 *   1. Test that it renders nothing when hasEmailAccount is false
 *   2. Test that it renders the form when hasEmailAccount is true
 *   3. Test password mismatch validation
 *   4. Test minimum length validation
 *   5. Test same-as-current validation
 *   6. Test successful password change
 *   7. Test API error handling
 *   8. Test network error handling
 *   9. Test button disabled state
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ChangePasswordForm – visibility', () => {
  it('renders nothing when hasEmailAccount is false', () => {
    const { container } = render(<ChangePasswordForm hasEmailAccount={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the form when hasEmailAccount is true', () => {
    render(<ChangePasswordForm hasEmailAccount={true} />);
    expect(screen.getByTestId('change-password-section')).toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
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

    await user.type(screen.getByTestId('current-password-input'), 'currentPass1');
    await user.type(screen.getByTestId('new-password-input'), 'newPassword1');
    await user.type(screen.getByTestId('confirm-password-input'), 'differentPass');
    await user.click(screen.getByTestId('change-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toBe(
      'New passwords do not match'
    );
    // Validation fires before API call — spy should NOT have been called
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('shows error when new password is too short', async () => {
    const changeSpy = vi.fn();
    server.use(
      http.post('/api/auth/email/change-password', async ({ request }) => {
        changeSpy(await request.json());
        return HttpResponse.json({ message: 'ok' });
      })
    );

    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'currentPass1');
    await user.type(screen.getByTestId('new-password-input'), 'short');
    await user.type(screen.getByTestId('confirm-password-input'), 'short');
    await user.click(screen.getByTestId('change-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toBe(
      'New password must be at least 8 characters'
    );
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

    await user.type(screen.getByTestId('current-password-input'), 'samePassword');
    await user.type(screen.getByTestId('new-password-input'), 'samePassword');
    await user.type(screen.getByTestId('confirm-password-input'), 'samePassword');
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

    await user.type(screen.getByTestId('current-password-input'), 'oldPassword1');
    await user.type(screen.getByTestId('new-password-input'), 'newPassword1');
    await user.type(screen.getByTestId('confirm-password-input'), 'newPassword1');
    await user.click(screen.getByTestId('change-password-btn'));

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith({
        currentPassword: 'oldPassword1',
        newPassword: 'newPassword1',
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

    await user.type(screen.getByTestId('current-password-input'), 'oldPassword1');
    await user.type(screen.getByTestId('new-password-input'), 'newPassword1');
    await user.type(screen.getByTestId('confirm-password-input'), 'newPassword1');
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
    await user.type(screen.getByTestId('new-password-input'), 'newPassword1');
    await user.type(screen.getByTestId('confirm-password-input'), 'newPassword1');
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

    await user.type(screen.getByTestId('current-password-input'), 'oldPassword1');
    await user.type(screen.getByTestId('new-password-input'), 'newPassword1');
    await user.type(screen.getByTestId('confirm-password-input'), 'newPassword1');
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
    await user.type(screen.getByTestId('new-password-input'), 'newpass123');
    await user.type(screen.getByTestId('confirm-password-input'), 'newpass123');
    expect(screen.getByTestId('change-password-btn')).not.toBeDisabled();
  });
});
