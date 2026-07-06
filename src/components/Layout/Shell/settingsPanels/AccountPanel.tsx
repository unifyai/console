'use client';

import ProfileMain from '@/components/Pages/Profile/Main';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';

export default function AccountPanel() {
  const { user } = useWorkspace();
  const environment = useEnvironment();

  if (!user) {
    return <SectionBodySkeleton />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <ProfileMain user={user} externalIdentity={environment.authMode === 'external'} />
    </div>
  );
}
