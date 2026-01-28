import React from 'react';
import { Metadata } from 'next';
import OnPrem from '@/components/Shared/OnPrem';
import UsageMain from '@/components/Pages/Usage/Main';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createUsageActions } from '@/lib/usage/actions';
import { listAssistants } from '@/lib/assistants/assistant';
import { getMembersAction } from '@/lib/orchestra/api/organization';

export const metadata: Metadata = {
  title: 'Usage',
};

interface UsagePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Usage Page
 *
 * Displays a bar chart visualization of billed_cost over time,
 * allowing users to track LLM credit usage across assistants.
 *
 * Supports URL query parameters:
 * - `assistant`: Pre-filter by assistant ID (from assistant profile "View Usage" link)
 */
const UsagePage: React.FC<UsagePageProps> = async ({ searchParams }) => {
  // Await searchParams (Next.js 15 async params)
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Check for on-prem mode
  const onPrem = process.env.ON_PREM;
  if (onPrem) {
    return (
      <div className="h-full w-full overflow-auto p-1">
        <Suspense fallback={<SkeletonLoader />}>
          <OnPrem />
        </Suspense>
      </div>
    );
  }

  // Get API key
  const apiKey = user.apiKey || '';

  // Determine user role in current workspace
  const cookieStore = cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;
  const isOrgContext = workspaceId && workspaceId !== 'personal';
  let isAdmin = false;
  let orgId: number | null = null;

  if (isOrgContext) {
    const activeOrg = user.organizations?.find((o) => o.id.toString() === workspaceId);
    if (activeOrg) {
      const roleName = activeOrg.roleName?.toLowerCase();
      isAdmin = roleName === 'owner' || roleName === 'admin';
      orgId = activeOrg.id;
    }
  }

  // Create bound server actions (API key never exposed to client)
  const usageActions = await createUsageActions(apiKey);

  // Fetch assistants list
  const listAssistantsAction = await listAssistants(apiKey, !!isOrgContext);
  const assistantsResult = await listAssistantsAction();
  const assistants = Array.isArray(assistantsResult) ? assistantsResult : [];

  // Fetch org members if admin in org context
  let orgMembers: Array<{ userId: string; name: string; email?: string }> = [];
  if (isAdmin && orgId) {
    const getMembersActionFn = await getMembersAction(apiKey);
    const membersResult = await getMembersActionFn(orgId);
    if (Array.isArray(membersResult)) {
      orgMembers = membersResult.map((m) => ({
        userId: m.userId,
        name: m.name || m.email || 'Unknown User',
        email: m.email,
      }));
    }
  }

  // Extract initial assistant filter from URL query params
  const initialAssistantId = typeof params.assistant === 'string' ? params.assistant : undefined;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Suspense fallback={<SkeletonLoader />}>
        <UsageMain
          currentUserId={user.id}
          usageActions={usageActions}
          assistants={assistants}
          orgMembers={orgMembers}
          isAdmin={isAdmin}
          initialAssistantId={initialAssistantId}
        />
      </Suspense>
    </div>
  );
};

export default UsagePage;
