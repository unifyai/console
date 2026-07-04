'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Input } from '@/components/UI/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { cn } from '@/lib/utils';
import {
  PHONE_COUNTRIES,
  buildPhoneNumber,
  getPhoneCountry,
  parsePhoneNumber,
} from '@/utils/phone';

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
  const parsed = parsePhoneNumber(value);

  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);
  const [countryOpen, setCountryOpen] = useState(false);

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
      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={countryOpen}
            aria-label="Country code"
            data-testid={countryTestId}
            disabled={disabled}
            className={cn(
              'text-body h-9 w-[6.5rem] flex-shrink-0 justify-between px-3 py-2 font-normal shadow-sm',
              invalid && 'border-destructive'
            )}
          >
            <span className="flex items-center gap-1.5">
              <span>{selected.flag}</span>
              <span>+{selected.dialCode}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search country or code…"
              onKeyDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            />
            <CommandList>
              <CommandEmpty>No countries match your search.</CommandEmpty>
              <CommandGroup>
                {PHONE_COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.code}
                    keywords={[country.name, country.dialCode, `+${country.dialCode}`]}
                    onSelect={() => {
                      handleCountryChange(country.code);
                      setCountryOpen(false);
                    }}
                  >
                    <span>{country.flag}</span>
                    {country.name} (+{country.dialCode})
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        selected.code === country.code ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
