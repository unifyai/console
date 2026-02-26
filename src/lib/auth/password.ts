/**
 * Client-side password strength validation.
 *
 * Rules mirror the backend (orchestra/web/api/auth/schema.py) so that
 * users get instant inline feedback before submitting.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRule {
  /** Machine-readable identifier. */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Returns `true` when the rule is satisfied. */
  test: (password: string) => boolean;
}

/**
 * Ordered list of password rules.
 * Keep in sync with `_PASSWORD_RULES` on the backend.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    key: 'minLength',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: 'lowercase',
    label: 'At least one lowercase letter',
    test: (p) => /[a-z]/.test(p),
  },
  {
    key: 'uppercase',
    label: 'At least one uppercase letter',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    key: 'digit',
    label: 'At least one digit',
    test: (p) => /\d/.test(p),
  },
  {
    key: 'special',
    label: 'At least one special character',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export interface PasswordValidationResult {
  /** `true` when every rule passes. */
  isValid: boolean;
  /** Per-rule results in the same order as `PASSWORD_RULES`. */
  rules: { key: string; label: string; passed: boolean }[];
  /** 0–100 percentage of rules passed (for strength meter). */
  strength: number;
}

/**
 * Validate a password against all rules and return a structured result.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const rules = PASSWORD_RULES.map((rule) => ({
    key: rule.key,
    label: rule.label,
    passed: rule.test(password),
  }));

  const passedCount = rules.filter((r) => r.passed).length;
  const strength = Math.round((passedCount / rules.length) * 100);

  return {
    isValid: rules.every((r) => r.passed),
    rules,
    strength,
  };
}

/**
 * Returns a human-readable error string if the password is invalid,
 * or `undefined` if valid.  Useful as a one-liner in form handlers.
 */
export function getPasswordError(password: string): string | undefined {
  const { isValid, rules } = validatePassword(password);
  if (isValid) return undefined;

  const missing = rules.filter((r) => !r.passed).map((r) => r.label.toLowerCase());
  return `Password must have ${missing.join(', ')}.`;
}

