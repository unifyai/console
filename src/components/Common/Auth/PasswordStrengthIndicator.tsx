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

/**
 * Displays a rule checklist.
 *
 * Rendered below password inputs during registration, password
 * reset, and password change flows.
 */
const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  const result: PasswordValidationResult = useMemo(() => validatePassword(password), [password]);

  // Don't render anything until the user starts typing
  if (!password) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="password-strength">
      {/* Rule checklist */}
      <ul className="flex flex-col" data-testid="password-rules-list">
        {result.rules.map((rule) => (
          <li
            key={rule.key}
            className={cn('flex items-center gap-1 text-[11px] leading-tight', {
              'text-green-600 dark:text-green-400': rule.passed,
              'text-muted-foreground': !rule.passed,
            })}
            data-testid={`password-rule-${rule.key}`}
          >
            {rule.passed ? (
              <Check className="h-2.5 w-2.5 shrink-0" />
            ) : (
              <X className="h-2.5 w-2.5 shrink-0" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
