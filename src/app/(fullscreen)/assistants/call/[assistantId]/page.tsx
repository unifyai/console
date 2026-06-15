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
  getDesktopApiKey,
  listUserDesktops,
  linkDesktop,
  unlinkDesktop,
} from '@/lib/assistants/desktop';
import { listAssistants, updateAssistant } from '@/lib/assistants/assistant';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import AssistantCommunicationFullScreen from '@/components/Pages/Assistants/Communication/AssistantCommunicationFullScreen';
import { notFound } from 'next/navigation';
import { getActiveOrganization } from '@/lib/user/workspace';

const CallPage = async ({ params }: { params: Promise<{ assistantId: string }> }) => {
  const { assistantId } = await params;
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
  const isOrgContext = getActiveOrganization(user) !== null;

  const assistantActions: Pick<AssistantActions, 'chat' | 'call' | 'desktop'> & {
    assistant: Pick<AssistantActions['assistant'], 'update'>;
  } = {
    assistant: {
      update: updateAssistant,
    },
    chat: {
      getContactId: getContactIdByEmail,
      getTranscripts,
      message: messageAssistant,
      getAssistantOwnerById,
      uploadAttachment,
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
    },
  };

  const includeDemo = true;
  const assistantsResult = await listAssistants(isOrgContext, includeDemo);

  if ('detail' in assistantsResult) {
    console.error('Failed to fetch assistants list in call page:', assistantsResult.detail);
    return <div>Error loading assistant data. Please close this tab and try again.</div>;
  }

  const assistant = (assistantsResult as Assistant[]).find((a) => a.agentId === assistantId);

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
