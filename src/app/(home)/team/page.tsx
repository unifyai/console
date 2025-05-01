import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Team/Main";
import { getTasks, listAssistants, updateTask, updateAssistant, downloadPhoto, deleteAssistant, deletePhoto } from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { TaskActions } from "@/types/assistants/task";
import { AssistantActions } from "@/types/assistants/assistant";

const TeamPage = async ({ searchParams }: { searchParams: { } }) => {
    const user = await getCurrentUser();
     if (!user) {
         signOut();
         redirect('/login');
    }
    const apiKey = user.apiKey;

    const taskActions: TaskActions = {
        get: await getTasks(apiKey),
        update: await updateTask(apiKey)
    }

    const assistantActions: AssistantActions = {
        list: await listAssistants(apiKey),
        update: await updateAssistant(apiKey),
        downloadPhoto: await downloadPhoto(),
        delete: await deleteAssistant(apiKey),
        deletePhoto: await deletePhoto()
    }

    return (
        <div className="w-full h-full">
            <Main taskActions={taskActions} assistantActions={assistantActions} />
        </div>
    );
};

export default TeamPage;