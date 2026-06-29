'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';
import { ADMIN_NAV_ITEMS, isAdminNavActive } from './adminNav';
import { useFeatures, useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';

/**
 * Account sub-rail entries. Each maps to an in-page panel on `/account`, driven
 * by the `?tab=` query param so the panel selection is shareable and the shell
 * can highlight the active item from any settings-family route.
 */
export const SETTINGS_ACCOUNT_ITEMS = [
  { id: 'profile', label: 'Profile', Icon: UserIcon },
  { id: 'contact-info', label: 'Contact info', Icon: Contact },
  { id: 'security', label: 'Security', Icon: ShieldCheck },
] as const;

export type SettingsAccountId = (typeof SETTINGS_ACCOUNT_ITEMS)[number]['id'];

export const SETTINGS_ACCOUNT_IDS = SETTINGS_ACCOUNT_ITEMS.map((i) => i.id) as readonly string[];

/** Legacy account tabs merged into profile/security — redirect on load. */
export const LEGACY_ACCOUNT_TAB_REDIRECTS: Readonly<Record<string, SettingsAccountId>> = {
  preferences: 'profile',
  advanced: 'security',
};

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { billing: billingEnabled } = useFeatures();
  const { isSelfHost } = useEnvironment();
  const { isUnifyAdmin } = useWorkspace();

  const onAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const onAccount = pathname === '/account';
  const accountTab = onAccount ? (searchParams.get('tab') ?? 'profile') : null;

  const section = onAdmin ? SHELL_SECTIONS.admin : SHELL_SECTIONS[sectionId];

  const workspaceLinks: WorkspaceLink[] = [
    {
      id: 'organizations',
      label: 'Organizations',
      Icon: Building,
      href: '/organizations',
      show: !isSelfHost,
    },
    { id: 'usage', label: 'Usage', Icon: BarChart3, href: '/usage', show: billingEnabled },
    { id: 'billing', label: 'Billing', Icon: CreditCard, href: '/billing', show: billingEnabled },
    { id: 'admin', label: 'Admin', Icon: ShieldCheck, href: '/admin', show: isUnifyAdmin },
  ];

  const isWorkspaceActive = (href: string) => {
    if (href === '/admin') return onAdmin;
    return !onAccount && (pathname === href || pathname.startsWith(`${href}/`));
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} right={headerRight} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="flex w-[230px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-2.5 py-3"
          data-testid="settings-subrail"
        >
          {onAdmin ? (
            <>
              <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Account
              </div>
              <RailNavButton
                Icon={Settings}
                label="Settings"
                active={false}
                onClick={() => router.push('/account')}
                testId="settings-back-account"
              />
              <div className="px-3 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Admin
              </div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <RailNavButton
                  key={item.href}
                  Icon={item.Icon}
                  label={item.label}
                  active={isAdminNavActive(pathname, item.href)}
                  onClick={() => router.push(item.href)}
                  testId={`admin-nav-${item.id}`}
                />
              ))}
            </>
          ) : (
            <>
              <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Account
              </div>
              {SETTINGS_ACCOUNT_ITEMS.map((item) => (
                <RailNavButton
                  key={item.id}
                  Icon={item.Icon}
                  label={item.label}
                  active={onAccount && accountTab === item.id}
                  onClick={() => router.push(`/account?tab=${item.id}`)}
                  testId={`settings-nav-${item.id}`}
                />
              ))}
            </>
          )}

          <div className="px-3 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </div>
          {workspaceLinks
            .filter((link) => link.show)
            .map((link) => (
              <RailNavButton
                key={link.href}
                Icon={link.Icon}
                label={link.label}
                active={isWorkspaceActive(link.href)}
                onClick={() => router.push(link.href)}
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
