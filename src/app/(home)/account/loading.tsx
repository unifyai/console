import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { Skeleton } from '@/components/UI/skeleton';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /account (Settings). Renders the Settings header
 * immediately (inside the persistent rail) alongside a skeleton of the settings
 * sub-rail and the form panel while the profile data resolves.
 */
export default function AccountLoading() {
  return (
    <ShellSectionPage sectionId="settings" fill>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[230px] shrink-0 flex-col gap-2 border-r border-border px-2.5 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </aside>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[900px] space-y-6 px-6 py-5">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    </ShellSectionPage>
  );
}
