'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Main from '@/components/Pages/Assistants/Main';
import { SettingsRouteShell } from './SettingsRouteShell';
import { HomeShell } from './HomeShell';
import type { AssistantsMainBootstrap } from '@/lib/assistants/assembleMainBootstrap';
import { cn } from '@/lib/utils';
import {
  pathnameFromHref,
  useAppShellPrefetch,
  usePendingShellNavigationTarget,
} from '@/lib/navigation/AppShellRouter';
import {
  isAssistantsPath,
  isRoutedShellPath,
  isSettingsFamilyPath,
} from '@/lib/navigation/appShellRoutes';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { Skeleton } from '@/components/UI/skeleton';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';

interface AppShellProps {
  bootstrap: AssistantsMainBootstrap | null;
  children: React.ReactNode;
}

function sectionIdForPendingPath(pathname: string): ShellSectionId {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/organizations' || pathname.startsWith('/organizations/')) {
    return 'organizations';
  }
  if (pathname === '/usage' || pathname.startsWith('/usage/')) return 'usage';
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return 'billing';
  if (pathname === '/favourites' || pathname.startsWith('/favourites/')) return 'favourites';
  return 'settings';
}

function PendingRoutedSurface({ targetHref }: { targetHref: string }) {
  const section = SHELL_SECTIONS[sectionIdForPendingPath(pathnameFromHref(targetHref))];

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="hidden w-[230px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-border px-2.5 py-3 lg:flex"
          aria-hidden="true"
        >
          <Skeleton className="mx-3 mt-2 h-3 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`primary-${i}`} className="h-9 rounded-lg" />
          ))}
          <Skeleton className="mx-3 mt-4 h-3 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`secondary-${i}`} className="h-9 rounded-lg" />
          ))}
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <SectionBodySkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Persistent authenticated shell. `Main` (the assistants runtime) is mounted
 * once and only ever hidden — never unmounted — so chat/action SSE, live calls,
 * and other background work keep running while the user is on settings, admin,
 * interfaces, or favourites.
 *
 * Those routed surfaces render as native Next.js route segments in the
 * `children` slot, so their `loading.tsx` skeletons and the client Router Cache
 * behave exactly as Next intends.
 */
export function AppShell({ bootstrap, children }: AppShellProps) {
  const pathname = usePathname() ?? '/assistants';
  const pendingTargetHref = usePendingShellNavigationTarget();
  const pendingRoutedTarget =
    pendingTargetHref &&
    isAssistantsPath(pathname) &&
    isRoutedShellPath(pathnameFromHref(pendingTargetHref))
      ? pendingTargetHref
      : null;
  const showAssistants = isAssistantsPath(pathname) && !pendingRoutedTarget;
  const settingsFamily = isSettingsFamilyPath(pathname);

  useAppShellPrefetch();

  return (
    <HomeShell hideGlobalRail={showAssistants}>
      {bootstrap ? (
        <div
          className={cn('h-full min-h-0 w-full overflow-hidden', !showAssistants && 'hidden')}
          aria-hidden={!showAssistants}
        >
          <Main assistantActions={bootstrap.assistantActions} userMeta={bootstrap.userMeta} />
        </div>
      ) : null}

      {pendingRoutedTarget ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PendingRoutedSurface targetHref={pendingRoutedTarget} />
        </div>
      ) : !showAssistants ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {settingsFamily ? <SettingsRouteShell>{children}</SettingsRouteShell> : children}
        </div>
      ) : null}
    </HomeShell>
  );
}
