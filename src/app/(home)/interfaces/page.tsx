import { getCurrentUser } from "@/lib/user/user";

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
    createTileCheckpointUnified,
    getInterfaceCheckpointUnified,
    getTabCheckpointById,
    getTabCheckpointUnified,
    getTileCheckpointUnified,
    getInterfaceCheckpointByName,
    getTabCheckpointByName,
    getTileCheckpointByName,
    getInterfaceCheckpointById,
    getTileCheckpointById,
    // file helpers
    listFiles,
    readFile,
    writeFiles,
    deleteFile,
    stopTerminalSession,
    createTerminalSession,
    runTerminalCommand,
    getTerminalOutput,
    renameFile,
} from "./actions";
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { GranularInterfaceActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import { createInterfaceActions, createTabActions, createTileActions } from "./utils";
import Main from "@/components/Interfaces/Server/Main.server";

const InterfacesPage = async ({ searchParams }: { searchParams: { project?: string, interface?: string } }) => {
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
        createTerminal: await createTerminalSession(apiKey, userId),
        runTerminal: await runTerminalCommand(apiKey),
        getTerminalOutput: await getTerminalOutput(apiKey),
        stopTerminal: await stopTerminalSession(apiKey),
    };

    const devboxActions = {
        get: await getDevbox(apiKey, userId),
        create: await createDevbox(apiKey, userId),
    };

    // File actions
    const fileActions = {
        list: await listFiles(apiKey, userId),
        write: await writeFiles(apiKey, userId),
        read: await readFile(apiKey, userId),
        delete: await deleteFile(apiKey, userId),
        rename: await renameFile(apiKey, userId),
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
        getInterfaceCheckpointByName,
        getInterfaceCheckpointById,
        getInterfaceCheckpointUnified,
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
        getTabCheckpointByName,
        getTabCheckpointById,
        getTabCheckpointUnified,
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
        getTileCheckpointByName,
        getTileCheckpointById,
        getTileCheckpointUnified,
        apiKey
    );

    return (
        <Main
            project={searchParams?.project ?? null}
            interface_={searchParams?.interface ?? null}
            actions={
                {
                    projectsActions,
                    logsActions,
                    derivedEntryActions,
                    contextActions,
                    fieldsActions,
                    codeActions,
                    fileActions,
                    devboxActions,
                    interfaceActions,
                    tabActions,
                    tileActions
                }
            }
        />
    );
};

export default InterfacesPage;
