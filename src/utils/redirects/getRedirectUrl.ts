import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  InterfaceData,
  TabData,
} from "@/types/evals/grid";
import getQueryClient from "@/app/getQueryClient";
import { defaultInterface, defaultTab, defaultTiles } from "@/constants/logs";

/**
 * Determines if a redirect is needed based on current URL parameters and data state.
 * Creates default interfaces when needed. Tab logic is handled client-side.
 *
 * @param params Current URL and data parameters
 * @returns The redirect URL if a redirect is needed, null otherwise
 */
export async function getRedirectUrl({
  project,
  interface_,
  interfaces,
  currentInterface,
  tabs,
  interfaceActions,
  tabActions,
  tileActions,
}: {
  // URL parameters
  project: string | null;
  interface_: string | null;

  // Data state
  interfaces: InterfaceData[];
  currentInterface: InterfaceData | null;
  tabs?: TabData[];

  // Actions
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
}): Promise<string | null> {
  /* -------------------------------------------------------------------- *
   * Shared helpers                                                        *
   * -------------------------------------------------------------------- */
  const qc = getQueryClient();

  const buildUrl = ({
    project: proj,
    iface,
  }: {
    project: string;
    iface?: string;
  }) =>
    `/interfaces?project=${encodeURIComponent(proj)}${
      iface ? `&interface=${encodeURIComponent(iface)}` : ""
    }`;

  const upsert = <T>(
    arr: T[] | undefined,
    item: T,
  ): T[] => {
    console.log("[getRedirectUrl] Upserting item into array:", item, arr);
    if (!arr) return [item];
    const idx = arr.findIndex((i) => (i as any).id === (item as any).id);
    if (idx === -1) return [...arr, item];
    const clone = [...arr];
    clone[idx] = item;
    console.log("[getRedirectUrl] Upserted array:", clone);
    return clone;
  };

  const createDefaultTiles = async (tabId: string) => {
    console.log("[getRedirectUrl] Creating default tiles for tab:", tabId);
    try {
      for (const tile of defaultTiles) {
        const { name, type, position, ...tileProps } = tile;

        // Handle specialized tile data
        const specializedData: {
          table_tile?: typeof tile.table_tile;
          plot_tile?: typeof tile.plot_tile;
          view_tile?: typeof tile.view_tile;
          editor_tile?: typeof tile.editor_tile;
          terminal_tile?: typeof tile.terminal_tile;
        } = {};
        
        if (tile.table_tile) specializedData.table_tile = tile.table_tile;
        if (tile.plot_tile) specializedData.plot_tile = tile.plot_tile;
        if (tile.view_tile) specializedData.view_tile = tile.view_tile;
        if (tile.editor_tile) specializedData.editor_tile = tile.editor_tile;
        if (tile.terminal_tile) specializedData.terminal_tile = tile.terminal_tile;
        
        // Remove specialized data and server-generated props from tileProps to avoid duplication
        const { 
          table_tile, plot_tile, view_tile, editor_tile, terminal_tile,
          id, tab_id, created_at, updated_at, ...restTileProps 
        } = tileProps;
        
        // Prepare tile data with all available properties
        const tileData = {
          ...restTileProps,
          ...specializedData
        };
        
        await tileActions.create(
          tabId, 
          name, 
          position, 
          tileData,
          undefined, // tile_id
          type
        );
        console.log("[getRedirectUrl] Created tile:", name);
      }
    } catch (error) {
      console.error("[getRedirectUrl] Failed to create default tiles:", error);
    }
  };

  /* -------------------------------------------------------------------- *
   * Case 1 – No project selected                                          *
   * -------------------------------------------------------------------- */
  if (!project) {
    // Guardrail: UI handles project selection
    return null;
  }

  /* -------------------------------------------------------------------- *
   * Case 2 – No interfaces yet for this project                           *
   *           (creates default interface with default tab if needed)      *
   * -------------------------------------------------------------------- */
  if (!interfaces.length || !currentInterface) {
    const interfaceName = interface_ || defaultInterface.name;
    if (!interface_) {
      console.log(
        "[getRedirectUrl] Using default interface name:",
        interfaceName,
      );
    }

    const newInterface = await interfaceActions.create(project, interfaceName);

    if (newInterface && newInterface.id) {
      // Cache the new interface immediately
      qc.setQueryData<InterfaceData[]>(
        ["interfaces", project, false],
        (old) => upsert(old, newInterface) as InterfaceData[],
      );

      console.log("[getRedirectUrl] Created new interface:", newInterface);

      // Create a default tab only if no tabs exist
      const { name: tabName, ...tabProps } = defaultTab;
      const newTab = await tabActions.create(newInterface.id, tabName, tabProps);

      if (newTab && newTab.id) {
        console.log("[getRedirectUrl] Created default tab:", newTab);

        // Keep cache in sync
        qc.setQueryData<TabData[]>(
          ["tabs", newInterface.id],
          (old) => upsert(old, newTab) as TabData[],
        );

        // Create default tiles for the new tab
        await createDefaultTiles(newTab.id);

        // Update interface with active tab id
        await interfaceActions.update({
          interface_id: newInterface.id,
          data: { active_tab_id: newTab.id },
        });

        qc.setQueryData<InterfaceData[]>(
          ["interfaces", project, false],
          (old) =>
            upsert(old, {
              ...newInterface,
              active_tab_id: newTab.id,
            } as InterfaceData) as InterfaceData[],
        );
      }

      // Redirect to interface only - client will handle tab selection
      const url = buildUrl({
        project,
        iface: newInterface.name,
      });
      console.log("[getRedirectUrl] Returning redirect URL:", url);
      return url;
    }

    // Extreme fallback: interface creation failed
    console.error("[getRedirectUrl] Failed to create a default interface.");
    return null;
  }

  /* -------------------------------------------------------------------- *
   * Case 3 – Interface missing in URL (but we already have one)           *
   *           Create default tab only if no tabs exist                    *
   * -------------------------------------------------------------------- */
  if (!interface_ && currentInterface && currentInterface.name) {
    // Check if we need to create a default tab (only if no tabs exist)
    if (currentInterface.id && (!tabs || tabs.length === 0)) {
      console.log("[getRedirectUrl] No tabs found; creating default tab for interface.");
      
      const { name: tabName, ...tabProps } = defaultTab;
      const newTab = await tabActions.create(currentInterface.id, tabName, tabProps);

      if (newTab && newTab.id) {
        // Keep cache in sync
        qc.setQueryData<TabData[]>(
          ["tabs", currentInterface.id],
          (old) => upsert(old, newTab) as TabData[],
        );

        // Create default tiles for the new tab
        await createDefaultTiles(newTab.id);

        // Update interface with active tab id
        await interfaceActions.update({
          interface_id: currentInterface.id,
          data: { active_tab_id: newTab.id },
        });
      }
    }

    // Just redirect to the interface - client will handle tab selection
    return buildUrl({
      project,
      iface: currentInterface.name,
    });
  }

  /* -------------------------------------------------------------------- *
   * No redirect needed                                                    *
   * -------------------------------------------------------------------- */
  return null;
}
