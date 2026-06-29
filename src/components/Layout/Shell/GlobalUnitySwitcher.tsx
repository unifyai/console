'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { fetchAssistants } from '@/lib/client/assistant';
import { resolveCanonicalWorkspaceCoordinator } from '@/lib/assistants/coordinatorIdentity';
import { getCurrentUser } from '@/lib/user/user';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import type { Assistant } from '@/types/assistants/assistant';

interface GlobalUnitySwitcherProps {
  collapsed: boolean;
}

/**
 * A read-only unity switcher for non-assistant home routes: it surfaces the
 * workspace coordinator and routes to `/assistants` (where the full switcher
 * lives) on click, so the rail reads consistently everywhere without pulling
 * the heavy assistants data layer into every route.
 */
export function GlobalUnitySwitcher({ collapsed }: GlobalUnitySwitcherProps) {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [coordinator, setCoordinator] = React.useState<Assistant | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const scope = {
        type:
          activeWorkspace?.type === 'organization'
            ? ('organization' as const)
            : ('personal' as const),
        organizationId:
          activeWorkspace?.type === 'organization' ? Number(activeWorkspace.id) : null,
      };
      const user = await getCurrentUser();
      const result = await fetchAssistants(scope, true, { currentUserId: user?.id });
      if (cancelled || !Array.isArray(result)) return;
      setCoordinator(resolveCanonicalWorkspaceCoordinator(result, user?.id, scope));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id, activeWorkspace?.type]);

  const name = coordinator ? assistantDisplayName(coordinator) : 'Your digital twins';

  return (
    <button
      type="button"
      data-testid="rail-unity-switcher"
      title={collapsed ? name : undefined}
      onClick={() => router.push('/assistants')}
      className={cn(
        'flex items-center gap-3 transition-colors',
        collapsed
          ? 'mx-auto mb-2 rounded-xl p-1.5 hover:bg-muted'
          : 'hover:bg-muted/80 mx-3.5 mb-2 rounded-xl border border-border bg-muted px-3 py-2'
      )}
    >
      <CoordinatorLogoAvatar
        className={cn('shrink-0', collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]')}
      />
      {!collapsed && (
        <>
          <div className="min-w-0 text-left">
            <div className="truncate font-display text-[14.5px] font-semibold">{name}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Open workspace</div>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  );
}
