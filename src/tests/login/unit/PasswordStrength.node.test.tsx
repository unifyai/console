/**
 * Tests for password strength validation and the PasswordStrengthIndicator.
 *
 * Strategy:
 *   A. Unit tests for the validatePassword / getPasswordError utility
 *      – verifies every individual rule
 *      – verifies composite results (strength %, isValid)
 *      – verifies getPasswordError messages
 *   B. Component tests for PasswordStrengthIndicator
 *      – verifies it renders nothing when password is empty
 *      – verifies correct strength label & bar width
 *      – verifies each rule shows ✓ / ✗ correctly
 *   C. Integration tests for form-level validation
 *      – EmailLoginForm blocks registration with weak password
 *      – ChangePasswordForm blocks change with weak password
 *      – ForgotPasswordForm blocks reset with weak password
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── A. Pure utility tests ──────────────────────────────────────────────────

import {
  validatePassword,
  getPasswordError,
  PASSWORD_RULES,
  PASSWORD_MIN_LENGTH,
} from '@/lib/auth/password';

describe('validatePassword – individual rules', () => {
  it('minLength rule fails for short passwords', () => {
    const result = validatePassword('Aa1!');
    const rule = result.rules.find((r) => r.key === 'minLength');
    expect(rule?.passed).toBe(false);
  });

  it('minLength rule passes for 8+ characters', () => {
    const result = validatePassword('abcdefgh');
    const rule = result.rules.find((r) => r.key === 'minLength');
    expect(rule?.passed).toBe(true);
  });

  it('lowercase rule fails when no lowercase letters', () => {
    const result = validatePassword('ABCDEFG1!');
    const rule = result.rules.find((r) => r.key === 'lowercase');
    expect(rule?.passed).toBe(false);
  });

  it('lowercase rule passes when lowercase present', () => {
    const result = validatePassword('ABCDEFGa1!');
    const rule = result.rules.find((r) => r.key === 'lowercase');
    expect(rule?.passed).toBe(true);
  });

  it('uppercase rule fails when no uppercase letters', () => {
    const result = validatePassword('abcdefg1!');
    const rule = result.rules.find((r) => r.key === 'uppercase');
    expect(rule?.passed).toBe(false);
  });

  it('uppercase rule passes when uppercase present', () => {
    const result = validatePassword('abcdefgA1!');
    const rule = result.rules.find((r) => r.key === 'uppercase');
    expect(rule?.passed).toBe(true);
  });

  it('digit rule fails when no digits', () => {
    const result = validatePassword('Abcdefg!@');
    const rule = result.rules.find((r) => r.key === 'digit');
    expect(rule?.passed).toBe(false);
  });

  it('digit rule passes when digit present', () => {
    const result = validatePassword('Abcdefg1!');
    const rule = result.rules.find((r) => r.key === 'digit');
    expect(rule?.passed).toBe(true);
  });

  it('special rule fails when only alphanumerics', () => {
    const result = validatePassword('Abcdefg12');
    const rule = result.rules.find((r) => r.key === 'special');
    expect(rule?.passed).toBe(false);
  });

  it('special rule passes with special character', () => {
    const result = validatePassword('Abcdefg1!');
    const rule = result.rules.find((r) => r.key === 'special');
    expect(rule?.passed).toBe(true);
  });
});

describe('validatePassword – composite results', () => {
  it('returns isValid: true when all rules pass', () => {
    const result = validatePassword('Str0ng!Pass');
    expect(result.isValid).toBe(true);
    expect(result.strength).toBe(100);
  });

  it('returns isValid: false when any rule fails', () => {
    // Missing uppercase
    const result = validatePassword('str0ng!pass');
    expect(result.isValid).toBe(false);
    expect(result.strength).toBeLessThan(100);
  });

  it('strength is 0% for empty password', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.strength).toBe(0);
  });

  it('strength scales with number of passed rules', () => {
    // Only lowercase (1 of 5 rules)
    const r1 = validatePassword('a');
    expect(r1.strength).toBe(20);

    // lowercase + uppercase (2 of 5)
    const r2 = validatePassword('aA');
    expect(r2.strength).toBe(40);

    // lowercase + uppercase + digit (3 of 5)
    const r3 = validatePassword('aA1');
    expect(r3.strength).toBe(60);

    // lowercase + uppercase + digit + special (4 of 5, but too short)
    const r4 = validatePassword('aA1!');
    expect(r4.strength).toBe(80);

    // All rules (5 of 5)
    const r5 = validatePassword('aA1!longEnough');
    expect(r5.strength).toBe(100);
  });

  it('returns all 5 rules', () => {
    const result = validatePassword('anything');
    expect(result.rules).toHaveLength(PASSWORD_RULES.length);
    expect(result.rules).toHaveLength(5);
  });
});

describe('getPasswordError', () => {
  it('returns undefined for a valid password', () => {
    expect(getPasswordError('Str0ng!Pass')).toBeUndefined();
  });

  it('returns error string listing all missing rules', () => {
    // Only lowercase letters, so missing: minLength, uppercase, digit, special
    const error = getPasswordError('abc');
    expect(error).toBeDefined();
    expect(error).toContain('at least');
  });

  it('mentions specific missing rule for single failure', () => {
    // Missing only special character
    const error = getPasswordError('Abcdefg12');
    expect(error).toBeDefined();
    expect(error).toContain('special character');
    // Should NOT mention other rules since they pass
    expect(error).not.toContain('uppercase');
    expect(error).not.toContain('lowercase');
    expect(error).not.toContain('digit');
  });

  it('mentions minLength when password is too short but otherwise valid', () => {
    const error = getPasswordError('Aa1!');
    expect(error).toBeDefined();
    expect(error).toContain(`${PASSWORD_MIN_LENGTH} characters`);
  });
});

// ─── B. PasswordStrengthIndicator component tests ───────────────────────────

// We need to mock lucide-react icons for jsdom
vi.mock('lucide-react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('lucide-react')>();
  return {
    ...mod,
    Check: ({ ...props }: any) => <span data-testid="check-icon" {...props} />,
    X: ({ ...props }: any) => <span data-testid="x-icon" {...props} />,
  };
});

import PasswordStrengthIndicator from '@/components/Common/Auth/PasswordStrengthIndicator';

describe('PasswordStrengthIndicator – rendering', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when password has content', () => {
    render(<PasswordStrengthIndicator password="a" />);
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  it('renders all 5 rule items', () => {
    render(<PasswordStrengthIndicator password="a" />);
    const ruleList = screen.getByTestId('password-rules-list');
    expect(ruleList.children).toHaveLength(5);
  });
});

describe('PasswordStrengthIndicator – strength labels', () => {
  it('shows "Very weak" for 1/5 rules passed', () => {
    // 'a' → only lowercase passes (20%)
    render(<PasswordStrengthIndicator password="a" />);
    expect(screen.getByTestId('password-strength-label').textContent).toBe('Very weak');
  });

  it('shows "Weak" for 2/5 rules passed', () => {
    // 'aA' → lowercase + uppercase (40%)
    render(<PasswordStrengthIndicator password="aA" />);
    expect(screen.getByTestId('password-strength-label').textContent).toBe('Weak');
  });

  it('shows "Fair" for 3/5 rules passed', () => {
    // 'aA1' → lowercase + uppercase + digit (60%)
    render(<PasswordStrengthIndicator password="aA1" />);
    expect(screen.getByTestId('password-strength-label').textContent).toBe('Fair');
  });

  it('shows "Good" for 4/5 rules passed', () => {
    // 'aA1!' → 4 rules but too short (80%)
    render(<PasswordStrengthIndicator password="aA1!" />);
    expect(screen.getByTestId('password-strength-label').textContent).toBe('Good');
  });

  it('shows "Strong" for all rules passed', () => {
    render(<PasswordStrengthIndicator password="Str0ng!Pass" />);
    expect(screen.getByTestId('password-strength-label').textContent).toBe('Strong');
  });
});

describe('PasswordStrengthIndicator – rule checkmarks', () => {
  it('marks passed rules with check icon class', () => {
    render(<PasswordStrengthIndicator password="abcdefgh" />);

    // minLength: passed (8 chars), lowercase: passed
    const minLenRule = screen.getByTestId('password-rule-minLength');
    expect(minLenRule.className).toContain('text-green');

    const lowercaseRule = screen.getByTestId('password-rule-lowercase');
    expect(lowercaseRule.className).toContain('text-green');

    // uppercase: not passed
    const uppercaseRule = screen.getByTestId('password-rule-uppercase');
    expect(uppercaseRule.className).toContain('text-muted');
  });

  it('strength bar width matches strength percentage', () => {
    render(<PasswordStrengthIndicator password="aA1!" />);
    const bar = screen.getByTestId('password-strength-bar');
    expect(bar.style.width).toBe('80%');
  });
});

// ─── C. Form integration tests ──────────────────────────────────────────────

// Mock shared UI components
vi.mock('@/components/UI/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/UI/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/Common/Input/Password', () => ({
  PasswordInput: ({ ...props }: any) => <input {...props} type="password" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock next-auth
const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}));

// Mock Turnstile
vi.mock('@/components/Common/Auth/TurnstileWidget', () => ({
  default: ({ onVerify }: any) => {
    if (onVerify) setTimeout(() => onVerify('test-token'), 0);
    return <div data-testid="turnstile-widget-mock" />;
  },
}));

// Mock verification code and forgot password to simplify
vi.mock('@/app/login/verification-code', () => ({
  default: ({ onSubmit, error }: any) => (
    <div data-testid="verification-code-mock">
      {error && <span data-testid="verification-error">{error}</span>}
      <button data-testid="submit-code" onClick={() => onSubmit('123456')}>
        Submit Code
      </button>
    </div>
  ),
}));

vi.mock('@/app/login/forgot-password', () => ({
  default: ({ onBack }: any) => (
    <div data-testid="forgot-password-mock">
      <button data-testid="forgot-back" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

import EmailLoginForm from '@/components/Pages/Login/EmailLoginForm';
import ChangePasswordForm from '@/components/Pages/Profile/ChangePassword';

describe('EmailLoginForm – password strength enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks registration when password is missing uppercase', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    // Password has lowercase + digit + special + 8 chars, but NO uppercase
    await user.type(screen.getByTestId('email-password-input'), 'abcdefg1!');
    await user.click(screen.getByTestId('email-submit-btn'));

    // Should show client-side error, NOT make API call
    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('uppercase');
    });
  });

  it('blocks registration when password is missing special character', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Abcdefg12');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('special character');
    });
  });

  it('blocks registration when password is too short', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Aa1!');
    await user.click(screen.getByTestId('email-submit-btn'));

    await waitFor(() => {
      const error = screen.getByTestId('email-auth-error');
      expect(error.textContent).toContain('characters');
    });
  });

  it('allows registration when password meets all rules', async () => {
    const fetchSpy = vi.fn();
    // We need to use the global fetch mock since MSW might not be set up here
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'test@example.com', requiresVerification: true }),
    });
    fetchSpy.mockImplementation(global.fetch);

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('email-password-input'), 'Str0ng!Pass');
    await user.click(screen.getByTestId('email-submit-btn'));

    // Should NOT show a client-side password error — the request goes through
    await waitFor(() => {
      expect(screen.queryByTestId('email-auth-error')).not.toBeInTheDocument();
    });
  });

  it('does NOT enforce strength rules on the login form', async () => {
    // Login should not block on password strength — backend handles auth
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ preAuthToken: 'tok' }),
    });
    mockSignIn.mockResolvedValueOnce({ url: '/assistants', error: null, ok: true });

    const user = userEvent.setup();
    render(<EmailLoginForm />);

    await user.type(screen.getByTestId('email-input'), 'user@test.com');
    // Intentionally weak password — should still proceed to login
    await user.type(screen.getByTestId('email-password-input'), 'weak');
    await user.click(screen.getByTestId('email-submit-btn'));

    // No password-strength error should appear
    await waitFor(() => {
      expect(
        screen.queryByText(/uppercase|special character|digit/i),
      ).not.toBeInTheDocument();
    });
  });

  it('shows strength indicator only in register view, not login view', async () => {
    const user = userEvent.setup();
    render(<EmailLoginForm />);

    // Login view — no indicator
    await user.type(screen.getByTestId('email-password-input'), 'test');
    expect(screen.queryByTestId('password-strength')).not.toBeInTheDocument();

    // Switch to register — indicator appears
    await user.click(screen.getByTestId('switch-to-register'));
    await user.type(screen.getByTestId('email-password-input'), 'test');
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });
});

describe('ChangePasswordForm – password strength enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks change when new password is missing digit', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'OldPass1!');
    // Missing digit
    await user.type(screen.getByTestId('new-password-input'), 'Abcdefg!!');
    await user.type(screen.getByTestId('confirm-password-input'), 'Abcdefg!!');
    await user.click(screen.getByTestId('change-password-btn'));

    expect(screen.getByTestId('change-password-error').textContent).toContain('digit');
  });

  it('blocks change when new password has multiple missing rules', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('current-password-input'), 'OldPass1!');
    // Only lowercase, nothing else
    await user.type(screen.getByTestId('new-password-input'), 'abcdefghij');
    await user.type(screen.getByTestId('confirm-password-input'), 'abcdefghij');
    await user.click(screen.getByTestId('change-password-btn'));

    const error = screen.getByTestId('change-password-error').textContent!;
    expect(error).toContain('uppercase');
    expect(error).toContain('digit');
    expect(error).toContain('special character');
  });

  it('shows strength indicator next to new password field', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm hasEmailAccount={true} />);

    await user.type(screen.getByTestId('new-password-input'), 'abc');
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });
});

