'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User as UserIcon,
  Contact,
  SlidersHorizontal,
  Code2,
  ShieldCheck,
  Building,
  BarChart3,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import { RailNavButton } from '@/components/Pages/Assistants/Rail/RailNavButton';
import { SETTINGS_SECTION } from '@/components/Layout/Shell/shellSections';
import { useFeatures, useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { getCurrentUser } from '@/lib/user/user';
import type { User } from '@/types/user';
import ProfileForm from './Form';
import ContactInfoTab from './ContactInfoTab';
import PreferencesTab from './PreferencesTab';
import AdvancedTab from './AdvancedTab';
import SecurityTab from './SecurityTab';

const ACCOUNT_ITEMS = [
  { id: 'profile', label: 'Profile', Icon: UserIcon },
  { id: 'contact-info', label: 'Contact info', Icon: Contact },
  { id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { id: 'advanced', label: 'Advanced', Icon: Code2 },
  { id: 'security', label: 'Security', Icon: ShieldCheck },
] as const;

type AccountId = (typeof ACCOUNT_ITEMS)[number]['id'];
const ACCOUNT_IDS = ACCOUNT_ITEMS.map((i) => i.id) as readonly string[];

interface WorkspaceLink {
  label: string;
  Icon: LucideIcon;
  href: string;
  show: boolean;
}

/**
 * The `/account` settings surface: a brand section header above a vertical
 * sub-rail (an "Account" group of in-page panels and a "Workspace" group that
 * links out to the org/usage/billing/admin routes) beside the active panel.
 */
export function SettingsView({
  user,
  externalIdentity,
}: {
  user: User;
  externalIdentity: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing: billingEnabled } = useFeatures();
  const { isSelfHost } = useEnvironment();

  const tabParam = searchParams.get('tab');
  const initial: AccountId = (
    tabParam && ACCOUNT_IDS.includes(tabParam) ? tabParam : 'profile'
  ) as AccountId;
  const [active, setActive] = React.useState<AccountId>(initial);

  React.useEffect(() => {
    if (tabParam && ACCOUNT_IDS.includes(tabParam)) setActive(tabParam as AccountId);
  }, [tabParam]);

  const [isUnifyAdmin, setIsUnifyAdmin] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const current = await getCurrentUser();
      const orgs = current?.organizations ?? [];
      setIsUnifyAdmin(
        orgs.some(
          (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
        )
      );
    })();
  }, []);

  const selectAccount = (id: AccountId) => {
    setActive(id);
    router.replace(`/account?tab=${id}`, { scroll: false });
  };

  const workspaceLinks: WorkspaceLink[] = [
    { label: 'Organizations', Icon: Building, href: '/organizations', show: !isSelfHost },
    { label: 'Usage', Icon: BarChart3, href: '/usage', show: billingEnabled },
    { label: 'Billing', Icon: CreditCard, href: '/billing', show: billingEnabled },
    { label: 'Admin', Icon: ShieldCheck, href: '/admin', show: isUnifyAdmin },
  ];

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={SETTINGS_SECTION} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[230px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-2.5 py-3">
          <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Account
          </div>
          {ACCOUNT_ITEMS.map((item) => (
            <RailNavButton
              key={item.id}
              Icon={item.Icon}
              label={item.label}
              active={active === item.id}
              onClick={() => selectAccount(item.id)}
              testId={`settings-nav-${item.id}`}
            />
          ))}
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
                onClick={() => router.push(link.href)}
                testId={`settings-link-${link.label.toLowerCase()}`}
              />
            ))}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[900px] px-6 py-5">
            {active === 'profile' && (
              <ProfileForm externalIdentity={externalIdentity} user={user} />
            )}
            {active === 'contact-info' && <ContactInfoTab user={user} />}
            {active === 'preferences' && <PreferencesTab />}
            {active === 'advanced' && <AdvancedTab apiKey={user.apiKey} />}
            {active === 'security' && <SecurityTab user={user} />}
          </div>
        </div>
      </div>
    </div>
  );
}
