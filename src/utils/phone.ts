import { getCountryFlag, getCountryName } from '@/utils/assistants/country-utils';

export interface DialCodeCountry {
  /** ISO 3166-1 alpha-2 country code (e.g. "US"). */
  code: string;
  /** International calling code without the leading "+" (e.g. "1", "44"). */
  dialCode: string;
}

/**
 * ISO country code → international calling code.
 *
 * Ordering matters for parsing: when several countries share a dialling code
 * (e.g. "+1" for the NANP), the first entry for that code is treated as the
 * canonical/default country. The selected flag does not affect the constructed
 * E.164 number, only which option is highlighted in the dropdown.
 */
const RAW_DIAL_CODES: ReadonlyArray<[string, string]> = [
  ['US', '1'],
  ['CA', '1'],
  ['GB', '44'],
  ['AF', '93'],
  ['AL', '355'],
  ['DZ', '213'],
  ['AD', '376'],
  ['AO', '244'],
  ['AR', '54'],
  ['AM', '374'],
  ['AU', '61'],
  ['AT', '43'],
  ['AZ', '994'],
  ['BH', '973'],
  ['BD', '880'],
  ['BB', '1246'],
  ['BY', '375'],
  ['BE', '32'],
  ['BZ', '501'],
  ['BJ', '229'],
  ['BT', '975'],
  ['BO', '591'],
  ['BA', '387'],
  ['BW', '267'],
  ['BR', '55'],
  ['BN', '673'],
  ['BG', '359'],
  ['BF', '226'],
  ['BI', '257'],
  ['KH', '855'],
  ['CM', '237'],
  ['CV', '238'],
  ['CF', '236'],
  ['TD', '235'],
  ['CL', '56'],
  ['CN', '86'],
  ['CO', '57'],
  ['KM', '269'],
  ['CG', '242'],
  ['CD', '243'],
  ['CR', '506'],
  ['CI', '225'],
  ['HR', '385'],
  ['CU', '53'],
  ['CY', '357'],
  ['CZ', '420'],
  ['DK', '45'],
  ['DJ', '253'],
  ['DO', '1809'],
  ['EC', '593'],
  ['EG', '20'],
  ['SV', '503'],
  ['GQ', '240'],
  ['ER', '291'],
  ['EE', '372'],
  ['ET', '251'],
  ['FJ', '679'],
  ['FI', '358'],
  ['FR', '33'],
  ['GA', '241'],
  ['GM', '220'],
  ['GE', '995'],
  ['DE', '49'],
  ['GH', '233'],
  ['GR', '30'],
  ['GT', '502'],
  ['GN', '224'],
  ['GW', '245'],
  ['GY', '592'],
  ['HT', '509'],
  ['HN', '504'],
  ['HK', '852'],
  ['HU', '36'],
  ['IS', '354'],
  ['IN', '91'],
  ['ID', '62'],
  ['IR', '98'],
  ['IQ', '964'],
  ['IE', '353'],
  ['IL', '972'],
  ['IT', '39'],
  ['JM', '1876'],
  ['JP', '81'],
  ['JO', '962'],
  ['KZ', '7'],
  ['KE', '254'],
  ['KW', '965'],
  ['KG', '996'],
  ['LA', '856'],
  ['LV', '371'],
  ['LB', '961'],
  ['LS', '266'],
  ['LR', '231'],
  ['LY', '218'],
  ['LI', '423'],
  ['LT', '370'],
  ['LU', '352'],
  ['MO', '853'],
  ['MK', '389'],
  ['MG', '261'],
  ['MW', '265'],
  ['MY', '60'],
  ['MV', '960'],
  ['ML', '223'],
  ['MT', '356'],
  ['MR', '222'],
  ['MU', '230'],
  ['MX', '52'],
  ['MD', '373'],
  ['MC', '377'],
  ['MN', '976'],
  ['ME', '382'],
  ['MA', '212'],
  ['MZ', '258'],
  ['MM', '95'],
  ['NA', '264'],
  ['NP', '977'],
  ['NL', '31'],
  ['NZ', '64'],
  ['NI', '505'],
  ['NE', '227'],
  ['NG', '234'],
  ['KP', '850'],
  ['NO', '47'],
  ['OM', '968'],
  ['PK', '92'],
  ['PA', '507'],
  ['PG', '675'],
  ['PY', '595'],
  ['PE', '51'],
  ['PH', '63'],
  ['PL', '48'],
  ['PT', '351'],
  ['PR', '1787'],
  ['QA', '974'],
  ['RO', '40'],
  ['RU', '7'],
  ['RW', '250'],
  ['SA', '966'],
  ['SN', '221'],
  ['RS', '381'],
  ['SC', '248'],
  ['SL', '232'],
  ['SG', '65'],
  ['SK', '421'],
  ['SI', '386'],
  ['SO', '252'],
  ['ZA', '27'],
  ['KR', '82'],
  ['SS', '211'],
  ['ES', '34'],
  ['LK', '94'],
  ['SD', '249'],
  ['SR', '597'],
  ['SE', '46'],
  ['CH', '41'],
  ['SY', '963'],
  ['TW', '886'],
  ['TJ', '992'],
  ['TZ', '255'],
  ['TH', '66'],
  ['TG', '228'],
  ['TO', '676'],
  ['TT', '1868'],
  ['TN', '216'],
  ['TR', '90'],
  ['TM', '993'],
  ['UG', '256'],
  ['UA', '380'],
  ['AE', '971'],
  ['UY', '598'],
  ['UZ', '998'],
  ['VE', '58'],
  ['VN', '84'],
  ['YE', '967'],
  ['ZM', '260'],
  ['ZW', '263'],
];

