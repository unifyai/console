'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/user/user';

/* --------------------------
   TimezoneSync
   --------------------------
   Once per browser session, compares the user's account timezone with the
   browser's reported timezone. If they differ, silently updates the account
   to match the browser and surfaces an "Undo" toast so users who are
   travelling, on a VPN, or intentionally use a non-local account timezone
   can revert without ever opening their settings.

   When the user clicks Undo we (a) revert the account timezone and
   (b) remember the browser timezone in localStorage so we don't try to
   auto-update to the same value again on future sessions. Undismissing
   happens implicitly: if the browser timezone changes again, we'll prompt
   for the new one.

   New users (account timezone is unset) are updated silently with no toast,
   since there's nothing to undo to. */

const SESSION_FLAG_KEY = 'tz-sync-checked';
const DISMISSED_BROWSER_TZS_KEY = 'tz-sync-dismissed-browser-tzs';

function getDismissedBrowserTzs(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_BROWSER_TZS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function rememberDismissal(browserTz: string) {
  try {
    const dismissed = getDismissedBrowserTzs();
    dismissed.add(browserTz);
    localStorage.setItem(DISMISSED_BROWSER_TZS_KEY, JSON.stringify(Array.from(dismissed)));
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

function humanizeTz(tz: string): string {
  return tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
}

async function setUserTimezone(timezone: string | null): Promise<boolean> {
  try {
    const response = await fetch('/api/user/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_FLAG_KEY) === '1') return;

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimezone) return;

    const markChecked = () => sessionStorage.setItem(SESSION_FLAG_KEY, '1');

    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return; // not signed in

        if (user.timezone === browserTimezone) {
          markChecked();
          return;
        }

        if (getDismissedBrowserTzs().has(browserTimezone)) {
          markChecked();
          return;
        }

        const previousTimezone = user.timezone;

        const ok = await setUserTimezone(browserTimezone);
        if (!ok) return; // leave session flag unset so we retry next navigation
        markChecked();

        // Only prompt for undo when there was a real previous value to revert
        // to. New users with no prior timezone don't need the noise.
        if (previousTimezone) {
          toast.info(`Timezone updated to ${humanizeTz(browserTimezone)}`, {
            description: `Your account was set to ${humanizeTz(previousTimezone)}. Undo to revert and skip auto-detection here.`,
            duration: 12_000,
            action: {
              label: 'Undo',
              onClick: async () => {
                rememberDismissal(browserTimezone);
                const reverted = await setUserTimezone(previousTimezone);
                if (reverted) {
                  toast.success(`Timezone restored to ${humanizeTz(previousTimezone)}`);
                  router.refresh();
                } else {
                  toast.error(
                    'Failed to restore timezone. Please try again from your account settings.'
                  );
                }
              },
            },
          });
        }

        router.refresh();
      } catch (err) {
        console.error('[TimezoneSync] Failed to sync timezone:', err);
      }
    })();
  }, [router]);

  return null;
}
