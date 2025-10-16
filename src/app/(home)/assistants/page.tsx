import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Pages/Assistants/Main";
import { getTasks, updateTask } from "@/lib/assistants/task";
import { listAssistants, createAssistant, deleteAssistant, updateAssistant, getAssistantStatus } from "@/lib/assistants/assistant";
import { uploadPhoto, uploadVideo, downloadPhoto, downloadPresetVideo, generatePhoto, editPhoto, animatePhoto, getAnimationPrediction, cancelAnimationPrediction } from "@/lib/assistants/photo";
import {
    listVoices, registerVoice, deleteVoice, cloneVoice, generateSpeech,
    designVoiceGeneratePreviews, designVoiceCreateFromPreview
} from "@/lib/assistants/voice";
import { getTranscripts, updateTranscripts, messageAssistant } from "@/lib/assistants/chat";
import { listAllAssistantEmails, listAvailablePhoneCountries, listAvailableSocialPlatforms, verifySocialAccount, deleteAssistantContact } from "@/lib/assistants/contact";
import { TaskActions } from "@/types/assistants/task";
import { AssistantActions } from "@/types/assistants/assistant";
import { ActivityLogActions } from "@/types/assistants/activity";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { getActivitySummary } from "@/lib/assistants/activity";
import { fetchCurrentUserHiringProfile, claimAssistantHiringToken, requestAssistantHiringAccess } from "@/lib/assistants/approval";
import { getSecrets, createSecret, deleteSecret } from "@/lib/assistants/secret";

const AssistantsPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;
    const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;

    const assistantActions: AssistantActions = {
        "assistant": {
            list: await listAssistants(apiKey),
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
            getTranscripts: await getTranscripts(apiKey),
            updateTranscripts: await updateTranscripts(apiKey),
            message: await messageAssistant(apiKey),
        },
        "contact": {
            delete: await deleteAssistantContact(apiKey),
            listAllAssistantEmails: await listAllAssistantEmails(adminKey),
            listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
            listAvailableSocialPlatforms: await listAvailableSocialPlatforms(adminKey),
            verifySocialAccount: await verifySocialAccount(adminKey),
        },
        "secret": {
            get: await getSecrets(apiKey),
            create: await createSecret(apiKey),
            delete: await deleteSecret(apiKey),
        },
        "approval": {
            getProfile: await fetchCurrentUserHiringProfile(),
            claimToken: await claimAssistantHiringToken(apiKey),
            requestAccess: await requestAssistantHiringAccess(apiKey)

        }
    }

    const taskActions: TaskActions = {
        get: await getTasks(apiKey),
        update: await updateTask(apiKey),
    }

    const activityLogActions: ActivityLogActions = {
        get: await getActivitySummary(apiKey),
    }

    return (
        <div className="w-full h-full">
            <Main
                assistantActions={assistantActions}
                taskActions={taskActions}
                activityLogActions={activityLogActions}
                oneTimeToken={searchParams?.token}
            />
        </div>
    );
};

export default AssistantsPage;
