import React from 'react';
import { Metadata } from 'next';
import BillingUnavailable from '@/components/Shared/BillingUnavailable';
import UsageMain from '@/components/Pages/Usage/Main';
import FreeTrialUsageLock from '@/components/Pages/Usage/FreeTrialUsageLock';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import {
  getUserSpendingLimitAction,
  getOrgSpendingLimitAction,
  getMemberSpendingLimitAction,
  getAssistantSpendingLimitAction,
  setUserSpendingLimitAction,
  setOrgSpendingLimitAction,
  setMemberSpendingLimitAction,
  setAssistantSpendingLimitAction,
  type UsageActions,
} from '@/lib/usage/actions';
import { listAssistants } from '@/lib/assistants/assistant';
import { getMembersAction } from '@/lib/orchestra/api/organization';
import { resolveWorkspaceContext } from '@/lib/user/workspace';
import { getServerFeatures } from '@/lib/features/server';
import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { USAGE_SECTION } from '@/components/Layout/Shell/shellSections';

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
 * allowing users to track billable activity across assistants.
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

  // No billing feature (self-host / external-auth / no Stripe) → usage off.
  // `features.billing` already accounts for these via the credential authority.
  if (!(await getServerFeatures()).billing) {
    return (
      <ShellSectionPage section={USAGE_SECTION}>
        <Suspense fallback={<SkeletonLoader />}>
          <BillingUnavailable />
        </Suspense>
      </ShellSectionPage>
    );
  }

  // Get API key
  const apiKey = user.apiKey || '';
  const { activeOrganization, isUnifyMember } = resolveWorkspaceContext(user);
  const isOrgContext = activeOrganization !== null;
  const roleName = activeOrganization?.roleName?.toLowerCase();
  // Unify members (internal staff) get the org-wide usage view (members
  // filter, org totals) for any org they belong to, even if they aren't an
  // owner/admin of that org — matching the trial bypass below.
  const isAdmin = roleName === 'owner' || roleName === 'admin' || isUnifyMember;
  const orgId = activeOrganization?.id ?? null;

  if (activeOrganization?.freeTrial && !isUnifyMember) {
    return (
      <ShellSectionPage section={USAGE_SECTION}>
        <FreeTrialUsageLock />
      </ShellSectionPage>
    );
  }

  // Create bound server actions (API key never exposed to client)
  const usageActions: UsageActions = {
    getUserSpendingLimit: getUserSpendingLimitAction,
    getOrgSpendingLimit: getOrgSpendingLimitAction,
    getMemberSpendingLimit: getMemberSpendingLimitAction,
    getAssistantSpendingLimit: getAssistantSpendingLimitAction,
    setUserSpendingLimit: setUserSpendingLimitAction,
    setOrgSpendingLimit: setOrgSpendingLimitAction,
    setMemberSpendingLimit: setMemberSpendingLimitAction,
    setAssistantSpendingLimit: setAssistantSpendingLimitAction,
  };

  // Fetch assistants list (include demo assistants for demoers)
  const includeDemo = true;
  const assistantsResult = await listAssistants(!!isOrgContext, includeDemo);
  const assistants = Array.isArray(assistantsResult) ? assistantsResult : [];

  // Fetch org members if admin in org context
  let orgMembers: Array<{ userId: string; name: string; email?: string }> = [];
  if (isAdmin && orgId) {
    const membersResult = await getMembersAction(orgId);
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
    <ShellSectionPage section={USAGE_SECTION} fill>
      <Suspense fallback={<SkeletonLoader />}>
        <UsageMain
          currentUserId={user.id}
          usageActions={usageActions}
          assistants={assistants}
          orgMembers={orgMembers}
          isAdmin={isAdmin}
          initialAssistantId={initialAssistantId}
          orgId={orgId}
        />
      </Suspense>
    </ShellSectionPage>
  );
};

export default UsagePage;
