"use server";

import { TabTemplateSchema } from "@/types/interfaces/grid";
import { 
    UpdateTabRequest, 
    CreateTabRequest, 
    ExportTabTemplateRequest,
    ImportTabTemplateRequest,
    TemplateImportResponse,
    TemplateExportResponse
} from "@/types/interfaces/grid";

// List tabs in interface
export const listTabs = async (apiKey: string) => {
    return async (interfaceId: string, checkpoint: boolean = false, signal?: AbortSignal) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
                signal,
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to list tabs: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get tab by name
export const getTabByName = async (apiKey: string) => {
    return async (interfaceId: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get tab: ${response.status}` };
        }
        
        const tabs = await response.json();
        return tabs.length > 0 ? tabs[0] : null;
    };
};

// Get tab by ID
export const getTabById = async (apiKey: string) => {
    return async (id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    };
};

// Unified get tab function that accepts either ID or path
export const getTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interfaceId?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { id, interfaceId, name, checkpoint = false } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const getById = await getTabById(apiKey);
            return getById(id, checkpoint);
        }
        
        // Otherwise use interfaceId+name
        if (interfaceId && name) {
            const getByName = await getTabByName(apiKey);
            return getByName(interfaceId, name, checkpoint);
        }
        
        return null;
    };
};

// Create tab
export const createTab = async (apiKey: string) => {
    return async (interfaceId: string, name: string, data: Omit<CreateTabRequest, 'tabId' | 'interfaceId' | 'name'>, tabId?: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    interfaceId,
                    name,
                    tabId,
                    ...data
                }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tab by name
export const updateTabByName = async (apiKey: string) => {
    return async (interfaceId: string, name: string, data: UpdateTabRequest, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tab by ID
export const updateTabById = async (apiKey: string) => {
    return async (id: string, data: UpdateTabRequest, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified update tab function
export const updateTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interfaceId?: string; 
        name?: string; 
        data: UpdateTabRequest;
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, interfaceId, name, data, checkpoint = false } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const updateById = await updateTabById(apiKey);
            return updateById(id, data, checkpoint);
        }
        
        // Otherwise use interfaceId+name
        if (interfaceId && name) {
            const updateByName = await updateTabByName(apiKey);
            return updateByName(interfaceId, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

// Delete tab by name
export const deleteTabByName = async (apiKey: string) => {
    return async (interfaceId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete tab by ID
export const deleteTabById = async (apiKey: string) => {
    return async (id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete tab function
export const deleteTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interfaceId?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { id, interfaceId, name } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const deleteById = await deleteTabById(apiKey);
            return deleteById(id);
        }
        
        // Otherwise use interfaceId+name
        if (interfaceId && name) {
            const deleteByName = await deleteTabByName(apiKey);
            return deleteByName(interfaceId, name);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

// Create checkpoint for tab by name
export const createTabCheckpointByName = async (apiKey: string) => {
    return async (interfaceId: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
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

// Create checkpoint for tab by ID
export const createTabCheckpointById = async (apiKey: string) => {
    return async (id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tabId=${id}`,
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

// Unified create checkpoint for tab function
export const createTabCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interfaceId?: string; 
        name?: string;
        description: string 
    }) => {
        "use server";
        
        const { id, interfaceId, name, description } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const checkpointById = await createTabCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use interfaceId+name
        if (interfaceId && name) {
            const checkpointByName = await createTabCheckpointByName(apiKey);
            return checkpointByName(interfaceId, name, description);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

export const getTabCheckpointByName = async (apiKey: string) => {
    return async (interfaceId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tab checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTabCheckpointById = async (apiKey: string) => {
    return async (tabId: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tabId=${tabId}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tab checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTabCheckpointUnified = async (apiKey: string) => {
    return async (params: { id?: string; interfaceId?: string; name?: string }) => {
        "use server";
        const { id, interfaceId, name } = params;
        if (id) {
            const fn = await getTabCheckpointById(apiKey);
            return fn(id);
        }
        if (interfaceId && name) {
            const fn = await getTabCheckpointByName(apiKey);
            return fn(interfaceId, name);
        }
        return { error: "Missing parameters to identify the tab checkpoint" };
    };
};

// Export tab template
export const exportTabAsTemplate = async (apiKey: string) => {
    return async (
        params: Omit<ExportTabTemplateRequest, 'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'>,
        options?: Pick<ExportTabTemplateRequest, 'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'>,
    ): Promise<TemplateExportResponse<TabTemplateSchema> | { error: string }> => {
        "use server";

        const { tabId, interfaceId, tabName } = params;

        const requestBody: ExportTabTemplateRequest = {
            tabId,
            interfaceId,
            tabName,
            checkpoint: options?.checkpoint || false,
            includeMetadata: options?.includeMetadata !== false,
            description: options?.description,
            tags: options?.tags || [],
            templateName: options?.templateName,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?export_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to export tab template: ${response.status}` };
        }

        return await response.json();
    };
};

// Import tab template
export const importTabFromTemplate = async (apiKey: string) => {
    return async (
        template: TabTemplateSchema,
        params: Pick<ImportTabTemplateRequest, 'interfaceId' | 'interfaceName'>,
        options: Omit<ImportTabTemplateRequest, 'template' | 'interfaceId' | 'interfaceName'>,
    ): Promise<TemplateImportResponse | { error: string }> => {
        "use server";

        const { interfaceId, interfaceName } = params;

        const requestBody: ImportTabTemplateRequest = {
            projectName: options.projectName,
            template,
            interfaceId,
            interfaceName,
            newTabName: options.newTabName,
            validateFirst: options.validateFirst || true,
            autoSanitize: options.autoSanitize || true,
            overwriteExisting: options.overwriteExisting || false,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?import_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to import tab template: ${response.status}`, success: false };
        }

        return await response.json();
    };
};