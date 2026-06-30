import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /billing. Renders the section header immediately
 * (inside the persistent rail) with a skeleton body while the server component
 * resolves billing data.
 */
export default function Loading() {
  return (
    <ShellSectionPage sectionId="billing">
      <SectionBodySkeleton />
    </ShellSectionPage>
  );
}
