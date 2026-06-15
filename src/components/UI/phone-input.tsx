'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { cn } from '@/lib/utils';
import {
  PHONE_COUNTRIES,
  buildPhoneNumber,
  getPhoneCountry,
  parsePhoneNumber,
} from '@/utils/phone';

// Built once at module load. The country list is static, so freezing these
// elements keeps their references stable across re-renders and lets React skip
// reconciling the ~190-item dropdown on every keystroke in the number field.
const COUNTRY_OPTIONS = PHONE_COUNTRIES.map((country) => (
  <SelectItem key={country.code} value={country.code}>
    <span className="mr-2">{country.flag}</span>
    {country.name} (+{country.dialCode})
  </SelectItem>
));

interface PhoneInputProps {
  /** Full E.164 value, e.g. "+15551234567" (empty string when unset). */
  value: string;
  /** Called with the recombined full E.164 value whenever either part changes. */
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Applied to the national-number input for e2e/test targeting. */
  id?: string;
  /** Applied as data-testid to the country dropdown trigger. */
  countryTestId?: string;
  className?: string;
}

/**
 * Phone entry split into a country (dial-code) dropdown and a national-number
 * input. The country selector only controls the dialling prefix; the combined
 * `+<dialCode><nationalNumber>` string is what flows back through `onChange`,
 * keeping the payload identical to a single E.164 field.
 */
const PhoneInput = ({
  value,
  onChange,
  disabled = false,
  invalid = false,
  placeholder = '5551234567',
  id,
  countryTestId,
  className,
}: PhoneInputProps) => {
  const parsed = useMemo(() => parsePhoneNumber(value), [value]);

  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);

  // Keep internal state in sync when the value is changed externally (e.g.
  // reset, or initialised from the saved profile) without clobbering in-flight
  // edits whose recombined value already matches the incoming prop.
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const next = parsePhoneNumber(value);
    setCountryCode(next.countryCode);
    setNationalNumber(next.nationalNumber);
    lastEmitted.current = value;
  }, [value]);

  const emit = (nextCountry: string, nextNational: string) => {
    const combined = buildPhoneNumber(nextCountry, nextNational);
    lastEmitted.current = combined;
    onChange(combined);
  };

  const handleCountryChange = (nextCountry: string) => {
    setCountryCode(nextCountry);
    emit(nextCountry, nationalNumber);
  };

  const handleNationalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setNationalNumber(digits);
    emit(countryCode, digits);
  };

  const selected = getPhoneCountry(countryCode);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={selected.code} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger
          aria-label="Country code"
          data-testid={countryTestId}
          className={cn('w-[6.5rem] flex-shrink-0', invalid && 'border-destructive')}
        >
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{selected.flag}</span>
              <span>+{selected.dialCode}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>{COUNTRY_OPTIONS}</SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={nationalNumber}
        onChange={(e) => handleNationalChange(e.target.value)}
        disabled={disabled}
        className={cn('flex-1', invalid && 'border-destructive')}
      />
    </div>
  );
};

export default PhoneInput;
