import { getCurrentUser } from "@/lib/user/user";
import { redirect } from "next/navigation";
import { getTranscripts, messageAssistant } from "@/lib/assistants/chat";
import { getCallConnectionDetails, dispatchAssistantToCall } from "@/lib/assistants/call";
import { getLiveviewUrl, sendSystemEvent } from "@/lib/assistants/desktop";
import { listAssistants } from "@/lib/assistants/assistant";
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import AssistantCommunicationFullScreen from '@/components/Pages/Assistants/Communication/AssistantCommunicationFullScreen';
import { notFound } from 'next/navigation';

const CallPage = async ({ params }: { params: { assistantId: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }
    const userName = `${user.name}${user.lastName}`;
    const apiKey = user.apiKey;
    const isOrgContext = user.organizations?.some(org => org.apiKey === apiKey) ?? false;

    const assistantActions: Pick<AssistantActions, "chat" | "call" | "desktop"> = {
        "chat": {
            getTranscripts: await getTranscripts(apiKey, userName),
            message: await messageAssistant(apiKey),
        },
        "call": {
            getConnectionDetails: await getCallConnectionDetails(apiKey),
            dispatchToCall: await dispatchAssistantToCall(apiKey),
        },
        "desktop": {
            getLiveviewUrl: await getLiveviewUrl(user.id, user.apiKey),
            sendSystemEvent: await sendSystemEvent(),
        }
    };

    const listAssistantsAction = await listAssistants(apiKey, isOrgContext);
    const assistantsResult = await listAssistantsAction();

    if ('detail' in assistantsResult) {
        console.error("Failed to fetch assistants list in call page:", assistantsResult.detail);
        return <div>Error loading assistant data. Please close this tab and try again.</div>;
    }

    const assistant = (assistantsResult as Assistant[]).find((a) => a.agent_id === params.assistantId);

    if (!assistant) {
        notFound();
    }

    const userForClient = { id: user.id, image: user.image };

    return (
        <AssistantCommunicationFullScreen assistant={assistant} assistantActions={assistantActions} user={userForClient} />
    );
};

export default CallPage;