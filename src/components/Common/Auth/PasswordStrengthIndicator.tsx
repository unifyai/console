'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validatePassword, type PasswordValidationResult } from '@/lib/auth/password';

interface PasswordStrengthIndicatorProps {
  /** The password to evaluate. */
  password: string;
  /** Extra CSS classes on the root wrapper. */
  className?: string;
}

/** Human-readable strength label derived from the percentage. */
function strengthLabel(strength: number): string {
  if (strength <= 20) return 'Very weak';
  if (strength <= 40) return 'Weak';
  if (strength <= 60) return 'Fair';
  if (strength <= 80) return 'Good';
  return 'Strong';
}

/** Tailwind colour class for the strength bar fill. */
function strengthColor(strength: number): string {
  if (strength <= 20) return 'bg-red-500';
  if (strength <= 40) return 'bg-orange-500';
  if (strength <= 60) return 'bg-yellow-500';
  if (strength <= 80) return 'bg-blue-500';
  return 'bg-green-500';
}

/**
 * Displays a password strength meter and a rule checklist.
 *
 * Rendered below password inputs during registration, password
 * reset, and password change flows.
 */
const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  const result: PasswordValidationResult = useMemo(() => validatePassword(password), [password]);

  // Don't render anything until the user starts typing
  if (!password) return null;

  const label = strengthLabel(result.strength);
  const barColor = strengthColor(result.strength);

  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="password-strength">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full transition-all duration-300', barColor)}
            style={{ width: `${result.strength}%` }}
            data-testid="password-strength-bar"
          />
        </div>
        <span
          className={cn(
            'text-caption font-medium whitespace-nowrap',
            result.strength <= 40 && 'text-red-500',
            result.strength > 40 && result.strength <= 60 && 'text-yellow-500',
            result.strength > 60 && result.strength <= 80 && 'text-blue-500',
            result.strength > 80 && 'text-green-500',
          )}
          data-testid="password-strength-label"
        >
          {label}
        </span>
      </div>

      {/* Rule checklist */}
      <ul className="flex flex-col gap-0.5" data-testid="password-rules-list">
        {result.rules.map((rule) => (
          <li
            key={rule.key}
            className={cn('flex items-center gap-1.5 text-caption', {
              'text-green-600 dark:text-green-400': rule.passed,
              'text-muted-foreground': !rule.passed,
            })}
            data-testid={`password-rule-${rule.key}`}
          >
            {rule.passed ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <X className="h-3 w-3 shrink-0" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;

