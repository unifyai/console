import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Evals/Main";
import {
    getLogFields,
    deleteLogs,
    deleteProject,
    getLogMetrics,
    getLogs,
    getLatestTimestamp,
    getProjects,
    createProject,
    renameProject
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";


const EvalsPage = async (
    { searchParams }: {
        searchParams: {
            project?: string,
            page_number?: string,
            metric?: string,
            filters?: string,
            common_filter?: string
        }
    }
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

    const logsActions = {
        get: await getLogs(apiKey),
        getMetrics: await getLogMetrics(apiKey),
        delete: await deleteLogs(apiKey),
        getLatest: await getLatestTimestamp(apiKey)
    }

    const fieldsActions = {
        get: await getLogFields(apiKey),
    }
    return (
        <div className="w-full h-full p-1 overflow-auto">
            <Suspense fallback={<SkeletonLoader />}>
                <Main
                    searchParams={searchParams}
                    projectsActions={projectsActions}
                    logsActions={logsActions}
                    fieldsActions={fieldsActions}
                />
            </Suspense>
        </div>
    );
};

export default EvalsPage;
