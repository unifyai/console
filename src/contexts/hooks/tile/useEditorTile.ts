import { useMemo } from "react";
import { EditorTileMeta, EditorTileData, EditorTileUI } from "../../slices/selectors/editorTile";
import { useStoreContext } from "../../providers/StoreProvider";
import { useTileMeta } from "./useTileMeta";
import { EditorTile } from '../../slices/selectors/editorTile';
import { useShallow } from "zustand/react/shallow";

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_EDITOR_TILE_RETURN = {
  editorTile: null,
  editorTileActions: null,
  exists: false
};

// Default editor tile meta
export const DEFAULT_EDITOR_TILE_META: EditorTileMeta = {};

// Default editor tile UI
export const DEFAULT_EDITOR_TILE_UI: EditorTileUI = {};

// Default editor tile UI actions
export const DEFAULT_EDITOR_TILE_UI_ACTIONS: EditorTileUIActions = {};

// Default editor tile meta actions
export const DEFAULT_EDITOR_TILE_META_ACTIONS: EditorTileMetaActions = {};

/**
 * Interface for editor tile meta actions
 */
export interface EditorTileMetaActions {
  // Meta actions will be empty as per EditorTileMeta
}

/**
 * Interface for editor tile data actions
 */
export interface EditorTileDataActions {
  setFileName: (fileName: string | undefined) => void;
  setFileType: (fileType: "py" | "txt" | "json" | undefined) => void;
  setContent: (content: string) => void;
}

/**
 * Interface for editor tile UI actions
 */
export interface EditorTileUIActions {
  // UI actions will be empty as per EditorTileUI
}

/**
 * Interface for editor-specific actions
 */
export interface EditorActions extends
  EditorTileMetaActions,
  EditorTileDataActions,
  EditorTileUIActions {}

/**
 * Custom hook to access editor-specific tile state and actions
 * @param tileName The name of the tile to access
 * @param tabName Optional name of the tab containing the tile
 * @param interfaceName Optional name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing editor-specific tile state, actions, and existence flag
 */
export function useEditorTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName || null);
  
  // Get the tile type to check if it's an editor
  const tileType = useStoreContext(
    useShallow(state => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );
  
  // Check if the tile exists and is an editor
  const isEditorTile = tileExists && tileType === 'Editor';

  const editorTile = useStoreContext(
    useShallow(state => {
      if (!isEditorTile || !tileId) return null;
      return state.tilesById[tileId]?.editorTile as EditorTile;
    })
  );

  // Access store for editor-specific meta data
  const editorMeta = useMemo(() => {
    // Return empty object as per EditorTileMeta interface
    return DEFAULT_EDITOR_TILE_META as EditorTileMeta;
  }, []);

  // Access store for editor-specific data
  const editorData = useMemo(() => {
    if (!isEditorTile || !tileId || !editorTile) return null;
    
    return {
      file_name: editorTile.file_name,
      file_type: editorTile.file_type,
      content: editorTile.content
    } as EditorTileData;
  }, [
    isEditorTile,
    tileId,
    editorTile?.file_name,
    editorTile?.file_type,
    editorTile?.content,
  ]);

  // Access store for editor-specific UI state
  const editorUI = useMemo(() => {
    if (!isEditorTile || !tileId) return null;
    // Return empty object as per EditorTileUI interface
    return DEFAULT_EDITOR_TILE_UI as EditorTileUI;
  }, [
    isEditorTile,
    tileId,
  ]);

  // Get store update functions
  const storeUpdateEditorTile = useStoreContext(state => state.updateEditorTile);

  // Create memoized meta actions
  const editorMetaActions = useMemo<EditorTileMetaActions | null>(() => {
    if (!isEditorTile || !tileId) return null;
    
    // Return empty object as per EditorTileMeta interface
    return DEFAULT_EDITOR_TILE_META_ACTIONS as EditorTileMetaActions;
  }, [isEditorTile, tileId]);

  // Create memoized data actions
  const editorDataActions = useMemo<EditorTileDataActions | null>(() => {
    if (!isEditorTile || !tileId) return null;
    
    return {
      setFileName: (fileName) => {
        const update: Partial<EditorTile> = { 
          file_name: fileName,
        };
        storeUpdateEditorTile(tileId, update);
      },
      setFileType: (fileType) => {
        const update: Partial<EditorTile> = { 
          file_type: fileType,
        };
        storeUpdateEditorTile(tileId, update);
      },
      setContent: (content) => {
        const update: Partial<EditorTile> = { 
          content: content
        };
        storeUpdateEditorTile(tileId, update);
      }
    };
  }, [isEditorTile, tileId, storeUpdateEditorTile]);

  // Create memoized UI actions
  const editorUIActions = useMemo<EditorTileUIActions | null>(() => {
    if (!isEditorTile || !tileId) return null;
    
    // Return empty object as per EditorTileUI interface
    return DEFAULT_EDITOR_TILE_UI_ACTIONS as EditorTileUIActions;
  }, [isEditorTile, tileId]);

  // Build a final `editorTile` object from the separate meta, data, and UI objects
  const combinedEditorTile = useMemo(() => {
    if (!editorMeta || !editorData || !editorUI) return null;
    
    return {
      ...editorMeta,
      ...editorData,
      ...editorUI
    };
  }, [editorMeta, editorData, editorUI]);

  // Build a final `editorTileActions` object from the separate meta, data, and UI actions
  const combinedEditorTileActions = useMemo(() => {
    if (!editorMetaActions || !editorDataActions || !editorUIActions) return null;
    
    return {
      ...editorMetaActions,
      ...editorDataActions,
      ...editorUIActions
    };
  }, [editorMetaActions, editorDataActions, editorUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileName || !isEditorTile) {
    return DEFAULT_USE_EDITOR_TILE_RETURN;
  }

  return {
    editorTile: combinedEditorTile as EditorTile,
    editorTileActions: combinedEditorTileActions as EditorActions,
    exists: isEditorTile
  };
}
