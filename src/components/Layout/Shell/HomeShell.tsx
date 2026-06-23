'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AppRail, RAIL_COLLAPSED_STORAGE_KEY } from './AppRail';
import { GlobalDroidSwitcher } from './GlobalDroidSwitcher';

interface HomeShellProps {
  children: React.ReactNode;
}

/**
 * The global home shell for non-assistant routes: renders the shared `AppRail`
 * (with a read-only droid switcher) beside the route body, so the rail persists
 * across the app. Workspace/Brain sections route to `/assistants`; the rail foot
 * owns Settings/Admin/account navigation.
 */
export function HomeShell({ children }: HomeShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY);
    if (stored != null) setCollapsed(stored === '1');
  }, []);

  const handleCollapsedChange = React.useCallback((next: boolean) => {
    setCollapsed(next);
    window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
      <AppRail
        switcher={<GlobalDroidSwitcher collapsed={collapsed} />}
        activeSection={null}
        onSelectSection={() => router.push('/assistants')}
        collapsed={collapsed}
        onCollapsedChange={handleCollapsedChange}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </div>
    </div>
  );
}
