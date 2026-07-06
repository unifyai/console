'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import BillingUnavailable from '@/components/Shared/BillingUnavailable';
import UsageMain, { type OrgMember } from '@/components/Pages/Usage/Main';
import FreeTrialUsageLock from '@/components/Pages/Usage/FreeTrialUsageLock';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { listAssistants } from '@/lib/assistants/assistant';
import { getMembersAction } from '@/lib/orchestra/api/organization';
import {
  getAssistantSpendingLimitAction,
  getMemberSpendingLimitAction,
  getOrgSpendingLimitAction,
  getUserSpendingLimitAction,
  setAssistantSpendingLimitAction,
  setMemberSpendingLimitAction,
  setOrgSpendingLimitAction,
  setUserSpendingLimitAction,
  type UsageActions,
} from '@/lib/usage/actions';
import type { Assistant } from '@/types/assistants/assistant';

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

interface UsageBootstrap {
  assistants: Assistant[];
  orgMembers: OrgMember[];
}

export default function UsagePanel() {
  const searchParams = useSearchParams();
  const { billing } = useFeatures();
  const { activeOrganization, currentUserId, isUnifyMember } = useWorkspace();

  const isOrgContext = activeOrganization !== null;
  const roleName = activeOrganization?.roleName?.toLowerCase();
  const isAdmin = roleName === 'owner' || roleName === 'admin' || isUnifyMember;
  const orgId = activeOrganization?.id ?? null;

  const loadUsageBootstrap = React.useCallback(async (): Promise<UsageBootstrap> => {
    const includeDemo = true;
    const assistantsResult = await listAssistants(isOrgContext, includeDemo);
    const nextAssistants = Array.isArray(assistantsResult) ? assistantsResult : [];
    let nextMembers: OrgMember[] = [];
    if (isAdmin && orgId) {
      const membersResult = await getMembersAction(orgId);
      if (Array.isArray(membersResult)) {
        nextMembers = membersResult.map((member) => ({
          userId: member.userId,
          name: member.name || member.email || 'Unknown User',
          email: member.email,
        }));
      }
    }
    return { assistants: nextAssistants, orgMembers: nextMembers };
  }, [isAdmin, isOrgContext, orgId]);

  const { data: usageBootstrap, isInitialLoading } = useShellResource<UsageBootstrap>({
    queryKey: ['settings-usage-bootstrap', isAdmin, isOrgContext, orgId],
    queryFn: loadUsageBootstrap,
    enabled: billing,
  });

  const assistants = usageBootstrap?.assistants ?? [];
  const orgMembers = usageBootstrap?.orgMembers ?? [];

  if (!billing) {
    return <BillingUnavailable />;
  }

  if (activeOrganization?.freeTrial && !isUnifyMember) {
    return <FreeTrialUsageLock />;
  }

  if (!currentUserId || (isInitialLoading && !usageBootstrap)) {
    return <SectionBodySkeleton />;
  }

  return (
    <UsageMain
      currentUserId={currentUserId}
      usageActions={usageActions}
      assistants={assistants}
      orgMembers={orgMembers}
      isAdmin={isAdmin}
      initialAssistantId={searchParams.get('assistant') ?? undefined}
      orgId={orgId}
    />
  );
}
