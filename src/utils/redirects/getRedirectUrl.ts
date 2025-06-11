import {
  GranularInterfaceActions,
  GranularTabActions,
  InterfaceData,
  TabData,
} from "@/types/evals/grid";
import getQueryClient from "@/app/getQueryClient";

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
    const interfaceName = interface_ || "interface1";
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
      const newTab = await tabActions.create(newInterface.id, "tab1", {
        visible: true,
        active: true,
      });

      if (newTab && newTab.id) {
        console.log("[getRedirectUrl] Created default tab:", newTab);

        // Keep cache in sync
        qc.setQueryData<TabData[]>(
          ["tabs", newInterface.id],
          (old) => upsert(old, newTab) as TabData[],
        );

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
      
      const newTab = await tabActions.create(currentInterface.id, "tab1", {
        visible: true,
        active: true,
      });

      if (newTab && newTab.id) {
        // Keep cache in sync
        qc.setQueryData<TabData[]>(
          ["tabs", currentInterface.id],
          (old) => upsert(old, newTab) as TabData[],
        );

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
