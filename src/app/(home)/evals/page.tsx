import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Evals/Main";
import {
    deleteLogs,
    deleteProject,
    getLogMetrics,
    getLogs,
    getProjects,
    createProject,
    renameProject
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";


const EvalsPage = async (
    { searchParams }: { searchParams: { project?: string, metric?: string, filters?: string, common_filter?: string } }
) => {
    // get user and api key
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const apiKey = user.apiKey;

    // get server actions
    const projectsActions = {
        get: await getProjects(apiKey),
        create: await createProject(apiKey),
        rename: await renameProject(apiKey),
        delete: await deleteProject(apiKey)
    };
    const logsActions = { get: await getLogs(apiKey), getMetrics: await getLogMetrics(apiKey), delete: await deleteLogs(apiKey) }

    return (
        <Suspense fallback={<SkeletonLoader />}>
            <Main
                searchParams={searchParams}
                projectsActions={projectsActions}
                logsActions={logsActions}
            />
        </Suspense>
    );
};

export default EvalsPage;
