'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LEGACY_ACCOUNT_TAB_REDIRECTS } from '@/components/Layout/Shell/SettingsShell';
import { useSettingsNavigation } from '@/components/Layout/Shell/SettingsNavigationContext';
import { accountTabHref } from '@/lib/navigation/settingsAccountTab';
import type { User } from '@/types/user';
import ProfileForm from './Form';
import ContactInfoTab from './ContactInfoTab';
import SecurityTab from './SecurityTab';

/**
 * The `/account` settings surface. The shared settings layout supplies the
 * shell chrome; this component renders the active Account panel without
 * triggering a navigation roundtrip when switching tabs.
 */
export function SettingsView({
  user,
  externalIdentity,
}: {
  user: User;
  externalIdentity: boolean;
}) {
  const router = useRouter();
  const { accountTab: active } = useSettingsNavigation();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (!tabParam) return;
    const redirect = LEGACY_ACCOUNT_TAB_REDIRECTS[tabParam];
    if (redirect) {
      router.replace(accountTabHref(redirect));
    }
  }, [router]);

  return (
    <div className="w-full max-w-[900px] px-6 py-5">
      <div
        className={active !== 'profile' ? 'hidden' : undefined}
        aria-hidden={active !== 'profile'}
      >
        <ProfileForm externalIdentity={externalIdentity} user={user} />
      </div>
      <div
        className={active !== 'contact-info' ? 'hidden' : undefined}
        aria-hidden={active !== 'contact-info'}
      >
        <ContactInfoTab user={user} />
      </div>
      <div
        className={active !== 'security' ? 'hidden' : undefined}
        aria-hidden={active !== 'security'}
      >
        <SecurityTab user={user} apiKey={user.apiKey} />
      </div>
    </div>
  );
}
