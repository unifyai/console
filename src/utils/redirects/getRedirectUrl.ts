import {
  GranularInterfaceActions,
  GranularTabActions,
  InterfaceData,
  TabData,
} from "@/types/evals/grid";
import getQueryClient from "@/app/getQueryClient";

/**
 * Determines if a redirect is needed based on current URL parameters and data state.
 * Creates default interfaces and tabs when needed in one operation.
 *
 * @param params Current URL and data parameters
 * @returns The redirect URL if a redirect is needed, null otherwise
 */
export async function getRedirectUrl({
  project,
  interface_,
  tab,
  interfaces,
  currentInterface,
  tabs,
  interfaceActions,
  tabActions,
}: {
  // URL parameters
  project: string | null;
  interface_: string | null;
  tab?: string;

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
    tabName,
  }: {
    project: string;
    iface?: string;
    tabName?: string;
  }) =>
    `/interfaces?project=${encodeURIComponent(proj)}${
      iface ? `&interface=${encodeURIComponent(iface)}` : ""
    }${tabName ? `&tab=${encodeURIComponent(tabName)}` : ""}`;

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
   *           (creates default interface + tab in one go)                *
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

      const tabName = tab || "tab1";
      if (!tab) {
        console.log("[getRedirectUrl] Using default tab name:", tabName);
      }

      console.log("[getRedirectUrl] Created new interface:", newInterface);

      const newTab = await tabActions.create(newInterface.id, tabName, {
        visible: true,
        active: true,
      });

      if (newTab && newTab.id) {
        console.log("[getRedirectUrl] Created new tab:", newTab);

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

        // Redirect with both interface & tab
        const url = buildUrl({
          project,
          iface: newInterface.name,
          tabName: newTab.name,
        });
        console.log("[getRedirectUrl] Returning redirect URL:", url);
        return url;
      }

      // Fallback: tab creation failed – redirect to interface only
      console.warn(
        "[getRedirectUrl] Tab creation failed; redirecting to interface only.",
      );
      return buildUrl({
        project,
        iface: newInterface.name,
      });
    }

    // Extreme fallback: interface creation failed
    console.error("[getRedirectUrl] Failed to create a default interface.");
    return null;
  }

  /* -------------------------------------------------------------------- *
   * Case 3 – Interface missing in URL (but we already have one)           *
   *           May need to add a tab too                                   *
   * -------------------------------------------------------------------- */
  if (!interface_ && currentInterface && currentInterface.name) {
    // Need tab redirect only if tab param is missing
    const needsTabRedirect = !tab && currentInterface.id;

    if (needsTabRedirect) {
      let activeTabs = tabs ?? [];

      if (!activeTabs.length && currentInterface.id) {
        activeTabs = (await tabActions.list(currentInterface.id, false)) ?? [];
        qc.setQueryData<TabData[]>(
          ["tabs", currentInterface.id],
          activeTabs,
        );
      }

      let activeTab =
        activeTabs.find((t) => t.active) || (activeTabs.length ? activeTabs[0] : null);

      if (!activeTab && currentInterface.id) {
        // Create a default tab because none exist
        console.log(
          "[getRedirectUrl] No tabs found; creating default tab for interface.",
        );
        activeTab = await tabActions.create(currentInterface.id, "tab1", {
          visible: true,
          active: true,
        });

        if (activeTab) {
          qc.setQueryData<TabData[]>(
            ["tabs", currentInterface.id],
            (old) => upsert(old, activeTab!) as TabData[],
          );

          await interfaceActions.update({
            interface_id: currentInterface.id,
            data: { active_tab_id: activeTab.id },
          });
        }
      }

      if (activeTab && activeTab.name) {
        return buildUrl({
          project,
          iface: currentInterface.name,
          tabName: activeTab.name,
        });
      }
    }

    // Just redirect to the interface itself
    return buildUrl({
      project,
      iface: currentInterface.name,
    });
  }

  /* -------------------------------------------------------------------- *
   * Case 4 – Interface present in URL but tab missing                     *
   * -------------------------------------------------------------------- */
  if (!tab && currentInterface && currentInterface.id) {
    const interfaceId = currentInterface.id;
    const interfaceName = currentInterface.name;

    let activeTabs = tabs ?? [];
    if (!activeTabs.length) {
      activeTabs = (await tabActions.list(interfaceId, false)) ?? [];
      qc.setQueryData<TabData[]>(["tabs", interfaceId], activeTabs);
    }

    let activeTab =
      activeTabs.find((t) => t.active) || (activeTabs.length ? activeTabs[0] : null);

    if (!activeTab) {
      console.log(
        "[getRedirectUrl] No existing tabs; creating default tab for interface.",
      );
      activeTab = await tabActions.create(interfaceId, "tab1", {
        visible: true,
        active: true,
      });

      if (activeTab) {
        qc.setQueryData<TabData[]>(
          ["tabs", interfaceId],
          (old) => upsert(old, activeTab!) as TabData[],
        );

        await interfaceActions.update({
          interface_id: interfaceId,
          data: { active_tab_id: activeTab.id },
        });
      }
    }

    if (activeTab && activeTab.name) {
      return buildUrl({
        project,
        iface: interfaceName,
        tabName: activeTab.name,
      });
    }
  }

  /* -------------------------------------------------------------------- *
   * No redirect needed                                                    *
   * -------------------------------------------------------------------- */
  return null;
}
