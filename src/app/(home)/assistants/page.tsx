import { getCurrentUser } from '@/lib/user/user';
import Main from '@/components/Pages/Assistants/Main';
import { getTasks, updateTask } from '@/lib/assistants/task';
import {
  listAssistants,
  createAssistant,
  deleteAssistant,
  updateAssistant,
  getAssistantStatus,
  checkHiringFunds,
} from '@/lib/assistants/assistant';
import {
  uploadPhoto,
  uploadVideo,
  downloadPhoto,
  downloadPresetVideo,
  generatePhoto,
  editPhoto,
  animatePhoto,
  getAnimationPrediction,
  cancelAnimationPrediction,
} from '@/lib/assistants/photo';
import {
  listVoices,
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
} from '@/lib/assistants/contact';
import { TaskActions } from '@/types/assistants/task';
import { AssistantActions } from '@/types/assistants/assistant';
import { redirect } from 'next/navigation';
import {
  fetchCurrentUserHiringProfile,
  claimAssistantHiringToken,
  requestAssistantHiringAccess,
} from '@/lib/assistants/approval';
import { getSecrets, createSecret, deleteSecret } from '@/lib/assistants/secret';
import { getCallConnectionDetails, dispatchAssistantToCall, deleteCallRoom } from '@/lib/assistants/call';
import { getLiveviewUrl, sendSystemEvent, listUserDesktops } from '@/lib/assistants/desktop';
import {
  getAssistantSpend,
  getAssistantSpendingLimit,
  setAssistantSpendingLimit,
} from '@/lib/assistants/spending';
import {
  getManagerMethodEvents,
  getToolLoopEvents,
  backfillByCallingIds,
} from '@/lib/assistants/action';
import { getUserSpend, getUserSpendingLimit } from '@/lib/user/spending';
import { getOrgSpend, getOrgSpendingLimit } from '@/lib/organizations/spending';
import { cookies } from 'next/headers';

const AssistantsPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }
  const apiKey = user.apiKey;
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;
  const isOrgContext = user.organizations?.some((org) => org.apiKey === apiKey) ?? false;

  // Determine org ID from workspace cookie (same pattern as usage page)
  const cookieStore = cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;
  let orgId: number | null = null;
  if (workspaceId && workspaceId !== 'personal') {
    const activeOrg = user.organizations?.find((o) => o.id.toString() === workspaceId);
    if (activeOrg) {
      orgId = activeOrg.id;
    }
  }

  // Include demo assistants so demoers can chat with them
  const includeDemo = true;

  const assistantActions: AssistantActions = {
    assistant: {
      list: await listAssistants(apiKey, isOrgContext, includeDemo),
      check: await checkHiringFunds(apiKey),
      create: await createAssistant(apiKey),
      update: await updateAssistant(apiKey),
      delete: await deleteAssistant(apiKey),
      status: await getAssistantStatus(adminKey),
    },
    photo: {
      upload: await uploadPhoto(apiKey),
      uploadVideo: await uploadVideo(apiKey),
      download: await downloadPhoto(),
      downloadPresetVideo: await downloadPresetVideo(),
      generate: await generatePhoto(apiKey),
      edit: await editPhoto(apiKey),
      animate: await animatePhoto(apiKey),
      getAnimation: await getAnimationPrediction(apiKey),
      cancelAnimation: await cancelAnimationPrediction(apiKey),
    },
    voice: {
      list: await listVoices(apiKey),
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
      listAllAssistantEmails: await listAllAssistantEmails(adminKey),
      listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
      listAvailableSocialPlatforms: await listAvailableSocialPlatforms(adminKey),
      verifySocialAccount: await verifySocialAccount(adminKey),
    },
    secret: {
      get: await getSecrets(apiKey, user.id, isOrgContext),
      create: await createSecret(apiKey, user.id, isOrgContext),
      delete: await deleteSecret(apiKey),
    },
    approval: {
      getProfile: await fetchCurrentUserHiringProfile(),
      claimToken: await claimAssistantHiringToken(apiKey),
      requestAccess: await requestAssistantHiringAccess(apiKey),
    },
    call: {
      getConnectionDetails: await getCallConnectionDetails(apiKey),
      dispatchToCall: await dispatchAssistantToCall(apiKey),
      deleteRoom: await deleteCallRoom(),
    },
    desktop: {
      getLiveviewUrl: await getLiveviewUrl(user.id, user.apiKey),
      sendSystemEvent: await sendSystemEvent(),
      listUserDesktops: await listUserDesktops(apiKey),
    },
    spending: {
      getSpend: await getAssistantSpend(apiKey),
      getLimit: await getAssistantSpendingLimit(apiKey),
      setLimit: await setAssistantSpendingLimit(apiKey),
    },
    // User spending actions (for spending gate)
    userSpending: {
      getSpend: await getUserSpend(apiKey),
      getLimit: await getUserSpendingLimit(apiKey),
    },
    // Org spending actions (only used if in org context)
    orgSpending: orgId
      ? {
          getSpend: await getOrgSpend(apiKey),
          getLimit: await getOrgSpendingLimit(apiKey),
        }
      : undefined,
    // Actions panel - live action events
    actions: {
      getManagerMethodEvents: await getManagerMethodEvents(apiKey),
      getToolLoopEvents: await getToolLoopEvents(apiKey),
      backfillByCallingIds: await backfillByCallingIds(apiKey),
    },
  };

  const taskActions: TaskActions = {
    get: await getTasks(apiKey, user.id, isOrgContext),
    update: await updateTask(apiKey),
  };

  const userMeta = { image: user.image, timezone: user.timezone, email: user.email, orgId };

  return (
    <div className="h-full w-full">
      <Main
        assistantActions={assistantActions}
        taskActions={taskActions}
        oneTimeToken={searchParams?.token}
        userMeta={userMeta}
      />
    </div>
  );
};

export default AssistantsPage;
