'use client';

import { AppShell } from '@/components/Layout/Shell/AppShell';

/** Shared rail shell for assistants, settings, favourites, and interfaces. */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