export interface PhoneCountryOption extends DialCodeCountry {
  name: string;
  flag: string;
}

/**
 * Full list of selectable countries, enriched with display name + flag and
 * sorted alphabetically by name. The canonical ordering for shared dial codes
 * is preserved separately for parsing.
 */
export const PHONE_COUNTRIES: PhoneCountryOption[] = RAW_DIAL_CODES.map(([code, dialCode]) => ({
  code,
  dialCode,
  name: getCountryName(code) || code,
  flag: getCountryFlag(code),
})).sort((a, b) => a.name.localeCompare(b.name));

/** Default country used when none can be inferred from the current value. */
export const DEFAULT_PHONE_COUNTRY = 'US';

/**
 * Returns the country option for an ISO code, falling back to the default.
 */
export function getPhoneCountry(code: string | undefined | null): PhoneCountryOption {
  const match = PHONE_COUNTRIES.find((c) => c.code === code);
  if (match) return match;
  return PHONE_COUNTRIES.find((c) => c.code === DEFAULT_PHONE_COUNTRY) ?? PHONE_COUNTRIES[0];
}

export interface ParsedPhoneNumber {
  /** ISO country code matched from the dial code (canonical for shared codes). */
  countryCode: string;
  /** The national (subscriber) part, digits only, with the dial code removed. */
  nationalNumber: string;
}

/**
 * Splits a full E.164-style number (e.g. "+15551234567") into the canonical
 * country and the remaining national digits. Uses longest-prefix matching so
 * that more specific dial codes win over shorter ones.
 *
 * If the value is empty or no dial code matches, `countryCode` falls back to
 * the default and the digits (minus any leading "+") are treated as national.
 */
export function parsePhoneNumber(value: string | null | undefined): ParsedPhoneNumber {
  const cleaned = (value || '').replace(/[^\d+]/g, '');

  if (!cleaned || !cleaned.startsWith('+')) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY,
      nationalNumber: cleaned.replace(/\D/g, ''),
    };
  }

  const digits = cleaned.slice(1);

  let best: DialCodeCountry | null = null;
  for (const [code, dialCode] of RAW_DIAL_CODES) {
    if (digits.startsWith(dialCode)) {
      if (!best || dialCode.length > best.dialCode.length) {
        best = { code, dialCode };
      }
    }
  }

  if (!best) {
    return { countryCode: DEFAULT_PHONE_COUNTRY, nationalNumber: digits };
  }

  return {
    countryCode: best.code,
    nationalNumber: digits.slice(best.dialCode.length),
  };
}

/**
 * Builds a full E.164 number from a country and a national number.
 *
 * Returns an empty string when there is no national part, so that an empty
 * field is treated as "no number" rather than a bare dial code (e.g. "+1").
 */
export function buildPhoneNumber(countryCode: string, nationalNumber: string): string {
  const national = (nationalNumber || '').replace(/\D/g, '');
  if (!national) return '';
  const country = getPhoneCountry(countryCode);
  return `+${country.dialCode}${national}`;
}
