import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Hire/Main";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { createAssistant, createAssistantImage } from "./actions";

const HirePage = async ({ searchParams }: { searchParams: { } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const userId = user.id;
    const apiKey = user.apiKey;

    const hireActions = {
        create: await createAssistant(apiKey),
        createImage: await createAssistantImage(userId)
    }
    return (
        <div className="w-full h-full">
            <Main hireActions={hireActions}/>
        </div>
    );
};

export default HirePage;
