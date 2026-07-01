'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Main from '@/components/Pages/Assistants/Main';
import { SettingsRouteShell } from './SettingsRouteShell';
import { HomeShell } from './HomeShell';
import type { AssistantsMainBootstrap } from '@/lib/assistants/assembleMainBootstrap';
import { cn } from '@/lib/utils';
import { useAppShellPrefetch } from '@/lib/navigation/AppShellRouter';
import { isAssistantsPath, isSettingsFamilyPath } from '@/lib/navigation/appShellRoutes';

interface AppShellProps {
  bootstrap: AssistantsMainBootstrap | null;
  children: React.ReactNode;
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
  const showAssistants = isAssistantsPath(pathname);
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

      {!showAssistants ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {settingsFamily ? <SettingsRouteShell>{children}</SettingsRouteShell> : children}
        </div>
      ) : null}
    </HomeShell>
  );
}
