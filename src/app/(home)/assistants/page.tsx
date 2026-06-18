import { getCurrentUser } from '@/lib/user/user';
import Main from '@/components/Pages/Assistants/Main';
import {
  createAssistant,
  deleteAssistant,
  updateAssistant,
  checkHiringFunds,
} from '@/lib/assistants/assistant';
import {
  uploadPhoto,
  uploadVideo,
  downloadMedia,
  downloadPresetPhoto,
  downloadPresetVideo,
  generatePhoto,
  editPhoto,
  animatePhoto,
  getAnimationPrediction,
  cancelAnimationPrediction,
} from '@/lib/assistants/photo';
import {
  registerVoice,
  deleteVoice,
  cloneVoice,
  generateSpeech,
  designVoiceGeneratePreviews,
  designVoiceCreateFromPreview,
} from '@/lib/assistants/voice';
import {
  getTranscripts,
  messageAssistant,
  getContactIdByEmail,
  getAssistantOwnerById,
  uploadAttachment,
} from '@/lib/assistants/chat';
import {
  listAvailablePhoneCountries,
  listAvailableSocialPlatforms,
  verifySocialAccount,
  deleteAssistantContact,
  fetchContactCosts,
  createAssistantContact,
  connectAssistantAccount,
  disconnectAssistantAccount,
  getGrantedFeatures,
} from '@/lib/assistants/contact';
import {
  listWorkspaceFileRoots,
  listWorkspaceFileChildren,
  getWorkspaceFilePolicy,
  updateWorkspaceFilePolicy,
} from '@/lib/assistants/workspace-files';
import { AssistantActions } from '@/types/assistants/assistant';
import { redirect } from 'next/navigation';
import { getSecrets, createSecret, updateSecret, deleteSecret } from '@/lib/assistants/secret';
import {
  getCallConnectionDetails,
  dispatchAssistantToCall,
  deleteCallRoom,
} from '@/lib/assistants/call';
import {
  getLiveviewUrl,
  buildLiveviewUrl,
  checkLiveviewHealth,
  sendSystemEvent,
  getDesktopApiKey,
  listUserDesktops,
  linkDesktop,
  unlinkDesktop,
  renameUserDesktop,
  deleteUserDesktop,
} from '@/lib/assistants/desktop';
import { setAssistantSpendingLimit } from '@/lib/assistants/spending';
import {
  getManagerMethodEvents,
  getToolLoopEvents,
  backfillByCallingIds,
} from '@/lib/assistants/action';
import { getDashboardMetadata, getDashboardTileContent } from '@/lib/assistants/dashboard';
import { getActiveOrganization } from '@/lib/user/workspace';
import {
  getSlackInstallAction,
  revokeSlackInstallAction,
  canManageOrgSlackInstall,
} from '@/lib/slack/install';
import { isSlackInstall, type SlackInstall, type SlackInstallOwner } from '@/types/slack/install';

const AssistantsPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const creditToken =
      typeof resolvedSearchParams?.token === 'string' ? resolvedSearchParams.token : null;
    const loginUrl = creditToken
      ? `/login?signout=true&credit=${encodeURIComponent(creditToken)}`
      : '/login?signout=true';
    redirect(loginUrl);
  }
  const activeOrganization = getActiveOrganization(user);
  const orgId = activeOrganization?.id ?? null;
  const isFreeTrial = !!activeOrganization?.freeTrial;
  const isOrgContext = activeOrganization !== null;

  const assistantActions: AssistantActions = {
    assistant: {
      check: checkHiringFunds,
      create: createAssistant,
      update: updateAssistant,
      delete: deleteAssistant,
    },
    photo: {
      uploadPhoto,
      uploadVideo,
      downloadMedia,
      downloadPresetPhoto,
      downloadPresetVideo,
      generate: generatePhoto,
      edit: editPhoto,
      animate: animatePhoto,
      getAnimation: getAnimationPrediction,
      cancelAnimation: cancelAnimationPrediction,
    },
    voice: {
      register: registerVoice,
      delete: deleteVoice,
      clone: cloneVoice,
      generate: generateSpeech,
      preview: designVoiceGeneratePreviews,
      design: designVoiceCreateFromPreview,
    },
    chat: {
      getContactId: getContactIdByEmail,
      getTranscripts,
      message: messageAssistant,
      getAssistantOwnerById,
      uploadAttachment,
    },
    contact: {
      delete: deleteAssistantContact,
      create: createAssistantContact,
      connect: connectAssistantAccount,
      disconnect: disconnectAssistantAccount,
      getGrantedFeatures,
      listAvailablePhoneCountries,
      listAvailableSocialPlatforms,
      verifySocialAccount,
      fetchContactCosts,
    },
    workspaceFiles: {
      listRoots: listWorkspaceFileRoots,
      listChildren: listWorkspaceFileChildren,
      getPolicy: getWorkspaceFilePolicy,
      updatePolicy: updateWorkspaceFilePolicy,
    },
    secret: {
      get: getSecrets,
      create: createSecret,
      update: updateSecret,
      delete: deleteSecret,
    },
    call: {
      getConnectionDetails: getCallConnectionDetails,
      dispatchToCall: dispatchAssistantToCall,
      deleteRoom: deleteCallRoom,
    },
    desktop: {
      getLiveviewUrl,
      buildLiveviewUrl,
      checkLiveviewHealth,
      sendSystemEvent,
      getApiKey: getDesktopApiKey,
      listUserDesktops,
      linkDesktop,
      unlinkDesktop,
      renameUserDesktop,
      deleteUserDesktop,
    },
    spending: {
      setLimit: setAssistantSpendingLimit,
    },
    actions: {
      getManagerMethodEvents,
      getToolLoopEvents,
      backfillByCallingIds,
    },
    dashboards: {
      getMetadata: getDashboardMetadata,
      getTileContent: getDashboardTileContent,
    },
  };

  // Slack workspace install (owner-scoped, shared across every
  // assistant in the active workspace). Only wired when Slack OAuth is
  // configured on this deployment; otherwise the contact-details Slack
  // entry stays hidden. The install owner is the active org, or the
  // user's personal account when not in an org workspace — matching how
  // Orchestra scopes ``@app <token>`` resolution.
  const slackConfigured = !!process.env.SLACK_CLIENT_ID && !!process.env.SLACK_CLIENT_SECRET;
  let slackOwner: SlackInstallOwner | null = null;
  let slackCanManageInstall = false;
  let slackInitialInstall: SlackInstall | null = null;
  if (slackConfigured) {
    slackOwner = orgId != null ? { kind: 'org', orgId } : { kind: 'user', userId: String(user.id) };
    // Connect/disconnect is destructive and workspace-wide. Org installs
    // are managed by org owners or admins; personal installs are managed
    // by the user themselves.
    slackCanManageInstall = orgId != null ? canManageOrgSlackInstall(activeOrganization) : true;
    const getInstall = getSlackInstallAction;
    const revokeInstall = revokeSlackInstallAction;
    assistantActions.slack = { getInstall, revokeInstall };
    const installResult = await getInstall(slackOwner);
    if (isSlackInstall(installResult)) {
      slackInitialInstall = installResult;
    }
  }

  const userMeta = {
    image: user.image,
    timezone: user.timezone,
    email: user.email,
    phoneNumber: user.phoneNumber,
    whatsappNumber: user.whatsappNumber,
    discordId: user.discordId,
    orgId,
    isOrgContext,
    isFreeTrial,
    mfaSetupRequired: !!user.mfaSetupRequired,
    slackOwner,
    slackCanManageInstall,
    slackInitialInstall,
  };

  return (
    <div className="h-full w-full">
      <Main assistantActions={assistantActions} userMeta={userMeta} />
    </div>
  );
};

export default AssistantsPage;
