import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /organizations. Renders the section header
 * immediately (inside the persistent rail) with a skeleton body while the
 * organization data resolves.
 */
export default function Loading() {
  return (
    <ShellSectionPage sectionId="organizations" fill>
      <SectionBodySkeleton />
    </ShellSectionPage>
  );
}
