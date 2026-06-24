import { Skeleton } from '@/components/UI/skeleton';
import { SkeletonList } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /admin. Renders the admin header and a skeleton of
 * the tool list (inside the persistent rail) while access is resolved and the
 * index renders.
 */
export default function AdminLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-1.5 h-3 w-56" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <SkeletonList rows={5} />
      </div>
    </div>
  );
}
