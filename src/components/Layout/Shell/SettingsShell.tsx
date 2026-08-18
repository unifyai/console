'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  User as UserIcon,
  Contact,
  ShieldCheck,
  Building,
  BarChart3,
  CreditCard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import { RailNavButton } from '@/components/Pages/Assistants/Rail/RailNavButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';
import { ADMIN_NAV_ITEMS, isAdminNavActive } from './adminNav';
import { useFeatures, useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { HomeShellRailToggle } from './HomeShell';
import { useSettingsNavigation } from './SettingsNavigationContext';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import {
  SETTINGS_ACCOUNT_TABS,
  accountTabHref,
  parseAccountTab,
  type SettingsAccountId,
} from '@/lib/navigation/settingsAccountTab';

/**
 * Account sub-rail entries. Each maps to an in-page panel on `/account`, driven
 * by the `?tab=` query param so the panel selection is shareable and the shell
 * can highlight the active item from any settings-family route. Ids and labels
 * come from the navigation lib; only the icons are client-side.
 */
const ACCOUNT_TAB_ICONS: Record<SettingsAccountId, LucideIcon> = {
  profile: UserIcon,
  'contact-info': Contact,
  security: ShieldCheck,
};

const SETTINGS_ACCOUNT_ITEMS = SETTINGS_ACCOUNT_TABS.map((tab) => ({
  ...tab,
  Icon: ACCOUNT_TAB_ICONS[tab.id],
}));

interface WorkspaceLink {
  id: string;
  label: string;
  Icon: LucideIcon;
  href: string;
  show: boolean;
}

interface SettingsShellProps {
  /** Section descriptor for the header (resolved client-side for its icon). */
  sectionId: ShellSectionId;
  children: React.ReactNode;
  /** Optional per-section controls rendered before the global header actions. */
  headerRight?: React.ReactNode;
  /** When true, the content column fills remaining height and owns its scroll. */
  fill?: boolean;
}

function accountTabFromHref(href: string): SettingsAccountId | null {
  if (!href.startsWith('/account')) return null;
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return parseAccountTab(new URLSearchParams(query).get('tab'));
}

/**
 * The shared settings two-pane shell: a brand section header above a persistent
 * vertical sub-rail beside the active surface. Settings-family routes
 * (`/account`, `/organizations`, `/usage`, `/billing`) and admin routes
 * (`/admin/*`) render inside this shell so navigation stays consistent.
 */
export function SettingsShell({
  sectionId,
  children,
  headerRight,
  fill = false,
}: SettingsShellProps) {
  const { navigateTo } = useAppShellNavigation();
  const pathname = usePathname();
  const { accountTab, setAccountTab } = useSettingsNavigation();
  const { billing: billingEnabled } = useFeatures();
  const { isSelfHost } = useEnvironment();
  const { isUnifyAdmin } = useWorkspace();

  const onAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const onAccount = pathname === '/account';

  const section = onAdmin ? SHELL_SECTIONS.admin : SHELL_SECTIONS[sectionId];

  const workspaceLinks = React.useMemo<WorkspaceLink[]>(
    () => [
      {
        id: 'organizations',
        label: 'Organization',
        Icon: Building,
        href: '/organizations',
        show: !isSelfHost,
      },
      { id: 'usage', label: 'Usage', Icon: BarChart3, href: '/usage', show: billingEnabled },
      { id: 'billing', label: 'Billing', Icon: CreditCard, href: '/billing', show: billingEnabled },
      { id: 'admin', label: 'Admin', Icon: ShieldCheck, href: '/admin', show: isUnifyAdmin },
    ],
    [billingEnabled, isSelfHost, isUnifyAdmin]
  );

  const isWorkspaceActive = (href: string) => {
    if (href === '/admin') return onAdmin;
    return !onAccount && (pathname === href || pathname.startsWith(`${href}/`));
  };

  const navigateAccountTab = React.useCallback(
    (tab: SettingsAccountId) => {
      if (onAccount) {
        setAccountTab(tab);
        return;
      }
      navigateTo(accountTabHref(tab));
    },
    [onAccount, navigateTo, setAccountTab]
  );

  const handleMobileNavChange = React.useCallback(
    (href: string) => {
      const tab = accountTabFromHref(href);
      if (tab !== null && onAccount) {
        setAccountTab(tab);
        return;
      }
      navigateTo(href);
    },
    [onAccount, navigateTo, setAccountTab]
  );

  const isBelowTablet = useMatchesBelow('tablet');

  const mobileNavItems = React.useMemo(() => {
    const items: { label: string; href: string }[] = [];
    if (onAdmin) {
      items.push({ label: 'Settings', href: '/account' });
      ADMIN_NAV_ITEMS.forEach((item) => items.push({ label: item.label, href: item.href }));
    } else {
      SETTINGS_ACCOUNT_ITEMS.forEach((item) =>
        items.push({ label: item.label, href: accountTabHref(item.id) })
      );
    }
    workspaceLinks
      .filter((link) => link.show)
      .forEach((link) => items.push({ label: link.label, href: link.href }));
    return items;
  }, [onAdmin, workspaceLinks]);

  const mobileNavValue = onAccount ? accountTabHref(accountTab) : pathname;

  const settingsHeaderLeading = <HomeShellRailToggle />;

  const settingsHeaderRight = (
    <>
      {isBelowTablet ? (
        <Select value={mobileNavValue} onValueChange={handleMobileNavChange}>
          <SelectTrigger
            className="h-8 w-[9rem] cursor-pointer bg-background px-2 text-xs shadow-none sm:w-[11rem]"
            data-testid="settings-nav-mobile"
            aria-label="Settings navigation"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="z-[80] w-[var(--radix-select-trigger-width)] border-border bg-popover shadow-lg"
          >
            {mobileNavItems.map((item) => (
              <SelectItem key={item.href} value={item.href} className="cursor-pointer text-xs">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {headerRight}
    </>
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} leading={settingsHeaderLeading} right={settingsHeaderRight} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="hidden w-[230px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-2.5 py-3 lg:flex"
          data-testid="settings-subrail"
        >
          {onAdmin ? (
            <>
              <div className="text-overline px-3 pb-1.5 pt-2">Account</div>
              <RailNavButton
                Icon={Settings}
                label="Settings"
                active={false}
                onClick={() => navigateTo('/account')}
                testId="settings-back-account"
              />
              <div className="text-overline px-3 pb-1.5 pt-4">Admin</div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <RailNavButton
                  key={item.href}
                  Icon={item.Icon}
                  label={item.label}
                  active={isAdminNavActive(pathname, item.href)}
                  onClick={() => navigateTo(item.href)}
                  testId={`admin-nav-${item.id}`}
                />
              ))}
            </>
          ) : (
            <>
              <div className="text-overline px-3 pb-1.5 pt-2">Account</div>
              {SETTINGS_ACCOUNT_ITEMS.map((item) => (
                <RailNavButton
                  key={item.id}
                  Icon={item.Icon}
                  label={item.label}
                  active={onAccount && accountTab === item.id}
                  onClick={() => navigateAccountTab(item.id)}
                  testId={`settings-nav-${item.id}`}
                />
              ))}
            </>
          )}

          <div className="text-overline px-3 pb-1.5 pt-4">Workspace</div>
          {workspaceLinks
            .filter((link) => link.show)
            .map((link) => (
              <RailNavButton
                key={link.href}
                Icon={link.Icon}
                label={link.label}
                active={isWorkspaceActive(link.href)}
                onClick={() => navigateTo(link.href)}
                testId={`settings-link-${link.id}`}
              />
            ))}
        </aside>

        <div
          className={
            fill
              ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
              : 'min-h-0 min-w-0 flex-1 overflow-y-auto'
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
