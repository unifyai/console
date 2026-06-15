import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
} from '@/types/interfaces/grid';

/*
 Utility function to sanitize keys.
 Removes "Parameters/" or "Entries/" from the beginning of the string if they exist.
 */
export function sanitizeKey(key: string): string {
  if (key.startsWith('Parameters/')) {
    return key.slice('Parameters/'.length);
  }
  if (key.startsWith('Entries/')) {
    return key.slice('Entries/'.length);
  }
  return key;
}

export function createInterfaceActions(
  listInterfaces: GranularInterfaceActions['list'],
  getInterfaceByName: GranularInterfaceActions['getByName'],
  getInterfaceById: GranularInterfaceActions['getById'],
  createNewInterface: GranularInterfaceActions['create'],
  updateInterfaceByName: GranularInterfaceActions['updateByName'],
  updateInterfaceById: GranularInterfaceActions['updateById'],
  deleteInterfaceByName: GranularInterfaceActions['deleteByName'],
  deleteInterfaceById: GranularInterfaceActions['deleteById'],
  createInterfaceCheckpoint: GranularInterfaceActions['checkpointByName'],
  createInterfaceCheckpointById: GranularInterfaceActions['checkpointById'],
  getInterfaceUnified: GranularInterfaceActions['get'],
  updateInterfaceUnified: GranularInterfaceActions['update'],
  deleteInterfaceUnified: GranularInterfaceActions['delete'],
  createInterfaceCheckpointUnified: GranularInterfaceActions['checkpoint'],
  getInterfaceCheckpointByName: GranularInterfaceActions['getCheckpointByName'],
  getInterfaceCheckpointById: GranularInterfaceActions['getCheckpointById'],
  getInterfaceCheckpointUnified: GranularInterfaceActions['getCheckpoint'],
  exportInterfaceAsTemplate: GranularInterfaceActions['exportTemplate'],
  importInterfaceFromTemplate: GranularInterfaceActions['importTemplate']
): GranularInterfaceActions {
  return {
    list: listInterfaces,
    getByName: getInterfaceByName,
    getById: getInterfaceById,
    get: getInterfaceUnified,
    create: createNewInterface,
    updateByName: updateInterfaceByName,
    updateById: updateInterfaceById,
    update: updateInterfaceUnified,
    deleteByName: deleteInterfaceByName,
    deleteById: deleteInterfaceById,
    delete: deleteInterfaceUnified,
    checkpointByName: createInterfaceCheckpoint,
    checkpointById: createInterfaceCheckpointById,
    checkpoint: createInterfaceCheckpointUnified,
    getCheckpointByName: getInterfaceCheckpointByName,
    getCheckpointById: getInterfaceCheckpointById,
    getCheckpoint: getInterfaceCheckpointUnified,
    exportTemplate: exportInterfaceAsTemplate,
    importTemplate: importInterfaceFromTemplate,
  };
}

export function createTabActions(
  listTabs: GranularTabActions['list'],
  getTabByName: GranularTabActions['getByName'],
  getTabById: GranularTabActions['getById'],
  getTabUnified: GranularTabActions['get'],
  createTab: GranularTabActions['create'],
  updateTabByName: GranularTabActions['updateByName'],
  updateTabById: GranularTabActions['updateById'],
  updateTabUnified: GranularTabActions['update'],
  deleteTabByName: GranularTabActions['deleteByName'],
  deleteTabById: GranularTabActions['deleteById'],
  deleteTabUnified: GranularTabActions['delete'],
  createTabCheckpointByName: GranularTabActions['checkpointByName'],
  createTabCheckpointById: GranularTabActions['checkpointById'],
  createTabCheckpointUnified: GranularTabActions['checkpoint'],
  getTabCheckpointByName: GranularTabActions['getCheckpointByName'],
  getTabCheckpointById: GranularTabActions['getCheckpointById'],
  getTabCheckpointUnified: GranularTabActions['getCheckpoint'],
  exportTabAsTemplate: GranularTabActions['exportTemplate'],
  importTabFromTemplate: GranularTabActions['importTemplate']
): GranularTabActions {
  return {
    list: listTabs,
    getByName: getTabByName,
    getById: getTabById,
    get: getTabUnified,
    getTabWithTilesByName: getTabByName,
    getTabWithTilesById: getTabById,
    getTabWithTiles: getTabUnified,
    create: createTab,
    updateByName: updateTabByName,
    updateById: updateTabById,
    update: updateTabUnified,
    deleteByName: deleteTabByName,
    deleteById: deleteTabById,
    delete: deleteTabUnified,
    checkpointByName: createTabCheckpointByName,
    checkpointById: createTabCheckpointById,
    checkpoint: createTabCheckpointUnified,
    getCheckpointByName: getTabCheckpointByName,
    getCheckpointById: getTabCheckpointById,
    getCheckpoint: getTabCheckpointUnified,
    exportTemplate: exportTabAsTemplate,
    importTemplate: importTabFromTemplate,
  };
}

export function createTileActions(
  listTiles: GranularTileActions['list'],
  getTileByName: GranularTileActions['getByName'],
  getTileById: GranularTileActions['getById'],
  getTileUnified: GranularTileActions['get'],
  createTile: GranularTileActions['create'],
  updateTileByName: GranularTileActions['updateByName'],
  updateTileById: GranularTileActions['updateById'],
  updateTileUnified: GranularTileActions['update'],
  patchTileByName: GranularTileActions['patchByName'],
  patchTileById: GranularTileActions['patchById'],
  patchTileUnified: GranularTileActions['patch'],
  patchSpecializedTileByName: GranularTileActions['patchSpecializedByName'],
  patchSpecializedTileById: GranularTileActions['patchSpecializedById'],
  patchSpecializedTileUnified: GranularTileActions['patchSpecialized'],
  deleteTileByName: GranularTileActions['deleteByName'],
  deleteTileById: GranularTileActions['deleteById'],
  deleteTileUnified: GranularTileActions['delete'],
  createTileCheckpointByName: GranularTileActions['checkpointByName'],
  createTileCheckpointById: GranularTileActions['checkpointById'],
  createTileCheckpointUnified: GranularTileActions['checkpoint'],
  getTileCheckpointByName: GranularTileActions['getCheckpointByName'],
  getTileCheckpointById: GranularTileActions['getCheckpointById'],
  getTileCheckpointUnified: GranularTileActions['getCheckpoint'],
  exportTileAsTemplate: GranularTileActions['exportTemplate'],
  importTileFromTemplate: GranularTileActions['importTemplate']
): GranularTileActions {
  return {
    list: listTiles,
    getByName: getTileByName,
    getById: getTileById,
    get: getTileUnified,
    create: createTile,
    updateByName: updateTileByName,
    updateById: updateTileById,
    update: updateTileUnified,
    patchByName: patchTileByName,
    patchById: patchTileById,
    patch: patchTileUnified,
    patchSpecializedByName: patchSpecializedTileByName,
    patchSpecializedById: patchSpecializedTileById,
    patchSpecialized: patchSpecializedTileUnified,
    deleteByName: deleteTileByName,
    deleteById: deleteTileById,
    delete: deleteTileUnified,
    checkpointByName: createTileCheckpointByName,
    checkpointById: createTileCheckpointById,
    checkpoint: createTileCheckpointUnified,
    getCheckpointByName: getTileCheckpointByName,
    getCheckpointById: getTileCheckpointById,
    getCheckpoint: getTileCheckpointUnified,
    exportTemplate: exportTileAsTemplate,
    importTemplate: importTileFromTemplate,
  };
}
