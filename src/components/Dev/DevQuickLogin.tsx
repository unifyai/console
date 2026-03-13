'use client';

/**
 * Dev-only quick login panel shown on the login page.
 *
 * Discovers seeded user accounts by querying the local Orchestra database
 * for users whose email matches the `seed-*` pattern. This means only
 * users that actually exist in the current database are shown — regardless
 * of which seed scenario was run or how many times the DB was wiped.
 *
 * This component is conditionally rendered only when
 * `process.env.NODE_ENV === 'development'`, so it is tree-shaken out of
 * production builds entirely.
 */

import React, { useEffect, useState, useTransition } from 'react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { getDevUsers, switchDevUser } from '@/lib/dev/actions';
import type { DevUser } from '@/lib/dev/actions';

/** Role → color mapping for visual distinction */
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  member: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  user: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function getRoleColor(label: string): string {
  return ROLE_COLORS[label.toLowerCase()] ?? ROLE_COLORS.user;
}

export default function DevQuickLogin() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [isPending, startTransition] = useTransition();
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);

  useEffect(() => {
    getDevUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  if (users.length === 0) return null;

  const handleLogin = (email: string) => {
    setSwitchingEmail(email);
    startTransition(async () => {
      const result = await switchDevUser(email);
      if (result.ok) {
        window.location.href = '/assistants';
      } else {
        console.error('[DevQuickLogin]', result.error);
        setSwitchingEmail(null);
      }
    });
  };

  return (
    <div className="w-full" data-testid="dev-quick-login">
      {/* Separator */}
      <div className="flex items-center gap-3 my-2">
        <div className="h-[1px] flex-1 bg-amber-300/40 dark:bg-amber-700/40" />
        <span className="flex items-center gap-1.5 text-label text-amber-600 dark:text-amber-400">
          <FlaskConical className="h-3 w-3" />
          Dev Quick Login
        </span>
        <div className="h-[1px] flex-1 bg-amber-300/40 dark:bg-amber-700/40" />
      </div>

      {/* User buttons */}
      <div className="flex flex-col gap-2">
        {users.map((u) => {
          const isLoading = switchingEmail === u.email;
          return (
            <button
              key={u.email}
              type="button"
              onClick={() => handleLogin(u.email)}
              disabled={isPending}
              className="group flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 text-left transition-all hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800/40 dark:bg-amber-950/20 dark:hover:border-amber-700 dark:hover:bg-amber-950/40"
              data-testid={`dev-login-${u.label}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-title text-foreground">
                  {u.name}
                </span>
                <span className="text-caption">
                  {u.email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getRoleColor(u.label)}`}
                >
                  {u.label}
                </span>
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

