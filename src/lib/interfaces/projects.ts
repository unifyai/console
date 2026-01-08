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

// get project details
export const getProject = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/project/${encodeURIComponent(name)}`,
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
        params: Omit<ExportProjectTemplateRequest, 'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'>,
        options?: Pick<ExportProjectTemplateRequest, 'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'>,
    ): Promise<TemplateExportResponse<ProjectTemplateSchema> | { error: string }> => {
        "use server";

        const requestBody: ExportProjectTemplateRequest = {
            projectName: params.projectName,
            interfaceNames: params.interfaceNames,
            checkpoint: options?.checkpoint || false,
            includeMetadata: options?.includeMetadata !== false,
            description: options?.description,
            tags: options?.tags || [],
            templateName: options?.templateName,
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
            projectName: options.projectName,
            template,
            interfaceNamePrefix: options.interfaceNamePrefix,
            validateFirst: options.validateFirst || true,
            autoSanitize: options.autoSanitize || true,
            overwriteExisting: options.overwriteExisting || false,
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

// Transfer project to organization
export const transferProjectToOrg = (apiKey: string) => {
    return async (projectId: number, organizationId: number) => {
        "use server";
        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${projectId}/transfer?type=organization`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apiKey": apiKey
                },
                body: JSON.stringify({ organizationId: organizationId })
            }
        );
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || `Failed to transfer project: ${response.status}`);
        }
        return await response.json();
    };
};

// Transfer project to personal
export const transferProjectToPersonal = (apiKey: string) => {
    return async (projectId: number) => {
        "use server";
        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${projectId}/transfer?type=personal`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apiKey": apiKey
                }
            }
        );
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || `Failed to transfer project: ${response.status}`);
        }
        return await response.json();
    };
};