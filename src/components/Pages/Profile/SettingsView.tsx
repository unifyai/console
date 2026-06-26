'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SettingsShell,
  SETTINGS_ACCOUNT_IDS,
  type SettingsAccountId,
} from '@/components/Layout/Shell/SettingsShell';
import type { User } from '@/types/user';
import ProfileForm from './Form';
import ContactInfoTab from './ContactInfoTab';
import PreferencesTab from './PreferencesTab';
import AdvancedTab from './AdvancedTab';
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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const active: SettingsAccountId = (
    tabParam && SETTINGS_ACCOUNT_IDS.includes(tabParam) ? tabParam : 'profile'
  ) as SettingsAccountId;

  return (
    <SettingsShell sectionId="settings">
      <div className="w-full max-w-[900px] px-6 py-5">
        {active === 'profile' && <ProfileForm externalIdentity={externalIdentity} user={user} />}
        {active === 'contact-info' && <ContactInfoTab user={user} />}
        {active === 'preferences' && <PreferencesTab />}
        {active === 'advanced' && <AdvancedTab apiKey={user.apiKey} />}
        {active === 'security' && <SecurityTab user={user} />}
      </div>
    </SettingsShell>
  );
}
