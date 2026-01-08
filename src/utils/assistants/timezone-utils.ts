export interface TimezoneOption {
  value: string; // IANA name e.g. "America/New_York"
  label: string; // e.g. "(UTC-04:00) New York"
  offset: number; // offset from UTC in minutes
}

// Cached options to avoid re-computation
let timezoneOptionsCache: TimezoneOption[] | null = null;

/**
 * Gets the UTC offset in minutes for a given IANA timezone.
 * This is a simplified way to get an offset, but it can be inaccurate
 * due to how `toLocaleString` and `Date` parsing work. For display
 * purposes, it's generally sufficient.
 * @param timeZone The IANA timezone string.
 * @returns The timezone offset in minutes from UTC.
 */
export function getTimezoneOffsetInMinutes(timeZone: string): number {
  const now = new Date();
  // Format the date to parts to reliably get the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    timeZoneName: 'longOffset',
    hour: 'numeric', // required to get timezone info
  });

  const parts = formatter.formatToParts(now);
  const gmtPart = parts.find((part) => part.type === 'timeZoneName');

  if (!gmtPart) return 0;

  // e.g., "GMT-4", "GMT+5:30"
  const offsetString = gmtPart.value.replace('GMT', '');
  const [hours, minutes] = offsetString.split(':').map(Number);

  // The sign is part of the hours, so we handle it correctly
  const totalMinutes = Math.abs(hours) * 60 + (minutes || 0);

  return hours < 0 ? -totalMinutes : totalMinutes;
}

/**
 * Formats an offset in minutes to a string like "+05:30".
 * @param offset The offset in minutes.
 * @returns A formatted string.
 */
export function formatOffset(offset: number): string {
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Generates a sorted list of timezone options for a dropdown.
 * The result is cached for performance.
 * @returns An array of `TimezoneOption` objects.
 */
export function generateTimezoneOptions(): TimezoneOption[] {
  if (timezoneOptionsCache) {
    return timezoneOptionsCache;
  }

  try {
    const timezones = Intl.supportedValuesOf('timeZone');

    const options = timezones
      .filter((tz) => !tz.startsWith('Etc/') && tz.includes('/')) // Filter out generic Etc timezones and non-city timezones
      .map((tz) => {
        const offset = getTimezoneOffsetInMinutes(tz);
        const label = `(UTC${formatOffset(offset)}) ${tz.split('/').pop()?.replace(/_/g, ' ')}`;
        return { value: tz, label, offset };
      });

    // Sort by offset, then by label
    options.sort((a, b) => {
      if (a.offset !== b.offset) {
        return a.offset - b.offset;
      }
      return a.label.localeCompare(b.label);
    });

    timezoneOptionsCache = options;
    return options;
  } catch (e) {
    // Fallback for environments where Intl.supportedValuesOf is not available
    console.warn(
      "Intl.supportedValuesOf('timeZone') is not supported. Using a limited timezone list."
    );
    return [
      { value: 'UTC', label: '(UTC+00:00) Coordinated Universal Time', offset: 0 },
      { value: 'America/New_York', label: '(UTC-04:00) New York', offset: -240 },
      { value: 'Europe/London', label: '(UTC+01:00) London', offset: 60 },
    ];
  }
}
