import { AppShell } from '@/components/Layout/Shell/AppShell';
import { assembleMainBootstrap } from '@/lib/assistants/assembleMainBootstrap';

/** Shared rail shell for assistants, settings, favourites, and interfaces. */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const bootstrap = await assembleMainBootstrap();

  return <AppShell bootstrap={bootstrap}>{children}</AppShell>;
}
