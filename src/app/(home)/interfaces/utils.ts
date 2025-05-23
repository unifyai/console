import { GranularInterfaceActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";

/*
 Utility function to sanitize keys.
 Removes "Parameters/" or "Entries/" from the beginning of the string if they exist.
 */
export function sanitizeKey(key: string): string {
    if (key.startsWith("Parameters/")) {
        return key.slice("Parameters/".length);
    }
    if (key.startsWith("Entries/")) {
        return key.slice("Entries/".length);
    }
    return key;
}

/**
 * Creates a GranularInterfaceActions object from server actions
 */
export async function createInterfaceActions(
    listInterfaces: Function,
    getInterfaceByName: Function,
    getInterfaceById: Function,
    createNewInterface: Function,
    updateInterfaceByName: Function,
    updateInterfaceById: Function,
    deleteInterfaceByName: Function, 
    deleteInterfaceById: Function,
    createInterfaceCheckpoint: Function,
    createInterfaceCheckpointById: Function,
    getInterfaceUnified: Function,
    updateInterfaceUnified: Function,
    deleteInterfaceUnified: Function,
    createInterfaceCheckpointUnified: Function,
    getInterfaceCheckpointByName: Function,
    getInterfaceCheckpointById: Function,
    getInterfaceCheckpointUnified: Function,
    apiKey: string
): Promise<GranularInterfaceActions> {
    return {
        list: await listInterfaces(apiKey),
        getByName: await getInterfaceByName(apiKey),
        getById: await getInterfaceById(apiKey),
        get: await getInterfaceUnified(apiKey),
        create: await createNewInterface(apiKey),
        updateByName: await updateInterfaceByName(apiKey),
        updateById: await updateInterfaceById(apiKey),
        update: await updateInterfaceUnified(apiKey),
        deleteByName: await deleteInterfaceByName(apiKey),
        deleteById: await deleteInterfaceById(apiKey),
        delete: await deleteInterfaceUnified(apiKey),
        checkpointByName: await createInterfaceCheckpoint(apiKey),
        checkpointById: await createInterfaceCheckpointById(apiKey),
        checkpoint: await createInterfaceCheckpointUnified(apiKey),
        getCheckpointByName: await getInterfaceCheckpointByName(apiKey),
        getCheckpointById: await getInterfaceCheckpointById(apiKey),
        getCheckpoint: await getInterfaceCheckpointUnified(apiKey)
    };
}

/**
 * Creates a GranularTabActions object from server actions
 */
export async function createTabActions(
    listTabs: Function,
    getTabByName: Function,
    getTabById: Function,
    getTabUnified: Function,
    createTab: Function,
    updateTabByName: Function,
    updateTabById: Function,
    updateTabUnified: Function,
    deleteTabByName: Function,
    deleteTabById: Function,
    deleteTabUnified: Function,
    createTabCheckpointByName: Function,
    createTabCheckpointById: Function,
    createTabCheckpointUnified: Function,
    getTabCheckpointByName: Function,
    getTabCheckpointById: Function,
    getTabCheckpointUnified: Function,
    apiKey: string
): Promise<GranularTabActions> {
    return {
        list: await listTabs(apiKey),
        getByName: await getTabByName(apiKey),
        getById: await getTabById(apiKey),
        get: await getTabUnified(apiKey),
        getTabWithTilesByName: await getTabByName(apiKey), // Same as getTabByName
        getTabWithTilesById: await getTabById(apiKey),    // Same as getTabById
        getTabWithTiles: await getTabUnified(apiKey),     // Same as getTabUnified
        create: await createTab(apiKey),
        updateByName: await updateTabByName(apiKey),
        updateById: await updateTabById(apiKey),
        update: await updateTabUnified(apiKey),
        deleteByName: await deleteTabByName(apiKey),
        deleteById: await deleteTabById(apiKey),
        delete: await deleteTabUnified(apiKey),
        checkpointByName: await createTabCheckpointByName(apiKey),
        checkpointById: await createTabCheckpointById(apiKey),
        checkpoint: await createTabCheckpointUnified(apiKey),
        getCheckpointByName: await getTabCheckpointByName(apiKey),
        getCheckpointById: await getTabCheckpointById(apiKey),
        getCheckpoint: await getTabCheckpointUnified(apiKey)
    };
}

/**
 * Creates a GranularTileActions object from server actions
 */
export async function createTileActions(
    listTiles: Function,
    getTileByName: Function,
    getTileById: Function,
    getTileUnified: Function,
    createTile: Function,
    updateTileByName: Function,
    updateTileById: Function,
    updateTileUnified: Function,
    patchTileByName: Function,
    patchTileById: Function,
    patchTileUnified: Function,
    patchSpecializedTileByName: Function,
    patchSpecializedTileById: Function,
    patchSpecializedTileUnified: Function,
    deleteTileByName: Function,
    deleteTileById: Function,
    deleteTileUnified: Function,
    createTileCheckpointByName: Function,
    createTileCheckpointById: Function,
    createTileCheckpointUnified: Function,
    getTileCheckpointByName: Function,
    getTileCheckpointById: Function,
    getTileCheckpointUnified: Function,
    apiKey: string
): Promise<GranularTileActions> {
    return {
        list: await listTiles(apiKey),
        getByName: await getTileByName(apiKey),
        getById: await getTileById(apiKey),
        get: await getTileUnified(apiKey),
        create: await createTile(apiKey),
        updateByName: await updateTileByName(apiKey),
        updateById: await updateTileById(apiKey),
        update: await updateTileUnified(apiKey),
        patchByName: await patchTileByName(apiKey),
        patchById: await patchTileById(apiKey), 
        patch: await patchTileUnified(apiKey),
        patchSpecializedByName: await patchSpecializedTileByName(apiKey),
        patchSpecializedById: await patchSpecializedTileById(apiKey),
        patchSpecialized: await patchSpecializedTileUnified(apiKey),
        deleteByName: await deleteTileByName(apiKey),
        deleteById: await deleteTileById(apiKey),
        delete: await deleteTileUnified(apiKey),
        checkpointByName: await createTileCheckpointByName(apiKey),
        checkpointById: await createTileCheckpointById(apiKey),
        checkpoint: await createTileCheckpointUnified(apiKey),
        getCheckpointByName: await getTileCheckpointByName(apiKey),
        getCheckpointById: await getTileCheckpointById(apiKey),
        getCheckpoint: await getTileCheckpointUnified(apiKey)
    };
}
