'use client';

import { useState, useRef, KeyboardEvent, ClipboardEvent, useCallback } from 'react';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';

interface TotpInputProps {
  /** Called when the user submits a 6-digit code. */
  onSubmit: (code: string) => void | Promise<void>;
  /** Error message to display below the input. */
  error?: string;
  /** Whether a submission is in progress. */
  isLoading?: boolean;
  /** Optional label above the input. */
  label?: string;
  /** Whether to auto-focus the first input on mount. */
  autoFocus?: boolean;
}

const CODE_LENGTH = 6;

const TotpInput = ({
  onSubmit,
  error,
  isLoading = false,
  label = 'Enter your 6-digit code',
  autoFocus = true,
}: TotpInputProps) => {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1);
      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);

      // Auto-advance to next input
      if (digit && index < CODE_LENGTH - 1) {
        focusInput(index + 1);
      }

      // Auto-submit when all digits are filled
      if (digit && index === CODE_LENGTH - 1) {
        const code = newDigits.join('');
        if (code.length === CODE_LENGTH) {
          onSubmit(code);
        }
      }
    },
    [digits, focusInput, onSubmit],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        focusInput(index - 1);
      }
    },
    [digits, focusInput],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
      if (!pasted) return;

      const newDigits = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);

      // Focus the next empty or the last input
      const nextEmpty = pasted.length < CODE_LENGTH ? pasted.length : CODE_LENGTH - 1;
      focusInput(nextEmpty);

      // Auto-submit if all filled
      if (pasted.length === CODE_LENGTH) {
        onSubmit(pasted);
      }
    },
    [focusInput, onSubmit],
  );

  const handleSubmit = useCallback(() => {
    const code = digits.join('');
    if (code.length === CODE_LENGTH) {
      onSubmit(code);
    }
  }, [digits, onSubmit]);

  return (
    <div className="flex flex-col items-center gap-4" data-testid="totp-input">
      <p className="text-body text-muted-foreground">{label}</p>

      <div className="flex gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            autoFocus={autoFocus && i === 0}
            disabled={isLoading}
            className="h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-mono
                       focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
                       disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={`totp-digit-${i}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-caption text-destructive" data-testid="totp-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isLoading || digits.join('').length < CODE_LENGTH}
        className="w-full max-w-xs"
        data-testid="totp-submit"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify'
        )}
      </Button>
    </div>
  );
};

export default TotpInput;

