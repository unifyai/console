import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Pages/Assistants/Main";
import { getTasks, updateTask } from "@/lib/assistants/task";
import { listAssistants, createAssistant, deleteAssistant, updateAssistant, getAssistantStatus } from "@/lib/assistants/assistant";
import { uploadPhoto, uploadVideo, downloadPhoto, downloadPresetVideo, generatePhoto, editPhoto, animatePhoto } from "@/lib/assistants/photo";
import {
    listVoices, registerVoice, deleteVoice, cloneVoice, generateSpeech,
    designVoiceGeneratePreviews, designVoiceCreateFromPreview
} from "@/lib/assistants/voice";
import { listAllAssistantEmails, listAvailablePhoneCountries, listAvailableSocialPlatforms, verifySocialAccount } from "@/lib/assistants/contact";
import { TaskActions } from "@/types/assistants/task";
import { AssistantActions } from "@/types/assistants/assistant";
import { ActivityLogActions } from "@/types/assistants/activity";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { getActivitySummary } from "@/lib/assistants/activity";
import { fetchCurrentUserHiringProfile, claimAssistantHiringToken, requestAssistantHiringAccess } from "@/lib/assistants/approval";

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
        "contact": {
            listAllAssistantEmails: await listAllAssistantEmails(adminKey),
            listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
            listAvailableSocialPlatforms: await listAvailableSocialPlatforms(adminKey),
            verifySocialAccount: await verifySocialAccount(adminKey),
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