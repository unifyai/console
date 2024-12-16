import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Evals/Main";
import {
    deleteDataset,
    deleteLogs,
    deleteProject,
    getDatasetEntries,
    getDatasets,
    getLogMetrics,
    getLogs,
    getProjects,
    createProject,
    renameDataset,
    renameProject
} from "./actions";


const EvalsPage = async (
    { searchParams }: { searchParams: { project?: string, metric?: string, filters?: string, common_filter?: string } }
) => {
    // get user and api key
    const user = await getCurrentUser();
    if (!user) {
        return null;
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
    const datasetsActions = {
        getEntries: await getDatasetEntries(apiKey),
        get: await getDatasets(apiKey),
        rename: await renameDataset(apiKey),
        delete: await deleteDataset(apiKey)
    };

    return (
        <Suspense fallback={<SkeletonLoader />}>
            <Main
                searchParams={searchParams}
                projectsActions={projectsActions}
                logsActions={logsActions}
                datasetsActions={datasetsActions}
            />
        </Suspense>
    );
};

export default EvalsPage;
