import {
  LEGACY_ACCOUNT_TAB_REDIRECTS,
  SETTINGS_ACCOUNT_IDS,
  type SettingsAccountId,
} from '@/components/Layout/Shell/SettingsShell';

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
