'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';

interface VerificationCodeInputProps {
  /** Called when all 6 digits have been entered */
  onSubmit: (code: string) => void;
  /** Called when user clicks "Resend code" */
  onResend: () => void;
  /** Whether the form is currently submitting */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Email address to display context */
  email: string;
  /** Label for context (e.g., "verify your email" or "reset your password") */
  purpose?: 'signup' | 'password_reset';
}

const VerificationCodeInput = ({
  onSubmit,
  onResend,
  isLoading = false,
  error,
  email,
  purpose = 'signup',
}: VerificationCodeInputProps) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const focusInput = (index: number) => {
    if (index >= 0 && index < 6) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      focusInput(index + 1);
    }

    // Auto-submit when all 6 digits are entered
    if (digit && index === 5 && newDigits.every((d) => d !== '')) {
      onSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    // Focus the next empty input, or the last one
    const nextEmpty = newDigits.findIndex((d) => d === '');
    focusInput(nextEmpty >= 0 ? nextEmpty : 5);

    // Auto-submit if all digits were pasted
    if (newDigits.every((d) => d !== '')) {
      onSubmit(newDigits.join(''));
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setDigits(['', '', '', '', '', '']);
    focusInput(0);
    onResend();
  };

  const handleManualSubmit = () => {
    const code = digits.join('');
    if (code.length === 6) {
      onSubmit(code);
    }
  };

  const purposeText = purpose === 'signup' ? 'verify your email' : 'reset your password';

  return (
    <div className="flex flex-col items-center gap-4" data-testid="verification-code-input">
      <p className="text-body text-center text-muted-foreground">
        We sent a 6-digit code to <strong>{email}</strong> to {purposeText}.
      </p>

      <div className="flex gap-2" data-testid="code-digits">
        {digits.map((digit, index) => (
          <Input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            className="h-12 w-12 text-center font-mono text-lg"
            disabled={isLoading}
            aria-label={`Digit ${index + 1}`}
            data-testid={`code-digit-${index}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-body text-error" data-testid="verification-error">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={handleManualSubmit}
        disabled={isLoading || digits.some((d) => d === '')}
        className="w-full"
        data-testid="verify-submit-btn"
      >
        {isLoading ? 'Verifying...' : 'Verify'}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendCooldown > 0}
        className="text-caption text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        data-testid="resend-code-btn"
      >
        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
      </button>
    </div>
  );
};

export default VerificationCodeInput;
