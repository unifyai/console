import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Hire/Main";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { createAssistant, updateAssistant, createAssistantImage } from "./actions";

const HirePage = async ({ searchParams }: { searchParams: { } }) => {
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;

    const hireActions = {
        create: await createAssistant(apiKey),
        update: await updateAssistant(apiKey),
        createImage: await createAssistantImage()
    }
    return (
        <div className="w-full h-full">
            <Suspense fallback={<SkeletonLoader />}>
                <Main hireActions={hireActions}/>
            </Suspense>
        </div>
    );
};

export default HirePage;
