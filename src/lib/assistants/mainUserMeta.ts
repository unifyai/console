'use server';

import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import { canManageOrgSlackInstall, getSlackInstallAction } from '@/lib/slack/install';
import { isSlackInstall } from '@/types/slack/install';
import type { AssistantsMainUserMeta } from '@/types/assistants/main';

export async function loadAssistantsMainUserMeta(): Promise<AssistantsMainUserMeta | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const activeOrganization = getActiveOrganization(user);
  const orgId = activeOrganization?.id ?? null;
  const slackConfigured = !!process.env.SLACK_CLIENT_ID && !!process.env.SLACK_CLIENT_SECRET;
  const slackOwner =
    slackConfigured && orgId != null
      ? { kind: 'org' as const, orgId }
      : slackConfigured
        ? { kind: 'user' as const, userId: String(user.id) }
        : null;
  const slackCanManageInstall =
    slackConfigured && orgId != null
      ? canManageOrgSlackInstall(activeOrganization)
      : slackConfigured;
  const installResult = slackOwner ? await getSlackInstallAction(slackOwner) : null;

  return {
    image: user.image,
    timezone: user.timezone,
    email: user.email,
    phoneNumber: user.phoneNumber,
    whatsappNumber: user.whatsappNumber,
    discordId: user.discordId,
    orgId,
    isOrgContext: activeOrganization !== null,
    isFreeTrial: !!activeOrganization?.freeTrial,
    mfaSetupRequired: !!user.mfaSetupRequired,
    slackOwner,
    slackCanManageInstall,
    slackInitialInstall: isSlackInstall(installResult) ? installResult : null,
  };
}
