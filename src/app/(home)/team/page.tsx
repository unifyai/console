import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Team/Main";
import { 
    getTasks, 
    updateTask,
    getUniqueFieldValues,
    listAssistants, 
    createAssistant,
    deleteAssistant, 
    updateAssistant, 
    uploadPhoto,
    downloadPhoto, 
    deletePhoto,
} from "./actions";
import { TaskActions } from "@/types/team/task";
import { AssistantActions } from "@/types/team/assistant";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

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
        }
    }
    
    const taskActions: TaskActions = {
        get: await getTasks(apiKey),
        update: await updateTask(apiKey),
        unique: await getUniqueFieldValues(apiKey),
    }

    return (
        <div className="w-full h-full">
            <Main assistantActions={assistantActions} taskActions={taskActions}/>
        </div>
    );
};

export default TeamPage;