const PREFERRED_BACKEND_ORDER = ['composio', 'pipedream'] as const;

const STRIP_SUFFIXES = ['_oauth', '_api', '_connect', '_integration', '_integrations', '_app'];

/* eslint-disable @typescript-eslint/naming-convention */
const EXPLICIT_SLUG_ALIASES: Record<string, string> = {
  microsoft_outlook: 'outlook',
  microsoft_outlook_calendar: 'outlook',
  microsoft_excel: 'excel',
  microsoft_onedrive: 'onedrive',
  microsoft_365: 'office_365',
  microsoft_365_people: 'office_365',
  microsoft_365_planner: 'office_365',
  google_calendar: 'googlecalendar',
  google_sheets: 'googlesheets',
  google_drive: 'googledrive',
  google_docs: 'googledocs',
  google_meet: 'googlemeet',
  google_forms: 'googleforms',
  google_contacts: 'googlecontacts',
  google_slides: 'googleslides',
  google_tasks: 'googletasks',
  google_chat: 'googlechat',
  airtable_oauth: 'airtable',
  databricks_oauth: 'databricks',
  gorgias_oauth: 'gorgias',
  highlevel_oauth: 'highlevel',
  sendfox_oauth: 'sendfox',
  snowflake_oauth: 'snowflake',
  apify_oauth: 'apify',
};
/* eslint-enable @typescript-eslint/naming-convention */

type CatalogAppLike = {
  canonicalAppSlug?: string;
  displayName?: string | null;
  providerAppId?: string;
  backendId?: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function normalizeDisplayName(value: string | null | undefined): string {
  let text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  for (const suffix of [' oauth', ' api', ' integration']) {
    if (text.endsWith(suffix)) text = text.slice(0, -suffix.length).trim();
  }
  return text;
}

export function logicalAppKey(app: CatalogAppLike): string {
  const preferred = slugify(String(app.canonicalAppSlug || ''));
  if (EXPLICIT_SLUG_ALIASES[preferred]) return EXPLICIT_SLUG_ALIASES[preferred];
  if (preferred.startsWith('microsoft_')) return preferred.slice('microsoft_'.length);
  for (const suffix of STRIP_SUFFIXES) {
    if (preferred.endsWith(suffix)) return preferred.slice(0, -suffix.length);
  }
  const displayKey = slugify(normalizeDisplayName(app.displayName));
  if (displayKey) {
    if (EXPLICIT_SLUG_ALIASES[displayKey]) return EXPLICIT_SLUG_ALIASES[displayKey];
    return displayKey;
  }
  return preferred;
}

function backendPreferenceRank(backendId: string): number {
  const index = PREFERRED_BACKEND_ORDER.indexOf(
    backendId as (typeof PREFERRED_BACKEND_ORDER)[number]
  );
  return index === -1 ? PREFERRED_BACKEND_ORDER.length : index;
}

export function resolvePublicCatalogApps<T extends CatalogAppLike>(apps: T[]): T[] {
  const grouped = new Map<string, T[]>();
  for (const app of apps) {
    const key = logicalAppKey(app);
    grouped.set(key, [...(grouped.get(key) ?? []), app]);
  }
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([, rows]) =>
        [...rows].sort(
          (left, right) =>
            backendPreferenceRank(String(left.backendId || 'provider')) -
              backendPreferenceRank(String(right.backendId || 'provider')) ||
            String(left.displayName || left.canonicalAppSlug || '').localeCompare(
              String(right.displayName || right.canonicalAppSlug || '')
            )
        )[0]
    );
}
