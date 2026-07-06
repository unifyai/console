'use client';

import { useCallback, useRef, KeyboardEvent, ClipboardEvent, useEffect } from 'react';
import { Input } from '@/components/UI/input';
import { cn } from '@/lib/utils';

const CODE_LENGTH = 6;

interface SixDigitCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  digitTestIdPrefix?: string;
}

const SixDigitCodeInput = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  digitTestIdPrefix = 'code-digit',
}: SixDigitCodeInputProps) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? '');

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < CODE_LENGTH) {
      inputRefs.current[index]?.focus();
    }
  }, []);

  useEffect(() => {
    if (autoFocus && !disabled) {
      focusInput(0);
    }
  }, [autoFocus, disabled, focusInput]);

  const handleChange = useCallback(
    (index: number, nextValue: string) => {
      const digit = nextValue.replace(/\D/g, '').slice(-1);
      const nextDigits = [...digits];
      nextDigits[index] = digit;
      const nextCode = nextDigits.join('');
      onChange(nextCode);

      if (digit && index < CODE_LENGTH - 1) {
        focusInput(index + 1);
      }

      if (digit && index === CODE_LENGTH - 1 && nextDigits.every((d) => d !== '')) {
        onComplete(nextCode);
      }
    },
    [digits, focusInput, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        focusInput(index - 1);
      }
    },
    [digits, focusInput]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
      if (!pasted) return;

      onChange(pasted);

      const nextEmpty = pasted.length < CODE_LENGTH ? pasted.length : CODE_LENGTH - 1;
      focusInput(nextEmpty);

      if (pasted.length === CODE_LENGTH) {
        onComplete(pasted);
      }
    },
    [focusInput, onChange, onComplete]
  );

  return (
    <div className="flex gap-1.5" data-testid="six-digit-code-input">
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          data-testid={`${digitTestIdPrefix}-${index}`}
          className={cn(
            'h-10 w-9 px-0 text-center font-mono text-base tabular-nums',
            invalid && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      ))}
    </div>
  );
};

export default SixDigitCodeInput;
