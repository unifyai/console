/**
 * Country-aware billing-address rules.
 *
 * Stripe is the authoritative validator (the billing-profile save probes
 * Stripe Tax with ``tax.validate_location='immediately'``), but these rules
 * give instant client-side feedback and — importantly — stop us from
 * *requiring* fields a country doesn't use (e.g. a postal code in the UAE),
 * which would otherwise block an address Stripe is perfectly happy with.
 */

/**
 * ISO 3166-1 alpha-2 codes for territories that don't use postal codes. Stripe
 * resolves tax for these from the country alone, so we must not require one.
 * Sourced from the UPU / Stripe "no postal code" list.
 */
export const NO_POSTAL_CODE_COUNTRIES = new Set<string>([
  'AE',
  'AG',
  'AO',
  'AW',
  'BF',
  'BI',
  'BJ',
  'BS',
  'BW',
  'BZ',
  'CD',
  'CF',
  'CG',
  'CI',
  'CK',
  'CM',
  'DJ',
  'DM',
  'ER',
  'FJ',
  'GA',
  'GD',
  'GH',
  'GM',
  'GN',
  'GQ',
  'GY',
  'HK',
  'KI',
  'KM',
  'KP',
  'LY',
  'ML',
  'MO',
  'MR',
  'MW',
  'NR',
  'NU',
  'PA',
  'QA',
  'RW',
  'SB',
  'SC',
  'SL',
  'SO',
  'SR',
  'ST',
  'SY',
  'TF',
  'TL',
  'TK',
  'TO',
  'TV',
  'TZ',
  'UG',
  'VU',
  'YE',
  'ZW',
]);

/**
 * Countries where Stripe Tax needs a state/province to resolve a jurisdiction.
 * (Country-level VAT resolves from the country alone; US/CA need the region.)
 */
export const STATE_REQUIRED_COUNTRIES = new Set<string>(['US', 'CA']);

/**
 * Postal-code format rules for the countries we can usefully check client-side.
 * Anything not listed is accepted as-is and left to Stripe to judge.
 */
const POSTAL_FORMATS: Record<string, { regex: RegExp; example: string }> = {
  // 5 digits, optionally +4 (e.g. 94080 or 94080-1234).
  US: { regex: /^\d{5}(-\d{4})?$/, example: '94080' },
  // ANA NAN, case-insensitive, optional space (e.g. K1A 0B1).
  CA: { regex: /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, example: 'K1A 0B1' },
  // UK postcodes (e.g. SW1A 1AA, M1 1AE, EC1A 1BB).
  GB: {
    regex: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
    example: 'SW1A 1AA',
  },
};

const norm = (country?: string | null): string => (country ?? '').trim().toUpperCase();

/** Whether a postal code is required for the given country. */
export function isPostalCodeRequired(country?: string | null): boolean {
  const c = norm(country);
  if (!c) return false;
  return !NO_POSTAL_CODE_COUNTRIES.has(c);
}

/** Whether a state/province is required for the given country. */
export function isStateRequired(country?: string | null): boolean {
  return STATE_REQUIRED_COUNTRIES.has(norm(country));
}

/**
 * Validate a postal code against the country's format, when we have one.
 * Returns true when there's no format rule (let Stripe decide) or it matches.
 */
export function isPostalCodeValid(country: string | null | undefined, postal: string): boolean {
  const rule = POSTAL_FORMATS[norm(country)];
  if (!rule) return true;
  return rule.regex.test(postal.trim());
}

/** Example postal code for the country, used in placeholders. */
export function postalCodeExample(country?: string | null): string | null {
  return POSTAL_FORMATS[norm(country)]?.example ?? null;
}

/**
 * Whether the address has everything Stripe needs to resolve a tax location:
 * line1, city, country, a postal code (when the country uses one), and a
 * state (when the country requires one).
 */
export function hasCompleteTaxAddress(address?: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): boolean {
  if (!address) return false;
  const has = (v?: string | null) => Boolean(v && v.trim());
  if (!has(address.line1) || !has(address.city) || !has(address.country)) return false;
  if (isPostalCodeRequired(address.country) && !has(address.postalCode)) return false;
  if (isStateRequired(address.country) && !has(address.state)) return false;
  return true;
}
