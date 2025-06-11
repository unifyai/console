import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Team/Main";
import { getTasks, updateTask } from "@/lib/team/task";
import { listAssistants, createAssistant, deleteAssistant, updateAssistant } from "@/lib/team/assistant";
import { uploadPhoto, downloadPhoto, downloadPresetVideo } from "@/lib/team/photo";
import { listVoices, registerVoice, deleteVoice, cloneVoice, localizeVoice } from "@/lib/team/voice"; 
import { listAllAssistantEmails } from "@/lib/team/contact";
import { TaskActions } from "@/types/team/task";
import { AssistantActions } from "@/types/team/assistant";
import { ActivityLogActions } from "@/types/team/activity";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/team/activity";
import { fetchCurrentUserHiringProfile, claimAssistantHiringToken, requestAssistantHiringAccess } from "@/lib/team/approval";

const TeamPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login'); 
    }
    const apiKey = user.apiKey;
    const userId = user.id;

    const assistantActions: AssistantActions = {
        "assistant": {
            list: await listAssistants(apiKey),
            create: await createAssistant(apiKey),
            update: await updateAssistant(apiKey),
            delete: await deleteAssistant(apiKey),
        },
        "photo": {
            upload: await uploadPhoto(apiKey),
            download: await downloadPhoto(),
            downloadPresetVideo: await downloadPresetVideo(),
        },
        "voice": {
            list: await listVoices(apiKey),
            register: await registerVoice(apiKey),
            delete: await deleteVoice(apiKey),
            clone: await cloneVoice(apiKey),
            localize: await localizeVoice(apiKey),
        },
        "contact": {
            listAllAssistantEmails: await listAllAssistantEmails(apiKey),
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
        get: await getMessages(apiKey),
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

export default TeamPage;