'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ProjectTemplateSchema } from '@/types/interfaces/grid';
import {
  ExportProjectTemplateRequest,
  ImportProjectTemplateRequest,
  TemplateImportResponse,
  TemplateExportResponse,
} from '@/types/interfaces/grid';

// create project
export async function createProject(name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ name: name }),
  });
  return await response.json();
}

// get projects
export async function getProjects() {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects`, {
    method: 'GET',
    headers: { apiKey: apiKey },
    cache: 'no-store',
  });
  return await response.json();
}

// get project details
export async function getProject(name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/project/${encodeURIComponent(name)}`,
    { method: 'GET', headers: { apiKey: apiKey }, cache: 'no-store' }
  );
  return await response.json();
}

// rename project
export async function renameProject(oldName: string, newName: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/projects/${encodeURIComponent(oldName)}`,
    {
      method: 'PATCH',
      headers: { apiKey: apiKey },
      body: JSON.stringify({ name: newName }),
    }
  );
  return await response.json();
}

// delete project
export async function deleteProject(name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/projects/${encodeURIComponent(name)}`,
    { method: 'DELETE', headers: { apiKey: apiKey } }
  );
  return await response.json();
}

// patch project (e.g., update icon or description)
export async function patchProject(name: string, data: Record<string, any>) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/project/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );
  return await response.json();
}

// Export project template
export async function exportProjectAsTemplate(
  params: Omit<
    ExportProjectTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >,
  options?: Pick<
    ExportProjectTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >
): Promise<TemplateExportResponse<ProjectTemplateSchema> | { error: string }> {
  const apiKey = await requireUserApiKey();
  const requestBody: ExportProjectTemplateRequest = {
    projectName: params.projectName,
    interfaceNames: params.interfaceNames,
    checkpoint: options?.checkpoint || false,
    includeMetadata: options?.includeMetadata !== false,
    description: options?.description,
    tags: options?.tags || [],
    templateName: options?.templateName,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/project?export_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to export project template: ${response.status}` };
  }

  return await response.json();
}

// Import project template
export async function importProjectFromTemplate(
  template: ProjectTemplateSchema,
  options: Omit<ImportProjectTemplateRequest, 'template'> = {} as Omit<
    ImportProjectTemplateRequest,
    'template'
  >
): Promise<TemplateImportResponse | { error: string }> {
  const apiKey = await requireUserApiKey();
  const requestBody: ImportProjectTemplateRequest = {
    projectName: options.projectName,
    template,
    interfaceNamePrefix: options.interfaceNamePrefix,
    validateFirst: options.validateFirst || true,
    autoSanitize: options.autoSanitize || true,
    overwriteExisting: options.overwriteExisting || false,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/project?import_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to import project template: ${response.status}`, success: false };
  }

  return await response.json();
}

// Transfer project to organization
export async function transferProjectToOrg(projectId: number, organizationId: number) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/projects/${projectId}/transfer?type=organization`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiKey: apiKey,
      },
      body: JSON.stringify({ organizationId: organizationId }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to transfer project: ${response.status}`);
  }
  return await response.json();
}

// Transfer project to personal
export async function transferProjectToPersonal(projectId: number) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/projects/${projectId}/transfer?type=personal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiKey: apiKey,
      },
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to transfer project: ${response.status}`);
  }
  return await response.json();
}
