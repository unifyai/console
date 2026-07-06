'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import {
  resolveSettingsPanel,
  resolveUnifiedRoute,
  UNIFIED_SHELL_ROUTE_DEFINITIONS,
  type ShellMountTier,
  type SettingsPanelId,
} from '@/lib/navigation/shellRoutes';
import { cn } from '@/lib/utils';

const panelLoading = () => null;

const AccountPanel = dynamic(() => import('./settingsPanels/AccountPanel'), {
  loading: panelLoading,
});
const BillingPanel = dynamic(() => import('./settingsPanels/BillingPanel'), {
  loading: panelLoading,
});
const UsagePanel = dynamic(() => import('./settingsPanels/UsagePanel'), { loading: panelLoading });
const OrganizationsPanel = dynamic(() => import('./settingsPanels/OrganizationsPanel'), {
  loading: panelLoading,
});
const AdminHomePanel = dynamic(() => import('./settingsPanels/AdminHomePanel'), {
  loading: panelLoading,
});
const AdminOrganizationsPanel = dynamic(() => import('./settingsPanels/AdminOrganizationsPanel'), {
  loading: panelLoading,
});
const AdminPlansPanel = dynamic(() => import('./settingsPanels/AdminPlansPanel'), {
  loading: panelLoading,
});
const AdminInvoicesPanel = dynamic(() => import('./settingsPanels/AdminInvoicesPanel'), {
  loading: panelLoading,
});
const AdminLinksPanel = dynamic(() => import('./settingsPanels/AdminLinksPanel'), {
  loading: panelLoading,
});
const AdminDemoPanel = dynamic(() => import('./settingsPanels/AdminDemoPanel'), {
  loading: panelLoading,
});

const preloadPanelById = {
  account: () => import('./settingsPanels/AccountPanel'),
  billing: () => import('./settingsPanels/BillingPanel'),
  usage: () => import('./settingsPanels/UsagePanel'),
  organizations: () => import('./settingsPanels/OrganizationsPanel'),
  'admin:home': () => import('./settingsPanels/AdminHomePanel'),
  'admin:organizations': () => import('./settingsPanels/AdminOrganizationsPanel'),
  'admin:plans': () => import('./settingsPanels/AdminPlansPanel'),
  'admin:invoices': () => import('./settingsPanels/AdminInvoicesPanel'),
  'admin:links': () => import('./settingsPanels/AdminLinksPanel'),
  'admin:demo': () => import('./settingsPanels/AdminDemoPanel'),
} satisfies Record<SettingsPanelId, () => Promise<unknown>>;

const panelComponents = new Map<SettingsPanelId, React.ComponentType>([
  ['account', AccountPanel],
  ['billing', BillingPanel],
  ['usage', UsagePanel],
  ['organizations', OrganizationsPanel],
  ['admin:home', AdminHomePanel],
  ['admin:organizations', AdminOrganizationsPanel],
  ['admin:plans', AdminPlansPanel],
  ['admin:invoices', AdminInvoicesPanel],
  ['admin:links', AdminLinksPanel],
  ['admin:demo', AdminDemoPanel],
]);

const WARM_PANEL_RETENTION_MS = 5 * 60 * 1000;

const panelMountTiers = new Map<SettingsPanelId, ShellMountTier>(
  UNIFIED_SHELL_ROUTE_DEFINITIONS.flatMap((route) =>
    route.panelId ? ([[route.panelId, route.mountTier]] as const) : []
  )
);

interface SettingsWorkspaceHostProps {
  pathnameOverride?: string | null;
}

export function SettingsWorkspaceHost({ pathnameOverride = null }: SettingsWorkspaceHostProps) {
  const livePathname = usePathname() ?? '/account';
  const pathname = pathnameOverride ?? livePathname;
  const activePanelId = resolveSettingsPanel(pathname) ?? 'account';
  const activeRoute = resolveUnifiedRoute(pathname);
  const environment = useEnvironment();
  const { isUnifyAdmin } = useWorkspace();
  const { navigateToAssistants } = useAppShellNavigation();
  const [visitedPanels, setVisitedPanels] = React.useState<Map<SettingsPanelId, number>>(
    () => new Map([[activePanelId, Date.now()]])
  );

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      Object.values(preloadPanelById).forEach((preloadPanel) => {
        void preloadPanel();
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  React.useEffect(() => {
    setVisitedPanels((prev) => {
      const now = Date.now();
      const next = new Map<SettingsPanelId, number>();
      prev.forEach((lastActiveAt, panelId) => {
        const tier = panelMountTiers.get(panelId) ?? 'cold';
        if (panelId === activePanelId || tier === 'hot') {
          next.set(panelId, panelId === activePanelId ? now : lastActiveAt);
          return;
        }
        if (tier === 'warm' && now - lastActiveAt <= WARM_PANEL_RETENTION_MS) {
          next.set(panelId, lastActiveAt);
        }
      });
      next.set(activePanelId, now);
      return next;
    });
  }, [activePanelId]);

  React.useEffect(() => {
    if (activeRoute?.requiresNonSelfHost && environment.isSelfHost) {
      navigateToAssistants();
      return;
    }
    if (activeRoute?.requiresUnifyAdmin && !isUnifyAdmin) {
      navigateToAssistants();
    }
  }, [activeRoute, environment.isSelfHost, isUnifyAdmin, navigateToAssistants]);

  const panels = React.useMemo(() => Array.from(visitedPanels.keys()), [visitedPanels]);

  return (
    <>
      {panels.map((panelId) => {
        const Panel = panelComponents.get(panelId);
        if (!Panel) return null;
        const active = panelId === activePanelId;
        return (
          <div
            key={panelId}
            className={cn('h-full min-h-0 w-full overflow-hidden', !active && 'hidden')}
            aria-hidden={!active}
          >
            <Panel />
          </div>
        );
      })}
    </>
  );
}
