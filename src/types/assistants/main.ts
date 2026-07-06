import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';

export type AssistantsMainUserMeta = {
  image: string | null | undefined;
  timezone?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  discordId?: string | null;
  orgId?: number | null;
  isOrgContext?: boolean;
  isFreeTrial?: boolean;
  mfaSetupRequired?: boolean;
  slackOwner?: SlackInstallOwner | null;
  slackCanManageInstall?: boolean;
  slackInitialInstall?: SlackInstall | null;
};
