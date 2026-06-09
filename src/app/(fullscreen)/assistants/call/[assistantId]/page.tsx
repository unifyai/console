import { getCurrentUser } from '@/lib/user/user';
import { getServerFeatures } from '@/lib/features/server';
import { redirect } from 'next/navigation';
import {
  getTranscripts,
  messageAssistant,
  getContactIdByEmail,
  getAssistantOwnerById,
  uploadAttachment,
} from '@/lib/assistants/chat';
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
import { listAssistants, updateAssistant } from '@/lib/assistants/assistant';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import AssistantCommunicationFullScreen from '@/components/Pages/Assistants/Communication/AssistantCommunicationFullScreen';
import { notFound } from 'next/navigation';
import { getActiveOrganization } from '@/lib/user/workspace';

const CallPage = async ({ params }: { params: { assistantId: string } }) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Voice calls require LiveKit credentials (Console-owned). A deployment
  // without them can't service this route — don't render a call surface that
  // would only fail to connect.
  if (!(await getServerFeatures()).voiceCalls) {
    notFound();
  }
  const apiKey = user.apiKey;
  const isOrgContext = getActiveOrganization(user) !== null;

  const assistantActions: Pick<AssistantActions, 'chat' | 'call' | 'desktop'> & {
    assistant: Pick<AssistantActions['assistant'], 'update'>;
  } = {
    assistant: {
      update: await updateAssistant(apiKey),
    },
    chat: {
      getContactId: await getContactIdByEmail(apiKey),
      getTranscripts: await getTranscripts(apiKey),
      message: await messageAssistant(apiKey),
      getAssistantOwnerById: await getAssistantOwnerById(),
      uploadAttachment: await uploadAttachment(apiKey),
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
  };

  // Include demo assistants so demoers can access them via direct URL
  const includeDemo = true;
  const listAssistantsAction = await listAssistants(apiKey, isOrgContext, includeDemo);
  const assistantsResult = await listAssistantsAction();

  if ('detail' in assistantsResult) {
    console.error('Failed to fetch assistants list in call page:', assistantsResult.detail);
    return <div>Error loading assistant data. Please close this tab and try again.</div>;
  }

  const assistant = (assistantsResult as Assistant[]).find((a) => a.agentId === params.assistantId);

  if (!assistant) {
    notFound();
  }

  const userForClient = { id: user.id, image: user.image, email: user.email };

  return (
    <AssistantCommunicationFullScreen
      assistant={assistant}
      assistantActions={assistantActions}
      user={userForClient}
    />
  );
};

export default CallPage;
