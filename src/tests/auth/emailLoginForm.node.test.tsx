import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailLoginForm from '@/components/Pages/Login/EmailLoginForm';

const authMocks = vi.hoisted(() => ({
  selfHostSignInByEmail: vi.fn(),
  signIn: vi.fn(),
}));

const environmentState = vi.hoisted(() => ({
  isSelfHost: true,
  captcha: false,
}));

vi.mock('@/lib/self-host/actions', () => ({
  selfHostSignInByEmail: authMocks.selfHostSignInByEmail,
}));

vi.mock('next-auth/react', () => ({
  signIn: authMocks.signIn,
}));

vi.mock('@/components/Pages/Providers/EnvironmentProvider', () => ({
  useEnvironment: () => ({ isSelfHost: environmentState.isSelfHost }),
  useFeatures: () => ({ captcha: environmentState.captcha }),
}));

describe('EmailLoginForm self-host flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    environmentState.isSelfHost = true;
    environmentState.captcha = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on account creation and keeps passwords hidden in self-host', () => {
    render(<EmailLoginForm />);

    expect(screen.getByTestId('email-register-form')).toBeInTheDocument();
    expect(screen.queryByTestId('email-password-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('switch-to-login'));

    expect(screen.getByTestId('email-login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('email-password-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('email-submit-btn')).toBeDisabled();
  });

  it('uses passwordless self-host sign-in by email', async () => {
    authMocks.selfHostSignInByEmail.mockResolvedValue({ ok: false, reason: 'no_account' });
    render(<EmailLoginForm />);

    fireEvent.click(screen.getByTestId('switch-to-login'));
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() =>
      expect(authMocks.selfHostSignInByEmail).toHaveBeenCalledWith('owner@example.com')
    );
    expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
      'No local account exists for this email. Create one to continue.'
    );
    expect(authMocks.signIn).not.toHaveBeenCalled();
  });

  it('turns duplicate self-host registration into sign-in recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'email_exists',
          message: 'An account with this email already exists. Please sign in.',
        }),
      })
    );

    render(<EmailLoginForm />);

    fireEvent.change(screen.getByTestId('email-first-name-input'), {
      target: { value: 'Local' },
    });
    fireEvent.change(screen.getByTestId('email-last-name-input'), {
      target: { value: 'Owner' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => expect(screen.getByTestId('email-login-form')).toBeInTheDocument());
    expect(screen.getByTestId('email-input')).toHaveValue('owner@example.com');
    expect(screen.queryByTestId('email-password-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('email-auth-error')).toHaveTextContent(
      'This local account already exists. Sign in to continue.'
    );
  });
});
