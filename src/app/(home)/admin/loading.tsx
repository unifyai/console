import { SkeletonList } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /admin. Renders a skeleton of the tool list
 * inside the persistent rail while access is resolved and the index renders.
 */
export default function AdminLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <SkeletonList rows={5} />
      </div>
    </div>
  );
}
