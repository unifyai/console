import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import type { MsTeamsBotInstall, MsTeamsBotInstallOwner } from '@/types/ms-teams-bot/install';

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
  /** Owner scope whose MS Teams bot install can be bound here — an org
   *  (owner/admin) or the personal user. ``null`` (or absent
   *  ``assistantActions.msTeamsBot``) hides the Teams bot entry. */
  msTeamsBotOwner?: MsTeamsBotInstallOwner | null;
  /** Whether the current user may bind the install (org owner/admin, or
   *  the personal-account owner). */
  msTeamsBotCanManage?: boolean;
  /** Server-prefetched current install for the active owner scope. */
  msTeamsBotInitialInstall?: MsTeamsBotInstall | null;
};
