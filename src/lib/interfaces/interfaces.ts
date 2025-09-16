"use server";

import { InterfaceTemplateSchema, TileProps } from "@/types/interfaces/grid";
import { 
    UpdateInterfaceRequest, 
    ExportInterfaceTemplateRequest,
    ImportInterfaceTemplateRequest,
    TemplateImportResponse,
    TemplateExportResponse
} from "@/types/interfaces/grid";

// create interface
export const createInterface = async (apiKey: string) => {
    return async (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, temporary: boolean = false, color: string | undefined) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name, project, context: context || null, items, new_counter, temporary, color: color || null })
            }
        );
        return await response.json();
    };
};

// get interface
export const getInterface = async (apiKey: string) => {
    return async (project: string, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?temporary=${temporary}&project=${project}`,
            { method: "GET", headers: { apiKey: apiKey }, cache: "no-store" }
        );
        if (!response.ok)
            return null;
        return await response.json();
    };
};

// update interface
export const updateInterface = async (apiKey: string) => {
    return async (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, new_name: string | undefined = undefined, temporary: boolean = false, color: string | undefined) => {
        "use server";
        const body = { name, project, context: context || null, items, new_counter, temporary, color: color || null };
        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(new_name ? {...body, new_name} : body)
            },
        );
        return await response.json();
    };
};

// delete interface
export const deleteInterface = async (apiKey: string) => {
    return async (name: string, project: string, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?name=${name}&project=${project}&temporary=${temporary}`,
            { method: "DELETE", headers: { apiKey: apiKey } },
        );
        return await response.json();
    };
};

// List interfaces
export const listInterfaces = async (apiKey: string) => {
    return async (projectId: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to list interfaces: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get interface by name
export const getInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get interface: ${response.status}` };
        }
        
        const data = await response.json();
        return data;
    };
};

// Get interface by ID
export const getInterfaceById = async (apiKey: string) => {
    return async (interface_id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}&checkpoint=${checkpoint}`,
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

// Unified get interface function that accepts either ID or path
export const getInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { interface_id, project, name, checkpoint = false } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const getById = await getInterfaceById(apiKey);
            return getById(interface_id, checkpoint);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const getByName = await getInterfaceByName(apiKey);
            return getByName(project, name, checkpoint);
        }
        
        return null;
    };
};

// Create interface (new version)
export const createNewInterface = async (apiKey: string) => {
    return async (projectId: string, name: string, color?: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    project: projectId,
                    name,
                    color
                }),
            }
        );
        
        if (!response.ok) {
            try {
                const err = await response.json();
                const detail = typeof err === 'string' ? err : (err?.detail || err?.message || JSON.stringify(err));
                return { error: `Failed to create interface: ${response.status}`, detail };
            } catch {
                const text = await response.text();
                return { error: `Failed to create interface: ${response.status}`, detail: text };
            }
        }
        
        return await response.json();
    };
};

// Update interface by name
export const updateInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string, data: UpdateInterfaceRequest, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            try {
                const err = await response.json();
                const detail = typeof err === 'string' ? err : (err?.detail || err?.message || JSON.stringify(err));
                return { error: `Failed to update interface: ${response.status}`, detail };
            } catch {
                const text = await response.text();
                return { error: `Failed to update interface: ${response.status}`, detail: text };
            }
        }
        
        return await response.json();
    };
};

// Update interface by ID
export const updateInterfaceById = async (apiKey: string) => {
    return async (
        interface_id: string,
        data: UpdateInterfaceRequest,
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            try {
                const err = await response.json();
                const detail = typeof err === 'string' ? err : (err?.detail || err?.message || JSON.stringify(err));
                return { error: `Failed to update interface: ${response.status}`, detail };
            } catch {
                const text = await response.text();
                return { error: `Failed to update interface: ${response.status}`, detail: text };
            }
        }
        
        return await response.json();
    };
};

// Unified update interface function that accepts either ID or path
export const updateInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
        data: UpdateInterfaceRequest;
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { interface_id, project, name, data, checkpoint = false } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const updateById = await updateInterfaceById(apiKey);
            return updateById(interface_id, data, checkpoint);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const updateByName = await updateInterfaceByName(apiKey);
            return updateByName(project, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// Delete interface by name
export const deleteInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete interface by ID
export const deleteInterfaceById = async (apiKey: string) => {
    return async (interface_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete interface function that accepts either ID or path
export const deleteInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { interface_id, project, name } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const deleteById = await deleteInterfaceById(apiKey);
            return deleteById(interface_id);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const deleteByName = await deleteInterfaceByName(apiKey);
            return deleteByName(project, name);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// Create checkpoint for interface by name
export const createInterfaceCheckpoint = async (apiKey: string) => {
    return async (projectId: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?project=${projectId}&name=${encodeURIComponent(name)}`,
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

// Create checkpoint for interface by ID
export const createInterfaceCheckpointById = async (apiKey: string) => {
    return async (interface_id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interface_id=${interface_id}`,
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

// Unified create checkpoint for interface function that accepts either ID or path
export const createInterfaceCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        project?: string; 
        name?: string;
        description: string 
    }) => {
        "use server";
        
        const { id, project, name, description } = params;
        
        // If interface ID is provided, use it directly
        if (id) {
            const checkpointById = await createInterfaceCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const checkpointByName = await createInterfaceCheckpoint(apiKey);
            return checkpointByName(project, name, description);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// Interface checkpoint by name
export const getInterfaceCheckpointByName = async (apiKey: string) => {
    return async (projectId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?project=${projectId}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get interface checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getInterfaceCheckpointById = async (apiKey: string) => {
    return async (interface_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interface_id=${interface_id}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get interface checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getInterfaceCheckpointUnified = async (apiKey: string) => {
    return async (params: { interface_id?: string; projectId?: string; name?: string }) => {
        "use server";
        const { interface_id, projectId, name } = params;
        if (interface_id) {
            const fn = await getInterfaceCheckpointById(apiKey);
            return fn(interface_id);
        }
        if (projectId && name) {
            const fn = await getInterfaceCheckpointByName(apiKey);
            return fn(projectId, name);
        }
        return { error: "Missing parameters to identify the interface checkpoint" };
    };
};

// Export interface template
export const exportInterfaceAsTemplate = async (apiKey: string) => {
    return async (
        params: Omit<ExportInterfaceTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
        options?: Pick<ExportInterfaceTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
    ): Promise<TemplateExportResponse<InterfaceTemplateSchema> | { error: string }> => {
        "use server";

        const { interface_id, project, interface_name } = params;

        const requestBody: ExportInterfaceTemplateRequest = {
            interface_id,
            project,
            interface_name,
            checkpoint: options?.checkpoint || false,
            include_metadata: options?.include_metadata !== false,
            description: options?.description,
            tags: options?.tags || [],
            template_name: options?.template_name,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?export_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to export interface template: ${response.status}` };
        }

        return await response.json();
    };
};

// Import interface template
export const importInterfaceFromTemplate = async (apiKey: string) => {
    return async (
        template: InterfaceTemplateSchema,
        options: Omit<ImportInterfaceTemplateRequest, 'template'>,
    ): Promise<TemplateImportResponse | { error: string }> => {
        "use server";

        const requestBody: ImportInterfaceTemplateRequest = {
            project: options.project,
            template,
            new_interface_name: options.new_interface_name,
            validate_first: options.validate_first || true,
            auto_sanitize: options.auto_sanitize || true,
            overwrite_existing: options.overwrite_existing || false,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?import_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to import interface template: ${response.status}`, success: false };
        }

        return await response.json();
    };
};