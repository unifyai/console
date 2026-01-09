import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Pages/Assistants/Main";
import { getTasks, updateTask } from "@/lib/assistants/task";
import { listAssistants, createAssistant, deleteAssistant, updateAssistant, getAssistantStatus, checkHiringFunds } from "@/lib/assistants/assistant";
import { uploadPhoto, uploadVideo, downloadPhoto, downloadPresetVideo, generatePhoto, editPhoto, animatePhoto, getAnimationPrediction, cancelAnimationPrediction } from "@/lib/assistants/photo";
import {
    listVoices, registerVoice, deleteVoice, cloneVoice, generateSpeech,
    designVoiceGeneratePreviews, designVoiceCreateFromPreview
} from "@/lib/assistants/voice";
import { getTranscripts, messageAssistant, getContactIdByEmail, getAssistantOwnerById, triggerContactSync } from "@/lib/assistants/chat";
import { listAllAssistantEmails, listAvailablePhoneCountries, listAvailableSocialPlatforms, verifySocialAccount, deleteAssistantContact } from "@/lib/assistants/contact";
import { TaskActions } from "@/types/assistants/task";
import { AssistantActions } from "@/types/assistants/assistant";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { fetchCurrentUserHiringProfile, claimAssistantHiringToken, requestAssistantHiringAccess } from "@/lib/assistants/approval";
import { getSecrets, createSecret, deleteSecret } from "@/lib/assistants/secret";
import { getCallConnectionDetails, dispatchAssistantToCall } from "@/lib/assistants/call";
import { getLiveviewUrl, sendSystemEvent } from "@/lib/assistants/desktop";

const AssistantsPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;
    const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;
    const userName = `${user.name}${user.lastName}`;
    const isOrgContext = user.organizations?.some(org => org.apiKey === apiKey) ?? false;

    const assistantActions: AssistantActions = {
        "assistant": {
            list: await listAssistants(apiKey, isOrgContext),
            check: await checkHiringFunds(apiKey),
            create: await createAssistant(apiKey),
            update: await updateAssistant(apiKey),
            delete: await deleteAssistant(apiKey),
            status: await getAssistantStatus(adminKey),
        },
        "photo": {
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
        "voice": {
            list: await listVoices(apiKey),
            register: await registerVoice(apiKey),
            delete: await deleteVoice(apiKey),
            clone: await cloneVoice(apiKey),
            generate: await generateSpeech(apiKey),
            preview: await designVoiceGeneratePreviews(apiKey),
            design: await designVoiceCreateFromPreview(apiKey),
        },
        "chat": {
            getContactId: await getContactIdByEmail(apiKey),
            getTranscripts: await getTranscripts(apiKey),
            message: await messageAssistant(apiKey),
            getAssistantOwnerById: await getAssistantOwnerById(),
            triggerContactSync: await triggerContactSync(),
        },
        "contact": {
            delete: await deleteAssistantContact(apiKey),
            listAllAssistantEmails: await listAllAssistantEmails(adminKey),
            listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
            listAvailableSocialPlatforms: await listAvailableSocialPlatforms(adminKey),
            verifySocialAccount: await verifySocialAccount(adminKey),
        },
        "secret": {
            get: await getSecrets(apiKey, userName),
            create: await createSecret(apiKey, userName),
            delete: await deleteSecret(apiKey, userName),
        },
        "approval": {
            getProfile: await fetchCurrentUserHiringProfile(),
            claimToken: await claimAssistantHiringToken(apiKey),
            requestAccess: await requestAssistantHiringAccess(apiKey)

        },
        "call": {
            getConnectionDetails: await getCallConnectionDetails(apiKey),
            dispatchToCall: await dispatchAssistantToCall(apiKey),
        },
        "desktop": {
            getLiveviewUrl: await getLiveviewUrl(user.id, user.apiKey),
            sendSystemEvent: await sendSystemEvent(),
        }
    }

    const taskActions: TaskActions = {
        get: await getTasks(apiKey, userName),
        update: await updateTask(apiKey, userName),
    }

    const userMeta = { image: user.image, timezone: user.timezone, email: user.email };

    return (
        <div className="w-full h-full">
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