'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  isAssistantsPath,
  isSettingsFamilyPath,
  isRoutedShellPath,
  SETTINGS_ROUTE_PREFIXES,
} from '@/lib/navigation/appShellRoutes';

interface AppShellNavigationContextValue {
  pendingTargetHref: string | null;
  setPendingTargetHref: (href: string | null) => void;
}

const AppShellNavigationContext = React.createContext<AppShellNavigationContextValue | null>(null);

/** Strip the query/hash from an href, leaving the pathname. */
export function pathnameFromHref(href: string): string {
  return href.split('?')[0] ?? href;
}

export function AppShellNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/assistants';
  const [pendingTargetHref, setPendingTargetHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pendingTargetHref) return;

    const pendingPathname = pathnameFromHref(pendingTargetHref);
    if (pathname === pendingPathname || !isAssistantsPath(pathname)) {
      setPendingTargetHref(null);
    }
  }, [pathname, pendingTargetHref]);

  const value = React.useMemo(
    () => ({ pendingTargetHref, setPendingTargetHref }),
    [pendingTargetHref]
  );

  return (
    <AppShellNavigationContext.Provider value={value}>
      {children}
    </AppShellNavigationContext.Provider>
  );
}

export function usePendingShellNavigationTarget(): string | null {
  return React.useContext(AppShellNavigationContext)?.pendingTargetHref ?? null;
}

/**
 * Navigation for the authenticated app shell.
 *
 * Settings, admin, interfaces, and favourites render through their own route
 * segments via native Next.js navigation, so they keep their `loading.tsx`
 * skeletons and the browser's back/forward semantics.
 *
 * The assistants surface is different: its runtime (`Main`) is mounted once by
 * the shell layout and only ever hidden, so SSE, live calls, and action streams
 * survive. When the user is already inside the shell on a routed surface,
 * returning to `/assistants` can reveal that existing runtime without a server
 * round-trip.
 */
export function useAppShellNavigation() {
  const router = useRouter();
  const pathname = usePathname() ?? '/assistants';
  const navigationContext = React.useContext(AppShellNavigationContext);

  const navigateTo = React.useCallback(
    (href: string) => {
      if (isAssistantsPath(href)) {
        navigationContext?.setPendingTargetHref(null);
        if (typeof window !== 'undefined' && isRoutedShellPath(pathname)) {
          window.history.pushState(null, '', href);
          return;
        }
        router.push(href);
        return;
      }

      if (isAssistantsPath(pathname) && isRoutedShellPath(href)) {
        navigationContext?.setPendingTargetHref(href);
      } else {
        navigationContext?.setPendingTargetHref(null);
      }

      router.push(href);
    },
    [navigationContext, pathname, router]
  );

  const navigateToAssistants = React.useCallback(() => {
    navigationContext?.setPendingTargetHref(null);
    if (typeof window !== 'undefined' && isRoutedShellPath(pathname)) {
      window.history.pushState(null, '', '/assistants');
      return;
    }
    router.push('/assistants');
  }, [navigationContext, pathname, router]);

  return {
    activeHref: pathname,
    showAssistants: isAssistantsPath(pathname),
    showSettings: isSettingsFamilyPath(pathname),
    showRoutedSurface: isRoutedShellPath(pathname),
    assistantsSurfaceActive: isAssistantsPath(pathname),
    navigateToAssistants,
    navigateTo,
  };
}

/** The active shell pathname (native Next pathname). */
export function useShellActivePath(): string {
  return usePathname() ?? '/assistants';
}

/**
 * Prefetches the sibling shell routes so cross-surface hops resolve from the
 * client Router Cache instead of a cold server round-trip.
 */
export function useAppShellPrefetch(): void {
  const router = useRouter();
  React.useEffect(() => {
    router.prefetch('/assistants');
    for (const prefix of SETTINGS_ROUTE_PREFIXES) {
      router.prefetch(prefix);
    }
  }, [router]);
}
