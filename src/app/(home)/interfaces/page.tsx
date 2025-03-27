import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import Main from "@/components/Interfaces/Main";
import {
    getLogFields,
    deleteLogs,
    deleteProject,
    getLogMetrics,
    getLogs,
    getLatestTimestamp,
    getProjects,
    createProject,
    renameProject,
    createInterface,
    updateInterface,
    getInterface,
    deleteInterface,
    createDerivedEntry,
    updateDerivedEntry,
    createContext,
    deleteContext,
    getContexts,
    createLogs,
    runDemo,
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const InterfacesPage = async ({ searchParams }: { searchParams: { project?: string, tab?: string } }) => {
    // get user and api key
    const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;
    const user = await getCurrentUser();
    if (!user) {
        signOut();
        redirect('/login');
    }
    const userId = user.id;
    const apiKey = user.apiKey;

    // get server actions
    const projectsActions = {
        get: await getProjects(apiKey),
        create: await createProject(apiKey),
        rename: await renameProject(apiKey),
        delete: await deleteProject(apiKey)
    };

    const logsActions = {
        create: await createLogs(apiKey),
        get: await getLogs(apiKey),
        getMetrics: await getLogMetrics(apiKey),
        delete: await deleteLogs(apiKey),
        getLatest: await getLatestTimestamp(apiKey),
    }

    const derivedEntryActions = {
        create: await createDerivedEntry(apiKey),
        update: await updateDerivedEntry(apiKey)
    }

    const fieldsActions = {
        get: await getLogFields(apiKey),
    }

    const contextActions = {
        get: await getContexts(apiKey),
        create: await createContext(apiKey),
        delete: await deleteContext(apiKey)
    }

    const tabActions = {
        // TODO: In future versions, we'll support multiple interfaces per project
        create: await createInterface(apiKey),
        update: await updateInterface(apiKey),
        get: await getInterface(apiKey),
        delete: await deleteInterface(apiKey),
    }

    const demoActions = {
        run: await runDemo(adminKey, userId),
    }

    return (
        <div className="w-full h-full">
            <Suspense fallback={<SkeletonLoader />}>
                <Main
                    project={searchParams?.project}
                    tab={searchParams?.tab}
                    projectsActions={projectsActions}
                    logsActions={logsActions}
                    derivedEntryActions={derivedEntryActions}
                    contextActions={contextActions}
                    fieldsActions={fieldsActions}
                    tabActions={tabActions}
                    demoActions={demoActions}
                />
            </Suspense>
        </div>
    );
};

export default InterfacesPage;
