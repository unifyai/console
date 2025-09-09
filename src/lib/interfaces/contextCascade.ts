"use server";

import { listInterfaces, updateInterfaceById } from "@/lib/interfaces/interfaces";
import { listTabs, updateTabById } from "@/lib/interfaces/tabs";
import { listTiles, patchTileById } from "@/lib/interfaces/tiles";

/**
 * Set context on a tab and propagate to tiles that don't have an explicit context.
 */
export const setTabContextCascade = async (apiKey: string) => {
	return async (tabId: string, context: string): Promise<{ updatedTabs: number; updatedTiles: number; errors: string[] }> => {
		"use server";

		let updatedTabs = 0;
		let updatedTiles = 0;
		const errors: string[] = [];

		try {
			// Update tab context
			const updateTab = await updateTabById(apiKey);
			const tabResult = await updateTab(tabId, { context });
			if ("error" in (tabResult as any)) {
				errors.push(`Tab ${tabId}: ${(tabResult as any).error}`);
			} else {
				updatedTabs += 1;
			}

			// Fetch tiles for this tab
			const fetchTiles = await listTiles(apiKey);
			const tiles = await fetchTiles(tabId);

			if (Array.isArray(tiles)) {
				const patchTile = await patchTileById(apiKey);
				const patchPromises = tiles
					.filter(t => !t.context || t.context === "")
					.map(async (t) => {
						const res = await patchTile(t.id as string, { context });
						if ("error" in (res as any)) {
							errors.push(`Tile ${t.id}: ${(res as any).error}`);
						} else {
							updatedTiles += 1;
						}
					});
				await Promise.all(patchPromises);
			}
		} catch (e: any) {
			errors.push(e?.message || String(e));
		}

		return { updatedTabs, updatedTiles, errors };
	};
};

/**
 * Set context on an interface and propagate to tabs and tiles that don't have explicit contexts.
 */
export const setInterfaceContextCascade = async (apiKey: string) => {
	return async (interfaceId: string, context: string): Promise<{ updatedInterfaces: number; updatedTabs: number; updatedTiles: number; errors: string[] }> => {
		"use server";

		let updatedInterfaces = 0;
		let updatedTabs = 0;
		let updatedTiles = 0;
		const errors: string[] = [];

		try {
			// Update interface context
			const updateInterface = await updateInterfaceById(apiKey);
			const ifaceRes = await updateInterface(interfaceId, { context });
			if ("error" in (ifaceRes as any)) {
				errors.push(`Interface ${interfaceId}: ${(ifaceRes as any).error}`);
			} else {
				updatedInterfaces += 1;
			}

			// Fetch tabs for this interface
			const fetchTabs = await listTabs(apiKey);
			const tabs = await fetchTabs(interfaceId);
			if (Array.isArray(tabs)) {
				const updateTab = await updateTabById(apiKey);
				const patchTile = await patchTileById(apiKey);
				for (const tab of tabs) {
					// Set tab context only if not explicitly set
					if (!tab.context || tab.context === "") {
						const tRes = await updateTab(tab.id as string, { context });
						if ("error" in (tRes as any)) {
							errors.push(`Tab ${tab.id}: ${(tRes as any).error}`);
						} else {
							updatedTabs += 1;
						}
					}

					// Fetch tiles for this tab and set context if empty
					const fetchTiles = await listTiles(apiKey);
					const tiles = await fetchTiles(tab.id as string);
					if (Array.isArray(tiles)) {
						const patchPromises = tiles
							.filter(t => !t.context || t.context === "")
							.map(async (t) => {
								const res = await patchTile(t.id as string, { context });
								if ("error" in (res as any)) {
									errors.push(`Tile ${t.id}: ${(res as any).error}`);
								} else {
									updatedTiles += 1;
								}
							});
						await Promise.all(patchPromises);
					}
				}
			}
		} catch (e: any) {
			errors.push(e?.message || String(e));
		}

		return { updatedInterfaces, updatedTabs, updatedTiles, errors };
	};
};

/**
 * Set context on a project and propagate to all interfaces, tabs, and tiles without explicit contexts.
 */
export const setProjectContextCascade = async (apiKey: string) => {
	return async (projectId: string, context: string): Promise<{ updatedInterfaces: number; updatedTabs: number; updatedTiles: number; errors: string[] }> => {
		"use server";

		let updatedInterfaces = 0;
		let updatedTabs = 0;
		let updatedTiles = 0;
		const errors: string[] = [];

		try {
			// List all interfaces in the project
			const list = await listInterfaces(apiKey);
			const interfaces = await list(projectId);
			if (!Array.isArray(interfaces)) {
				return { updatedInterfaces, updatedTabs, updatedTiles, errors: ["Failed to list interfaces for project"] };
			}

			for (const iface of interfaces) {
				const ifaceId = iface.id as string;
				// Update interface context only if not explicitly set
				if (!iface.context || iface.context === "") {
					const updateInterface = await updateInterfaceById(apiKey);
					const res = await updateInterface(ifaceId, { context });
					if ("error" in (res as any)) {
						errors.push(`Interface ${ifaceId}: ${(res as any).error}`);
					} else {
						updatedInterfaces += 1;
					}
				}

				// For each interface, process tabs and tiles
				const fetchTabs = await listTabs(apiKey);
				const tabs = await fetchTabs(ifaceId);
				if (Array.isArray(tabs)) {
					const updateTab = await updateTabById(apiKey);
					const patchTile = await patchTileById(apiKey);
					for (const tab of tabs) {
						// Set tab context if not set
						if (!tab.context || tab.context === "") {
							const tRes = await updateTab(tab.id as string, { context });
							if ("error" in (tRes as any)) {
								errors.push(`Tab ${tab.id}: ${(tRes as any).error}`);
							} else {
								updatedTabs += 1;
							}
						}

						// Fetch tiles and set context where missing
						const fetchTiles = await listTiles(apiKey);
						const tiles = await fetchTiles(tab.id as string);
						if (Array.isArray(tiles)) {
							const patchPromises = tiles
								.filter(t => !t.context || t.context === "")
								.map(async (t) => {
									const res = await patchTile(t.id as string, { context });
									if ("error" in (res as any)) {
										errors.push(`Tile ${t.id}: ${(res as any).error}`);
									} else {
										updatedTiles += 1;
									}
								});
							await Promise.all(patchPromises);
						}
					}
				}
			}
		} catch (e: any) {
			errors.push(e?.message || String(e));
		}

		return { updatedInterfaces, updatedTabs, updatedTiles, errors };
	};
}; 