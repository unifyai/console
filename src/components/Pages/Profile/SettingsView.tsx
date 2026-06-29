'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SettingsShell,
  SETTINGS_ACCOUNT_IDS,
  LEGACY_ACCOUNT_TAB_REDIRECTS,
  type SettingsAccountId,
} from '@/components/Layout/Shell/SettingsShell';
import type { User } from '@/types/user';
import ProfileForm from './Form';
import ContactInfoTab from './ContactInfoTab';
import SecurityTab from './SecurityTab';

/**
 * The `/account` settings surface. The shared SettingsShell supplies the brand
 * header and the Account + Workspace sub-rail; this component renders the active
 * Account panel (selected via the `?tab=` query param) left-justified beside it.
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
  const tabParam = searchParams.get('tab');

  React.useEffect(() => {
    if (!tabParam) return;
    const redirect = LEGACY_ACCOUNT_TAB_REDIRECTS[tabParam];
    if (redirect) {
      router.replace(`/account?tab=${redirect}`);
    }
  }, [tabParam, router]);

  const active: SettingsAccountId = (() => {
    if (!tabParam) return 'profile';
    const legacy = LEGACY_ACCOUNT_TAB_REDIRECTS[tabParam];
    if (legacy) return legacy;
    if (SETTINGS_ACCOUNT_IDS.includes(tabParam)) return tabParam as SettingsAccountId;
    return 'profile';
  })();

  return (
    <SettingsShell sectionId="settings">
      <div className="w-full max-w-[900px] px-6 py-5">
        {active === 'profile' && <ProfileForm externalIdentity={externalIdentity} user={user} />}
        {active === 'contact-info' && <ContactInfoTab user={user} />}
        {active === 'security' && <SecurityTab user={user} apiKey={user.apiKey} />}
      </div>
    </SettingsShell>
  );
}
