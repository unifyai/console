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
  listUserDesktops,
  linkDesktop,
  unlinkDesktop,
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
  searchParams?: Record<string, string | string[] | undefined>;
}) => {
  const user = await getCurrentUser();
  if (!user) {
    const creditToken = typeof searchParams?.token === 'string' ? searchParams.token : null;
    const loginUrl = creditToken
      ? `/login?signout=true&credit=${encodeURIComponent(creditToken)}`
      : '/login?signout=true';
    redirect(loginUrl);
  }
  const apiKey = user.apiKey;
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;
  const activeOrganization = getActiveOrganization(user);
  const orgId = activeOrganization?.id ?? null;
  const orgName = activeOrganization?.name ?? null;
  const isFreeTrial = !!activeOrganization?.freeTrial;
  const isOrgContext = activeOrganization !== null;

  const assistantActions: AssistantActions = {
    assistant: {
      check: await checkHiringFunds(apiKey),
      create: await createAssistant(apiKey),
      update: await updateAssistant(apiKey),
      delete: await deleteAssistant(apiKey),
    },
    photo: {
      uploadPhoto: await uploadPhoto(apiKey),
      uploadVideo: await uploadVideo(apiKey),
      downloadMedia: await downloadMedia(),
      downloadPresetPhoto: await downloadPresetPhoto(),
      downloadPresetVideo: await downloadPresetVideo(),
      generate: await generatePhoto(apiKey),
      edit: await editPhoto(apiKey),
      animate: await animatePhoto(apiKey),
      getAnimation: await getAnimationPrediction(apiKey),
      cancelAnimation: await cancelAnimationPrediction(apiKey),
    },
    voice: {
      register: await registerVoice(apiKey),
      delete: await deleteVoice(apiKey),
      clone: await cloneVoice(apiKey),
      generate: await generateSpeech(apiKey),
      preview: await designVoiceGeneratePreviews(apiKey),
      design: await designVoiceCreateFromPreview(apiKey),
    },
    chat: {
      getContactId: await getContactIdByEmail(apiKey),
      getTranscripts: await getTranscripts(apiKey),
      message: await messageAssistant(apiKey),
      getAssistantOwnerById: await getAssistantOwnerById(),
      uploadAttachment: await uploadAttachment(apiKey),
    },
    contact: {
      delete: await deleteAssistantContact(apiKey),
      create: await createAssistantContact(apiKey),
      connect: await connectAssistantAccount(apiKey),
      disconnect: await disconnectAssistantAccount(apiKey),
      getGrantedFeatures: await getGrantedFeatures(apiKey),
      listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
      listAvailableSocialPlatforms: await listAvailableSocialPlatforms(adminKey),
      verifySocialAccount: await verifySocialAccount(adminKey),
      fetchContactCosts: await fetchContactCosts(),
    },
    secret: {
      get: await getSecrets(apiKey, orgId),
      create: await createSecret(apiKey, orgId, orgName),
      update: await updateSecret(apiKey, orgId),
      delete: await deleteSecret(apiKey, orgId),
    },
    call: {
      getConnectionDetails: await getCallConnectionDetails(apiKey),
      dispatchToCall: await dispatchAssistantToCall(apiKey),
      deleteRoom: await deleteCallRoom(),
    },
    desktop: {
      getLiveviewUrl: await getLiveviewUrl(),
      buildLiveviewUrl: await buildLiveviewUrl(),
      checkLiveviewHealth: await checkLiveviewHealth(),
      sendSystemEvent: await sendSystemEvent(),
      listUserDesktops: await listUserDesktops(apiKey),
      linkDesktop: await linkDesktop(apiKey),
      unlinkDesktop: await unlinkDesktop(apiKey),
    },
    spending: {
      setLimit: await setAssistantSpendingLimit(apiKey),
    },
    // Actions panel - live action events
    actions: {
      getManagerMethodEvents: await getManagerMethodEvents(apiKey),
      getToolLoopEvents: await getToolLoopEvents(apiKey),
      backfillByCallingIds: await backfillByCallingIds(apiKey),
    },
    // Dashboards pane - dashboard and tile data
    dashboards: {
      getMetadata: await getDashboardMetadata(apiKey),
      getTileContent: await getDashboardTileContent(apiKey),
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
    const getInstall = await getSlackInstallAction(apiKey);
    const revokeInstall = await revokeSlackInstallAction(apiKey);
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
