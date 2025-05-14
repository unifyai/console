import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import { Suspense } from "react";

import {
    getLogFields,
    deleteLogs,
    updateLogs,
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
    // Interface actions
    listInterfaces,
    getInterfaceByName,
    getInterfaceById,
    getInterfaceUnified,
    createNewInterface,
    updateInterfaceByName,
    updateInterfaceById,
    updateInterfaceUnified,
    deleteInterfaceByName,
    deleteInterfaceById,
    deleteInterfaceUnified,
    createInterfaceCheckpoint,
    createInterfaceCheckpointById,
    createInterfaceCheckpointUnified,
    // Tab actions
    listTabs,
    getTabByName,
    getTabById,
    getTabUnified,
    createTab,
    updateTabByName,
    updateTabById,
    updateTabUnified,
    deleteTabByName,
    deleteTabById,
    deleteTabUnified,
    createTabCheckpointByName,
    createTabCheckpointById,
    createTabCheckpointUnified,
    // Tile actions
    listTiles,
    getTileByName,
    getTileById,
    getTileUnified,
    createTile,
    updateTileByName,
    updateTileById,
    updateTileUnified,
    patchTileByName,
    patchTileById,
    patchTileUnified,
    patchSpecializedTileByName,
    patchSpecializedTileById,
    patchSpecializedTileUnified,
    deleteTileByName,
    deleteTileById,
    deleteTileUnified,
    createTileCheckpointByName,
    createTileCheckpointById,
    createTileCheckpointUnified
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { GranularInterfaceActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import InterfaceWrapper from "@/components/Interfaces/Server/InterfaceWrapper.server";
import { createInterfaceActions, createTabActions, createTileActions } from "./utils";

const InterfacesPage = async ({ searchParams }: { searchParams: { project?: string, interface?: string, tab?: string } }) => {
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
        update: await updateLogs(apiKey)
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

    // Create the granular actions using the factory functions
    const interfaceActions: GranularInterfaceActions = await createInterfaceActions(
        listInterfaces,
        getInterfaceByName, 
        getInterfaceById, 
        createNewInterface, 
        updateInterfaceByName, 
        updateInterfaceById, 
        deleteInterfaceByName, 
        deleteInterfaceById, 
        createInterfaceCheckpoint,
        createInterfaceCheckpointById,
        getInterfaceUnified,
        updateInterfaceUnified,
        deleteInterfaceUnified,
        createInterfaceCheckpointUnified,
        apiKey
    );

    const tabActions: GranularTabActions = await createTabActions(
        listTabs,
        getTabByName,
        getTabById,
        getTabUnified,
        createTab,
        updateTabByName,
        updateTabById,
        updateTabUnified,
        deleteTabByName,
        deleteTabById,
        deleteTabUnified,
        createTabCheckpointByName,
        createTabCheckpointById,
        createTabCheckpointUnified,
        apiKey
    );

    const tileActions: GranularTileActions = await createTileActions(
        listTiles,
        getTileByName,
        getTileById,
        getTileUnified,
        createTile,
        updateTileByName,
        updateTileById, 
        updateTileUnified,
        patchTileByName,
        patchTileById,
        patchTileUnified,
        patchSpecializedTileByName,
        patchSpecializedTileById,
        patchSpecializedTileUnified,
        deleteTileByName,
        deleteTileById,
        deleteTileUnified,
        createTileCheckpointByName,
        createTileCheckpointById,
        createTileCheckpointUnified,
        apiKey
    );

    return (
        <div className="w-full h-full">
            <Suspense fallback={<SkeletonLoader />}>
                <InterfaceWrapper
                    project={searchParams?.project ?? null}
                    interface_={searchParams?.interface ?? null}
                    tab={searchParams?.tab}
                    actions={
                        {
                            projectsActions,
                            logsActions,
                            derivedEntryActions,
                            contextActions,
                            fieldsActions,
                            codeActions,
                            devboxActions,
                            interfaceActions,
                            tabActions,
                            tileActions
                        }
                    }
                />
            </Suspense>
        </div>
    );
};

export default InterfacesPage;
