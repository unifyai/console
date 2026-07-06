'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SettingsShell } from './SettingsShell';
import { SettingsNavigationProvider } from './SettingsNavigationContext';
import type { ShellSectionId } from './shellSections';
import { SettingsWorkspaceHost } from './SettingsWorkspaceHost';
import { isSettingsFamilyPath } from '@/lib/navigation/appShellRoutes';

function sectionIdForPath(pathname: string): ShellSectionId {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/organizations' || pathname.startsWith('/organizations/')) {
    return 'organizations';
  }
  if (pathname === '/usage' || pathname.startsWith('/usage/')) return 'usage';
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return 'billing';
  return 'settings';
}

function fillForPath(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  return (
    pathname === '/organizations' || pathname.startsWith('/organizations/') || pathname === '/usage'
  );
}

/**
 * Persistent settings-family chrome shared by `/account`, `/organizations`,
 * `/usage`, `/billing`, and `/admin/*`. Mounted once by the app shell for the
 * settings-family routes, so cross-section navigation only swaps the content
 * column (the sub-rail and header stay put).
 */
export function SettingsRouteShell({
  pathnameOverride = null,
}: {
  pathnameOverride?: string | null;
}) {
  const livePathname = usePathname() ?? '/account';
  const lastSettingsPathnameRef = React.useRef('/account');
  const liveSettingsPathname = isSettingsFamilyPath(livePathname) ? livePathname : null;
  const pathname = pathnameOverride ?? liveSettingsPathname ?? lastSettingsPathnameRef.current;
  React.useEffect(() => {
    if (isSettingsFamilyPath(pathname)) {
      lastSettingsPathnameRef.current = pathname;
    }
  }, [pathname]);
  const sectionId = sectionIdForPath(pathname);
  const fill = fillForPath(pathname);

  return (
    <SettingsNavigationProvider>
      <SettingsShell sectionId={sectionId} fill={fill}>
        <SettingsWorkspaceHost pathnameOverride={pathname} />
      </SettingsShell>
    </SettingsNavigationProvider>
  );
}
