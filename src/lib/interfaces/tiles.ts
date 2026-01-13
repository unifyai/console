"use server";

import { TileTemplateSchema } from "@/types/interfaces/grid";
import { 
    TilePosition,
    UpdateTileRequest, 
    CreateTileRequest,
    ExportTileTemplateRequest,
    ImportTileTemplateRequest,
    TemplateImportResponse,
    TemplateExportResponse
} from "@/types/interfaces/grid";

// List tiles in tab
export const listTiles = async (apiKey: string) => {
    return async (tab_id: string, type?: string, checkpoint: boolean = false, signal?: AbortSignal) => {
        "use server";

        let url = `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&checkpoint=${checkpoint}`;
        if (type) {
            url += `&type=${type}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: { apiKey: apiKey },
            cache: "no-store",
            signal,
        });
        
        if (!response.ok) {
            return { error: `Failed to list tiles: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get tile by name
export const getTileByName = async (apiKey: string) => {
    return async (tab_id: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get tile: ${response.status}` };
        }
        
        const tiles = await response.json();
        return tiles.length > 0 ? tiles[0] : null;
    };
};

// Get tile by ID
export const getTileById = async (apiKey: string) => {
    return async (id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    };
};

// Unified get tile function
export const getTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { id, tab_id, name, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const getById = await getTileById(apiKey);
            return getById(id, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const getByName = await getTileByName(apiKey);
            return getByName(tab_id, name, checkpoint);
        }
        
        return null;
    };
};

// Create tile
export const createTile = async (apiKey: string) => {
    return async (
        tab_id: string, 
        name: string, 
        position: TilePosition,
        data: Omit<CreateTileRequest, 'tile_id' | 'tab_id' | 'name' | 'position'>,
        tile_id?: string,
        type?: string
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    tab_id,
                    name,
                    position,
                    type,
                    tile_id,
                    ...data
                }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tile by name
export const updateTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        data: UpdateTileRequest,
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tile by ID
export const updateTileById = async (apiKey: string) => {
    return async (
        id: string,
        data: UpdateTileRequest,
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified update tile function
export const updateTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        data: UpdateTileRequest; 
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, data, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const updateById = await updateTileById(apiKey);
            return updateById(id, data, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const updateByName = await updateTileByName(apiKey);
            return updateByName(tab_id, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Patch tile by name
export const patchTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        updateData: Partial<UpdateTileRequest>,
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Patch tile by ID
export const patchTileById = async (apiKey: string) => {
    return async (
        id: string,
        updateData: Partial<UpdateTileRequest>,
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified patch tile function
export const patchTileUnified = async (apiKey: string) => {
    return async (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        updateData: Partial<UpdateTileRequest>;
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, updateData, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const patchById = await patchTileById(apiKey);
            return patchById(id, updateData, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const patchByName = await patchTileByName(apiKey);
            return patchByName(tab_id, name, updateData, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Patch specialized tile by name
export const patchSpecializedTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        tileType: "Table" | "Plot" | "View",
        updateData: Record<string, any>,
        checkpoint: boolean = false
    ) => {
        "use server";

        // Build query parameters
        const queryParams = new URLSearchParams();
        
        // Required parameters
        queryParams.append("tile_type", tileType);
        queryParams.append("tab_id", tab_id);
        queryParams.append("name", name);
        queryParams.append("checkpoint", checkpoint.toString());

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Patch specialized tile by ID
export const patchSpecializedTileById = async (apiKey: string) => {
    return async (
        id: string,
        tileType: "Table" | "Plot" | "View",
        updateData: Record<string, any>,
        checkpoint: boolean = false
    ) => {
        "use server";

        // Build query parameters
        const queryParams = new URLSearchParams();
        
        // Required parameters
        queryParams.append("tile_id", id);
        queryParams.append("tile_type", tileType);
        queryParams.append("checkpoint", checkpoint.toString());

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified patch specialized tile function
export const patchSpecializedTileUnified = async (apiKey: string) => {
    return async (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        tileType: "Table" | "Plot" | "View";
        updateData: Record<string, any>;
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, tileType, updateData, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const patchSpecializedById = await patchSpecializedTileById(apiKey);
            return patchSpecializedById(id, tileType, updateData, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const patchSpecializedByName = await patchSpecializedTileByName(apiKey);
            return patchSpecializedByName(tab_id, name, tileType, updateData, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Delete tile by name
export const deleteTileByName = async (apiKey: string) => {
    return async (tab_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete tile by ID
export const deleteTileById = async (apiKey: string) => {
    return async (id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete tile function
export const deleteTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { id, tab_id, name } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const deleteById = await deleteTileById(apiKey);
            return deleteById(id);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const deleteByName = await deleteTileByName(apiKey);
            return deleteByName(tab_id, name);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Create checkpoint for tile by name
export const createTileCheckpointByName = async (apiKey: string) => {
    return async (tab_id: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Create checkpoint for tile by ID
export const createTileCheckpointById = async (apiKey: string) => {
    return async (id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tile_id=${id}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified create checkpoint for tile function
export const createTileCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string;
        description: string; 
    }) => {
        "use server";
        
        const { id, tab_id, name, description } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const checkpointById = await createTileCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const checkpointByName = await createTileCheckpointByName(apiKey);
            return checkpointByName(tab_id, name, description);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

export const getTileCheckpointByName = async (apiKey: string) => {
    return async (tab_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tile checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTileCheckpointById = async (apiKey: string) => {
    return async (tile_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tile_id=${tile_id}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tile checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTileCheckpointUnified = async (apiKey: string) => {
    return async (params: { id?: string; tab_id?: string; name?: string }) => {
        "use server";
        const { id, tab_id, name } = params;
        if (id) {
            const fn = await getTileCheckpointById(apiKey);
            return fn(id);
        }
        if (tab_id && name) {
            const fn = await getTileCheckpointByName(apiKey);
            return fn(tab_id, name);
        }
        return { error: "Missing parameters to identify the tile checkpoint" };
    };
};

// Export tile template
export const exportTileAsTemplate = async (apiKey: string) => {
    return async (
        params: Omit<ExportTileTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
        options?: Pick<ExportTileTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
    ): Promise<TemplateExportResponse<TileTemplateSchema> | { error: string }> => {
        "use server";

        const { tile_id, tab_id, tile_name } = params;

        const requestBody: ExportTileTemplateRequest = {
            tile_id,
            tab_id,
            tile_name,
            checkpoint: options?.checkpoint || false,
            include_metadata: options?.include_metadata !== false,
            description: options?.description,
            tags: options?.tags || [],
            template_name: options?.template_name,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?export_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to export tile template: ${response.status}` };
        }

        return await response.json();
    };
};

// Import tile template
export const importTileFromTemplate = async (apiKey: string) => {
    return async (
        template: TileTemplateSchema,
        params: Pick<ImportTileTemplateRequest, 'tab_id' | 'interface_id' | 'tab_name'>,
        options: Omit<ImportTileTemplateRequest, 'template' | 'tab_id' | 'interface_id' | 'tab_name'>
    ): Promise<TemplateImportResponse | { error: string }> => {
        "use server";

        const { tab_id, interface_id, tab_name } = params;

        const requestBody: ImportTileTemplateRequest = {
            project_name: options.project_name,
            template,
            tab_id,
            interface_id,
            tab_name,
            new_tile_name: options.new_tile_name,
            validate_first: options.validate_first || true,
            auto_sanitize: options.auto_sanitize || true,
            overwrite_existing: options.overwrite_existing || false,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?import_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to import tile template: ${response.status}`, success: false };
        }

        return await response.json();
    };
};
