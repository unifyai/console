/** Settings-family routes hosted beside the persistent assistants surface. */
export const SETTINGS_ROUTE_PREFIXES = [
  '/account',
  '/billing',
  '/usage',
  '/organizations',
  '/admin',
] as const;

/** Rail-hosted library routes (interfaces, favourites). */
export const LIBRARY_ROUTE_PREFIXES = ['/interfaces', '/favourites'] as const;

/** All non-assistants routes managed inside the app shell layout. */
export const ROUTED_SHELL_PREFIXES = [
  ...SETTINGS_ROUTE_PREFIXES,
  ...LIBRARY_ROUTE_PREFIXES,
] as const;

export function isAssistantsPath(pathname: string | null): boolean {
  return pathname === '/assistants' || (pathname?.startsWith('/assistants/') ?? false);
}

export function isSettingsFamilyPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return SETTINGS_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isLibraryPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return LIBRARY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Any app-shell route that renders Next.js `children` instead of assistants `Main`. */
export function isRoutedShellPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ROUTED_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Routes where the app-shell layout keeps assistants `Main` mounted (shown or hidden). */
export function isPersistentMainShellPath(pathname: string | null): boolean {
  return isAssistantsPath(pathname) || isRoutedShellPath(pathname);
}

/** Routes where the top-nav assistant info / onboarding shortcuts can drive the panel. */
export function isAssistantInfoPanelShortcutPath(pathname: string | null): boolean {
  return isPersistentMainShellPath(pathname);
}
