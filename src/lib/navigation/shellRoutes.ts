import type { SettingsAccountId } from './settingsAccountTab';

export type UnifiedShellSurface =
  | 'assistants'
  | 'account'
  | 'billing'
  | 'usage'
  | 'organizations'
  | 'admin';

export type LibrarySurface = 'interfaces' | 'favourites';

export type ShellSurface = UnifiedShellSurface | LibrarySurface;

export type AdminPanelId = 'home' | 'organizations' | 'plans' | 'invoices' | 'links';

export type SettingsPanelId =
  | 'account'
  | 'billing'
  | 'usage'
  | 'organizations'
  | `admin:${AdminPanelId}`;

export type ShellMountTier = 'runtime' | 'hot' | 'warm' | 'cold' | 'server';

export type ShellRouteDescriptor =
  | { surface: 'assistants'; profile?: string | null }
  | { surface: 'account'; tab?: SettingsAccountId }
  | { surface: 'billing' }
  | { surface: 'usage'; assistantId?: string | null }
  | { surface: 'organizations' }
  | { surface: 'admin'; panel?: AdminPanelId }
  | { surface: 'interfaces' }
  | { surface: 'favourites' };

export interface ShellRouteDefinition {
  surface: ShellSurface;
  panelId: SettingsPanelId | null;
  path: string;
  mountTier: ShellMountTier;
  requiresBilling?: boolean;
  requiresNonSelfHost?: boolean;
  requiresUnifyAdmin?: boolean;
}

export const UNIFIED_SHELL_ROUTE_DEFINITIONS: readonly ShellRouteDefinition[] = [
  { surface: 'assistants', panelId: null, path: '/assistants', mountTier: 'runtime' },
  { surface: 'account', panelId: 'account', path: '/account', mountTier: 'hot' },
  {
    surface: 'billing',
    panelId: 'billing',
    path: '/billing',
    mountTier: 'hot',
    requiresBilling: true,
  },
  { surface: 'usage', panelId: 'usage', path: '/usage', mountTier: 'hot', requiresBilling: true },
  {
    surface: 'organizations',
    panelId: 'organizations',
    path: '/organizations',
    mountTier: 'warm',
    requiresNonSelfHost: true,
  },
  {
    surface: 'admin',
    panelId: 'admin:home',
    path: '/admin',
    mountTier: 'cold',
    requiresUnifyAdmin: true,
  },
  {
    surface: 'admin',
    panelId: 'admin:organizations',
    path: '/admin/organizations',
    mountTier: 'cold',
    requiresUnifyAdmin: true,
  },
  {
    surface: 'admin',
    panelId: 'admin:plans',
    path: '/admin/plans',
    mountTier: 'cold',
    requiresUnifyAdmin: true,
  },
  {
    surface: 'admin',
    panelId: 'admin:invoices',
    path: '/admin/invoices',
    mountTier: 'cold',
    requiresUnifyAdmin: true,
  },
  {
    surface: 'admin',
    panelId: 'admin:links',
    path: '/admin/links',
    mountTier: 'cold',
    requiresUnifyAdmin: true,
  },
] as const;

export const LIBRARY_ROUTE_DEFINITIONS: readonly ShellRouteDefinition[] = [
  { surface: 'interfaces', panelId: null, path: '/interfaces', mountTier: 'server' },
  { surface: 'favourites', panelId: null, path: '/favourites', mountTier: 'server' },
] as const;

export const SETTINGS_ROUTE_PREFIXES = [
  '/account',
  '/billing',
  '/usage',
  '/organizations',
  '/admin',
] as const;

export const LIBRARY_ROUTE_PREFIXES = ['/interfaces', '/favourites'] as const;

export const UNIFIED_SHELL_PATHS = UNIFIED_SHELL_ROUTE_DEFINITIONS.map((route) => route.path);

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/assistants';
  const bare = pathname.split(/[?#]/)[0] || '/assistants';
  return bare !== '/' && bare.endsWith('/') ? bare.slice(0, -1) : bare;
}

function isPrefixMatch(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function pathnameFromShellHref(href: string): string {
  return normalizePathname(href);
}

export function isAssistantsPath(pathname: string | null | undefined): boolean {
  return isPrefixMatch(normalizePathname(pathname), '/assistants');
}

export function isSettingsFamilyPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  return resolveSettingsPanel(normalized) !== null;
}

export function isAdminPath(pathname: string | null | undefined): boolean {
  return isPrefixMatch(normalizePathname(pathname), '/admin');
}

export function isLibraryPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  return LIBRARY_ROUTE_PREFIXES.some((prefix) => isPrefixMatch(normalized, prefix));
}

export function isUnifiedShellPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/assistants' || resolveSettingsPanel(normalized) !== null;
}

export function isRoutedShellPath(pathname: string | null | undefined): boolean {
  return isSettingsFamilyPath(pathname) || isLibraryPath(pathname);
}

export function isPersistentMainShellPath(pathname: string | null | undefined): boolean {
  return isUnifiedShellPath(pathname) || isLibraryPath(pathname);
}

/** Routes where the top-nav assistant info / onboarding shortcuts can drive the panel. */
export function isAssistantInfoPanelShortcutPath(pathname: string | null | undefined): boolean {
  return isPersistentMainShellPath(pathname);
}

export function resolveSettingsPanel(pathname: string | null | undefined): SettingsPanelId | null {
  const normalized = normalizePathname(pathname);
  if (normalized === '/account') return 'account';
  if (normalized === '/billing') return 'billing';
  if (normalized === '/usage') return 'usage';
  if (normalized === '/organizations') return 'organizations';
  if (normalized === '/admin') return 'admin:home';
  if (normalized === '/admin/organizations') return 'admin:organizations';
  if (normalized === '/admin/plans') return 'admin:plans';
  if (normalized === '/admin/invoices') return 'admin:invoices';
  if (normalized === '/admin/links') return 'admin:links';
  return null;
}

export function resolveUnifiedRoute(
  pathname: string | null | undefined
): ShellRouteDefinition | null {
  const normalized = normalizePathname(pathname);
  return UNIFIED_SHELL_ROUTE_DEFINITIONS.find((route) => route.path === normalized) ?? null;
}

export function hrefForShellRoute(descriptor: ShellRouteDescriptor): string {
  const params = new URLSearchParams();
  switch (descriptor.surface) {
    case 'assistants':
      if (descriptor.profile) params.set('profile', descriptor.profile);
      return params.size > 0 ? `/assistants?${params.toString()}` : '/assistants';
    case 'account':
      if (descriptor.tab && descriptor.tab !== 'profile') params.set('tab', descriptor.tab);
      return params.size > 0 ? `/account?${params.toString()}` : '/account';
    case 'usage':
      if (descriptor.assistantId) params.set('assistant', descriptor.assistantId);
      return params.size > 0 ? `/usage?${params.toString()}` : '/usage';
    case 'admin': {
      const panel = descriptor.panel ?? 'home';
      return panel === 'home' ? '/admin' : `/admin/${panel}`;
    }
    default:
      return `/${descriptor.surface}`;
  }
}
