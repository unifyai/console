import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Team/Main";
import { getTasks, updateTask } from "@/lib/team/task";
import { listAssistants, createAssistant, deleteAssistant, updateAssistant } from "@/lib/team/assistant";
import { uploadPhoto, downloadPhoto, deletePhoto } from "@/lib/team/photo";
import { listVoicesFromOrchestra,createVoiceInOrchestra, deleteVoiceFromOrchestra, cloneVoiceOnCartesia, localizeVoiceOnCartesia, deleteVoiceFromCartesia  } from "@/lib/team/voice";
import { createAssistantEmail, createAssistantPhoneNumber, deleteAssistantEmail, deleteAssistantPhoneNumber, listAllAssistantEmails, createAssistantWhatsApp, deleteAssistantWhatsApp } from "@/lib/team/contact";
import { TaskActions } from "@/types/team/task";
import { AssistantActions } from "@/types/team/assistant";
import { ActivityLogActions } from "@/types/team/activity";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/team/activity";

const TeamPage = async ({ searchParams }: { searchParams: { } }) => {
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
            upload: await uploadPhoto(userId),
            download: await downloadPhoto(),
            delete: await deletePhoto()
        },
        "voice": {
            // Orchestra DB Voice Management
            listVoicesFromOrchestra: await listVoicesFromOrchestra(apiKey),
            createVoiceInOrchestra: await createVoiceInOrchestra(apiKey),
            deleteVoiceFromOrchestra: await deleteVoiceFromOrchestra(apiKey),
            // Cartesia Operations (via Frontend Proxies)
            cloneVoiceOnCartesia: await cloneVoiceOnCartesia(apiKey), // apiKey for proxy auth
            localizeVoiceOnCartesia: await localizeVoiceOnCartesia(apiKey),
            deleteVoiceFromCartesia: await deleteVoiceFromCartesia(apiKey),
        },
        "contact": {
            createEmail: await createAssistantEmail(apiKey),
            createPhoneNumber: await createAssistantPhoneNumber(apiKey),
            deleteEmail: await deleteAssistantEmail(apiKey),
            deletePhoneNumber: await deleteAssistantPhoneNumber(apiKey),
            listAllAssistantEmails: await listAllAssistantEmails(apiKey),
            createWhatsApp: await createAssistantWhatsApp(apiKey),
            deleteWhatsApp: await deleteAssistantWhatsApp(apiKey),
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
            <Main assistantActions={assistantActions} taskActions={taskActions} activityLogActions={activityLogActions} />
        </div>
    );
};

export default TeamPage;