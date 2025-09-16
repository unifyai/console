"use server";

import { ProjectTemplateSchema } from "@/types/interfaces/grid";
import { 
    ExportProjectTemplateRequest,
    ImportProjectTemplateRequest,
    TemplateImportResponse,
    TemplateExportResponse
} from "@/types/interfaces/grid";

// create project
export const createProject = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name: name })
            }
        );
        return await response.json();
    };
};

// get projects
export const getProjects = async (apiKey: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects`,
            { method: "GET", headers: { apiKey: apiKey }, cache: "no-store" }
        );
        return await response.json();
    };
};

// rename project
export const renameProject = async (apiKey: string) => {
    return async (oldName: string, newName: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${encodeURIComponent(oldName)}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name: newName })
            }
        );
        return await response.json();
    };
};

// delete project
export const deleteProject = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${encodeURIComponent(name)}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// patch project (e.g., update icon or description)
export const patchProject = (apiKey: string) => {
    return async (name: string, data: Record<string, any>) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/project/${encodeURIComponent(name)}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data)
            }
        );
        return await response.json();
    };
};

// Export project template
export const exportProjectAsTemplate = async (apiKey: string) => {
    return async (
        params: Omit<ExportProjectTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
        options?: Pick<ExportProjectTemplateRequest, 'checkpoint' | 'include_metadata' | 'description' | 'tags' | 'template_name'>,
    ): Promise<TemplateExportResponse<ProjectTemplateSchema> | { error: string }> => {
        "use server";

        const requestBody: ExportProjectTemplateRequest = {
            project: params.project,
            interface_names: params.interface_names,
            checkpoint: options?.checkpoint || false,
            include_metadata: options?.include_metadata !== false,
            description: options?.description,
            tags: options?.tags || [],
            template_name: options?.template_name,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/project?export_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to export project template: ${response.status}` };
        }

        return await response.json();
    };
};

// Import project template
export const importProjectFromTemplate = async (apiKey: string) => {
    return async (
        template: ProjectTemplateSchema,
        options: Omit<ImportProjectTemplateRequest, 'template'>,
    ): Promise<TemplateImportResponse | { error: string }> => {
        "use server";

        const requestBody: ImportProjectTemplateRequest = {
            project: options.project,
            template,
            interface_name_prefix: options.interface_name_prefix,
            validate_first: options.validate_first || true,
            auto_sanitize: options.auto_sanitize || true,
            overwrite_existing: options.overwrite_existing || false,
        };

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/project?import_template`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            return { error: `Failed to import project template: ${response.status}`, success: false };
        }

        return await response.json();
    };
};