import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import type { MsTeamsBotInstall } from '@/types/ms-teams-bot/install';

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
  /** Org id whose MS Teams bot install can be bound here (org context
   *  only — the bind handshake is org-scoped). Null in a personal
   *  workspace, which hides the Teams bot entry. */
  msTeamsBotOrgId?: number | null;
  /** Whether the current user (org owner/admin) may bind the install. */
  msTeamsBotCanManage?: boolean;
  /** Server-prefetched current install for the active org. */
  msTeamsBotInitialInstall?: MsTeamsBotInstall | null;
};
