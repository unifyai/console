'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Main from '@/components/Pages/Assistants/Main';
import { SettingsRouteShell } from './SettingsRouteShell';
import { HomeShell } from './HomeShell';
import { assistantMainActions } from '@/lib/assistants/mainActions';
import { loadAssistantsMainUserMeta } from '@/lib/assistants/mainUserMeta';
import type { AssistantsMainUserMeta } from '@/types/assistants/main';
import { subscribeMsTeamsBotBound } from '@/lib/ms-teams-bot/bindEvents';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/Common/Loader';
import {
  pathnameFromHref,
  useAppShellPrefetch,
  usePendingShellNavigationTarget,
} from '@/lib/navigation/AppShellRouter';
import {
  isAssistantsPath,
  isLibraryPath,
  isSettingsFamilyPath,
} from '@/lib/navigation/appShellRoutes';
import {
  AssistantSectionSkeleton,
  SectionBodySkeleton,
} from '@/components/Common/Loaders/Skeletons';
import { Skeleton } from '@/components/UI/skeleton';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import {
  DEFAULT_SECTION_ID,
  SECTION_BY_ID,
} from '@/components/Pages/Assistants/Rail/sectionConfig';
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';
import { TrialGateOverlay } from './TrialGateOverlay';

interface AppShellProps {
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

function AssistantsSurfaceSkeleton() {
  const section = SECTION_BY_ID[DEFAULT_SECTION_ID];

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-background">
      <aside className="hidden h-full w-[258px] shrink-0 flex-col border-r border-border bg-background lg:flex">
        <div className="px-[18px] pb-3.5 pt-[18px]">
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="mx-3.5 mb-2 rounded-xl border border-border bg-muted px-3 py-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="px-2.5 pb-2">
          <Skeleton className="mx-3 mb-2 mt-3 h-3 w-20" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`workspace-${index}`} className="mb-1.5 h-9 rounded-lg" />
          ))}
          <Skeleton className="mx-3 mb-2 mt-4 h-3 w-14" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`brain-${index}`} className="mb-1.5 h-9 rounded-lg" />
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TabHeader section={section} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <AssistantSectionSkeleton sectionId={section.id} />
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
 * Settings/admin surfaces are selected inside the client shell so navigation
 * swaps panels without replacing the Next.js page leaf.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() ?? '/assistants';
  const [userMeta, setUserMeta] = React.useState<AssistantsMainUserMeta | null>(null);
  const [bootstrapLoaded, setBootstrapLoaded] = React.useState(false);
  const coreShellRenderedRef = React.useRef(false);
  const pendingTargetHref = usePendingShellNavigationTarget();
  const pendingPathname = pendingTargetHref ? pathnameFromHref(pendingTargetHref) : null;
  const pendingAssistantsTarget = pendingPathname ? isAssistantsPath(pendingPathname) : false;
  const pendingSettingsTarget =
    pendingTargetHref && isAssistantsPath(pathname) && isSettingsFamilyPath(pendingPathname ?? '')
      ? pendingTargetHref
      : null;
  const pendingLibraryTarget =
    pendingTargetHref && isAssistantsPath(pathname) && isLibraryPath(pendingPathname ?? '')
      ? pendingTargetHref
      : null;
  const pendingRoutedTarget = pendingSettingsTarget ?? pendingLibraryTarget;
  const showAssistants =
    (isAssistantsPath(pathname) || pendingAssistantsTarget) && !pendingRoutedTarget;
  const settingsFamily = isSettingsFamilyPath(pathname);

  useAppShellPrefetch();

  React.useEffect(() => {
    let cancelled = false;
    loadAssistantsMainUserMeta()
      .then((nextUserMeta) => {
        if (cancelled) return;
        setUserMeta(nextUserMeta);
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The deep-link auto-bind updates the install server-side after boot; re-read
  // userMeta so the seeded Teams state the shell hands down stops being stale.
  React.useEffect(() => {
    return subscribeMsTeamsBotBound(() => {
      void loadAssistantsMainUserMeta().then((nextUserMeta) => {
        setUserMeta(nextUserMeta);
      });
    });
  }, []);

  const canRenderAssistants = bootstrapLoaded && userMeta;
  const showColdAssistantsBoot =
    showAssistants && !coreShellRenderedRef.current && !canRenderAssistants;
  const showSettingsShell = Boolean(pendingSettingsTarget) || (!showAssistants && settingsFamily);
  const settingsShellPathname = pendingSettingsTarget
    ? pathnameFromHref(pendingSettingsTarget)
    : null;

  React.useEffect(() => {
    if (!showColdAssistantsBoot) {
      coreShellRenderedRef.current = true;
    }
  }, [showColdAssistantsBoot]);

  if (showColdAssistantsBoot) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader size={64} />
      </div>
    );
  }

  return (
    <HomeShell hideGlobalRail={showAssistants}>
      <TrialGateOverlay />
      {canRenderAssistants ? (
        <div
          className={cn('h-full min-h-0 w-full overflow-hidden', !showAssistants && 'hidden')}
          aria-hidden={!showAssistants}
        >
          <Main assistantActions={assistantMainActions} userMeta={userMeta} />
        </div>
      ) : showAssistants ? (
        <AssistantsSurfaceSkeleton />
      ) : null}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          !showSettingsShell && 'hidden'
        )}
        aria-hidden={!showSettingsShell}
      >
        <SettingsRouteShell pathnameOverride={settingsShellPathname} />
      </div>

      {!showSettingsShell && pendingLibraryTarget ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PendingRoutedSurface targetHref={pendingLibraryTarget} />
        </div>
      ) : !showSettingsShell && !showAssistants && !settingsFamily ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : null}
    </HomeShell>
  );
}
