'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LIBRARY_ROUTE_PREFIXES,
  UNIFIED_SHELL_PATHS,
  hrefForShellRoute,
  isAssistantsPath,
  isLibraryPath,
  isSettingsFamilyPath,
} from '@/lib/navigation/appShellRoutes';
import type { ShellRouteDescriptor } from '@/lib/navigation/shellRoutes';

interface AppShellNavigationContextValue {
  pendingTargetHref: string | null;
  setPendingTargetHref: (href: string | null) => void;
  pendingAssistantSectionId: string | null;
  setPendingAssistantSectionId: (sectionId: string | null) => void;
}

const AppShellNavigationContext = React.createContext<AppShellNavigationContextValue | null>(null);

/** Strip the query/hash from an href, leaving the pathname. */
export function pathnameFromHref(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

export function AppShellNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/assistants';
  const [pendingTargetHref, setPendingTargetHref] = React.useState<string | null>(null);
  const [pendingAssistantSectionId, setPendingAssistantSectionId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (!pendingTargetHref) return;

    const pendingPathname = pathnameFromHref(pendingTargetHref);
    if (
      pathname === pendingPathname ||
      (!isAssistantsPath(pendingPathname) && !isAssistantsPath(pathname))
    ) {
      setPendingTargetHref(null);
    }
  }, [pathname, pendingTargetHref]);

  const value = React.useMemo(
    () => ({
      pendingTargetHref,
      setPendingTargetHref,
      pendingAssistantSectionId,
      setPendingAssistantSectionId,
    }),
    [pendingAssistantSectionId, pendingTargetHref]
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

export function usePendingAssistantSectionTarget(): {
  pendingAssistantSectionId: string | null;
  clearPendingAssistantSection: () => void;
} {
  const navigationContext = React.useContext(AppShellNavigationContext);
  const clearPendingAssistantSection = React.useCallback(() => {
    navigationContext?.setPendingAssistantSectionId(null);
  }, [navigationContext]);

  return {
    pendingAssistantSectionId: navigationContext?.pendingAssistantSectionId ?? null,
    clearPendingAssistantSection,
  };
}

/**
 * Navigation for the authenticated app shell.
 *
 * Unified shell surfaces use native Next.js navigation against one catch-all
 * page owner. Same-path query changes can use the browser History API because
 * they do not swap surfaces.
 */
export function useAppShellNavigation() {
  const router = useRouter();
  const pathname = usePathname() ?? '/assistants';
  const navigationContext = React.useContext(AppShellNavigationContext);

  const navigateTo = React.useCallback(
    (target: string | ShellRouteDescriptor) => {
      const href = typeof target === 'string' ? target : hrefForShellRoute(target);
      const targetPathname = pathnameFromHref(href);
      const isCrossSurfaceNavigation =
        targetPathname !== pathname &&
        (isAssistantsPath(targetPathname) ||
          isAssistantsPath(pathname) ||
          isSettingsFamilyPath(targetPathname) ||
          isSettingsFamilyPath(pathname) ||
          isLibraryPath(targetPathname) ||
          isLibraryPath(pathname));

      if (isAssistantsPath(targetPathname)) {
        navigationContext?.setPendingTargetHref(isCrossSurfaceNavigation ? href : null);
        router.push(href);
        return;
      }

      if (isCrossSurfaceNavigation) {
        navigationContext?.setPendingTargetHref(href);
      } else {
        navigationContext?.setPendingTargetHref(null);
      }

      router.push(href);
    },
    [navigationContext, pathname, router]
  );

  const navigateToAssistants = React.useCallback(
    (options?: { sectionId?: string | null; profile?: string | null }) => {
      navigationContext?.setPendingAssistantSectionId(options?.sectionId ?? null);
      navigateTo({ surface: 'assistants', profile: options?.profile ?? null });
    },
    [navigateTo, navigationContext]
  );

  const pushShellQuery = React.useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    const targetPathname = pathnameFromHref(href);
    if (targetPathname !== window.location.pathname) {
      throw new Error('pushShellQuery only supports same-path query updates');
    }
    window.history.pushState(null, '', href);
  }, []);

  return {
    activeHref: pathname,
    showAssistants: isAssistantsPath(pathname),
    showSettings: isSettingsFamilyPath(pathname),
    showRoutedSurface: isSettingsFamilyPath(pathname) || isLibraryPath(pathname),
    assistantsSurfaceActive: isAssistantsPath(pathname),
    navigateToAssistants,
    navigateTo,
    pushShellQuery,
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
    for (const prefix of [...UNIFIED_SHELL_PATHS, ...LIBRARY_ROUTE_PREFIXES]) {
      router.prefetch(prefix);
    }
  }, [router]);
}
