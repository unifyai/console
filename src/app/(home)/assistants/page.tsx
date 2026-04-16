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
  listAllAssistantEmails,
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
} from '@/lib/assistants/desktop';
import { setAssistantSpendingLimit } from '@/lib/assistants/spending';
import {
  getManagerMethodEvents,
  getToolLoopEvents,
  backfillByCallingIds,
} from '@/lib/assistants/action';
import { getDashboardMetadata, getDashboardTileContent } from '@/lib/assistants/dashboard';
import { cookies } from 'next/headers';

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

  // Determine org context from workspace cookie (not API key matching)
  const cookieStore = cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;
  let orgId: number | null = null;
  let orgName: string | null = null;
  let isFreeTrial = false;
  if (workspaceId && workspaceId !== 'personal') {
    const activeOrg = user.organizations?.find((o) => o.id.toString() === workspaceId);
    if (activeOrg) {
      orgId = activeOrg.id;
      orgName = activeOrg.name;
      isFreeTrial = !!activeOrg.freeTrial;
    }
  }
  const isOrgContext = orgId !== null;

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
      listAllAssistantEmails: await listAllAssistantEmails(adminKey),
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
  };

  return (
    <div className="h-full w-full">
      <Main assistantActions={assistantActions} userMeta={userMeta} />
    </div>
  );
};

export default AssistantsPage;
