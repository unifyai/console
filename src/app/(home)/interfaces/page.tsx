import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";
import MainServer from "@/components/Interfaces/Server/MainServer";
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
    createDerivedEntry,
    updateDerivedEntry,
    createContext,
    deleteContext,
    getContexts,
    createLogs,
    runCode,
    getDevbox,
    createDevbox,
    // New granular actions
    listInterfaces,
    getInterfaceByName,
    createNewInterface,
    updateInterfaceByName,
    deleteInterfaceByName,
    createInterfaceCheckpoint,
    listTabs,
    getTabByName,
    createTab,
    updateTab,
    deleteTab,
    listTiles,
    getTileByName,
    createTile,
    updateTile,
    patchTile,
    deleteTile,
    createTabCheckpoint,
    createTileCheckpoint,
    patchSpecializedTile
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { GranularInterfaceActions, GranularTabActions, GranularTileActions, TilePosition } from "@/types/evals/grid";

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

    // get server actions - Legacy actions for backward compatibility
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
    };

    const derivedEntryActions = {
        create: await createDerivedEntry(apiKey),
        update: await updateDerivedEntry(apiKey)
    };

    const fieldsActions = {
        get: await getLogFields(apiKey),
    };

    const contextActions = {
        get: await getContexts(apiKey),
        create: await createContext(apiKey),
        delete: await deleteContext(apiKey)
    };

    const codeActions = {
        run: await runCode(apiKey, userId),
    };

    const devboxActions = {
        get: await getDevbox(apiKey, userId),
        create: await createDevbox(apiKey, userId),
    };

    const interfaceActions: GranularInterfaceActions = {
        get: await getInterfaceByName(apiKey),
        create: await createNewInterface(apiKey),
        update: await updateInterfaceByName(apiKey),
        delete: await deleteInterfaceByName(apiKey),
        list: await listInterfaces(apiKey),
        checkpoint: await createInterfaceCheckpoint(apiKey),
    }

    const tabActions: GranularTabActions = {
        get: await getTabByName(apiKey),
        create: await createTab(apiKey),
        update: await updateTab(apiKey),
        delete: await deleteTab(apiKey),
        list: await listTabs(apiKey),
        checkpoint: await createTabCheckpoint(apiKey),
    };

    const tileActions: GranularTileActions = {
        get: await getTileByName(apiKey),
        create: await createTile(apiKey),
        update: await updateTile(apiKey),
        patch: await patchTile(apiKey),
        patchSpecialized: await patchSpecializedTile(apiKey),
        delete: await deleteTile(apiKey),
        list: await listTiles(apiKey),
        checkpoint: await createTileCheckpoint(apiKey),
    };

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
                    codeActions={codeActions}
                    devboxActions={devboxActions}
                    interfaceActions={interfaceActions}
                    tileActions={tileActions}
                />
            </Suspense>
        </div>
    );
};

export default InterfacesPage;
