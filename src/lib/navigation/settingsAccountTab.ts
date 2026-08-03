/**
 * Account sub-rail vocabulary and `?tab=` URL handling.
 *
 * The tab ids and labels live here rather than beside the rail component so
 * server code (route handlers, prompt/guidance builders) can read them without
 * pulling in a client module.
 */

/** Account sub-rail entries, in rail order. Icons are attached by the rail. */
export const SETTINGS_ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'contact-info', label: 'Contact info' },
  { id: 'security', label: 'Security' },
] as const;

export type SettingsAccountId = (typeof SETTINGS_ACCOUNT_TABS)[number]['id'];

export const SETTINGS_ACCOUNT_IDS = SETTINGS_ACCOUNT_TABS.map((t) => t.id) as readonly string[];

/** Legacy account tabs merged into profile/security — redirect on load. */
export const LEGACY_ACCOUNT_TAB_REDIRECTS: Readonly<Record<string, SettingsAccountId>> = {
  preferences: 'profile',
  advanced: 'security',
};

export function parseAccountTab(tabParam: string | null | undefined): SettingsAccountId {
  if (!tabParam) return 'profile';
  const legacy = LEGACY_ACCOUNT_TAB_REDIRECTS[tabParam];
  if (legacy) return legacy;
  if (SETTINGS_ACCOUNT_IDS.includes(tabParam)) return tabParam as SettingsAccountId;
  return 'profile';
}

export function accountTabQuery(tab: SettingsAccountId): string {
  return tab === 'profile' ? '' : `?tab=${tab}`;
}

export function accountTabHref(tab: SettingsAccountId): string {
  return `/account${accountTabQuery(tab)}`;
}

/** Sync the account tab into the URL without triggering a Next.js navigation. */
export function writeAccountTabToHistory(tab: SettingsAccountId): void {
  if (typeof window === 'undefined') return;
  const query = accountTabQuery(tab);
  const newUrl = `${window.location.pathname}${query}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', newUrl);
}

export function readAccountTabFromLocation(): SettingsAccountId {
  if (typeof window === 'undefined') return 'profile';
  const params = new URLSearchParams(window.location.search);
  return parseAccountTab(params.get('tab'));
}
