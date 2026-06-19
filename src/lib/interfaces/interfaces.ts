'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { InterfaceTemplateSchema, TileProps } from '@/types/interfaces/grid';
import {
  UpdateInterfaceRequest,
  ExportInterfaceTemplateRequest,
  ImportInterfaceTemplateRequest,
  TemplateImportResponse,
  TemplateExportResponse,
} from '@/types/interfaces/grid';
import { formatValidationDetail } from '@/utils/orchestra-error';

// create interface
export async function createInterface(
  name: string,
  project: string,
  context: string | undefined,
  items: TileProps[],
  newCounter: number,
  temporary: boolean = false,
  color: string | undefined
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/interface`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({
      name,
      projectName: project,
      context: context || null,
      items,
      newCounter,
      temporary,
      color: color || null,
    }),
  });
  return await response.json();
}

// get interface
export async function getInterface(project: string, temporary: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?temporary=${temporary}&projectName=${project}`,
    { method: 'GET', headers: { apiKey: apiKey }, cache: 'no-store' }
  );
  if (!response.ok) return null;
  return await response.json();
}

// update interface
export async function updateInterface(
  name: string,
  project: string,
  context: string | undefined,
  items: TileProps[],
  newCounter: number,
  newName: string | undefined = undefined,
  temporary: boolean = false,
  color: string | undefined
) {
  const apiKey = await requireUserApiKey();
  const body = {
    name,
    projectName: project,
    context: context || null,
    items,
    newCounter,
    temporary,
    color: color || null,
  };
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/interface`, {
    method: 'PUT',
    headers: { apiKey: apiKey },
    body: JSON.stringify(newName ? { ...body, newName } : body),
  });
  return await response.json();
}

// delete interface
export async function deleteInterface(name: string, project: string, temporary: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?name=${name}&projectName=${project}&temporary=${temporary}`,
    { method: 'DELETE', headers: { apiKey: apiKey } }
  );
  return await response.json();
}

// List interfaces
export async function listInterfaces(
  projectId: string,
  checkpoint: boolean = false,
  signal?: AbortSignal
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?projectName=${projectId}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
      signal,
    }
  );

  if (!response.ok) {
    return { error: `Failed to list interfaces: ${response.status}` };
  }

  return await response.json();
}

// Get interface by name
export async function getInterfaceByName(
  projectId: string,
  name: string,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?projectName=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return { error: `Failed to get interface: ${response.status}` };
  }

  const data = await response.json();
  return data;
}

// Get interface by ID
export async function getInterfaceById(interfaceId: string, checkpoint: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?interfaceId=${interfaceId}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

// Unified get interface function that accepts either ID or path
export async function getInterfaceUnified(params: {
  interfaceId?: string;
  project?: string;
  name?: string;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { interfaceId, project, name, checkpoint = false } = params;

  // If interface ID is provided, use it directly
  if (interfaceId) {
    return getInterfaceById(interfaceId, checkpoint);
  }

  // Otherwise use project+name
  if (project && name) {
    return getInterfaceByName(project, name, checkpoint);
  }

  return null;
}

// Create interface (new version)
export async function createNewInterface(projectId: string, name: string, color?: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/interface`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({
      projectName: projectId,
      name,
      color,
    }),
  });

  if (!response.ok) {
    try {
      const err = await response.json();
      const detail =
        typeof err === 'string'
          ? err
          : formatValidationDetail(err?.detail) || err?.message || JSON.stringify(err);
      return { error: `Failed to create interface: ${response.status}`, detail };
    } catch {
      const text = await response.text();
      return { error: `Failed to create interface: ${response.status}`, detail: text };
    }
  }

  return await response.json();
}

// Update interface by name
export async function updateInterfaceByName(
  projectId: string,
  name: string,
  data: UpdateInterfaceRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?projectName=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    try {
      const err = await response.json();
      const detail =
        typeof err === 'string'
          ? err
          : formatValidationDetail(err?.detail) || err?.message || JSON.stringify(err);
      return { error: `Failed to update interface: ${response.status}`, detail };
    } catch {
      const text = await response.text();
      return { error: `Failed to update interface: ${response.status}`, detail: text };
    }
  }

  return await response.json();
}

// Update interface by ID
export async function updateInterfaceById(
  interfaceId: string,
  data: UpdateInterfaceRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?interfaceId=${interfaceId}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    try {
      const err = await response.json();
      const detail =
        typeof err === 'string'
          ? err
          : formatValidationDetail(err?.detail) || err?.message || JSON.stringify(err);
      return { error: `Failed to update interface: ${response.status}`, detail };
    } catch {
      const text = await response.text();
      return { error: `Failed to update interface: ${response.status}`, detail: text };
    }
  }

  return await response.json();
}

// Unified update interface function that accepts either ID or path
export async function updateInterfaceUnified(params: {
  interfaceId?: string;
  project?: string;
  name?: string;
  data: UpdateInterfaceRequest;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { interfaceId, project, name, data, checkpoint = false } = params;

  // If interface ID is provided, use it directly
  if (interfaceId) {
    return updateInterfaceById(interfaceId, data, checkpoint);
  }

  // Otherwise use project+name
  if (project && name) {
    return updateInterfaceByName(project, name, data, checkpoint);
  }

  return { error: 'Missing required parameters to identify the interface' };
}

// Delete interface by name
export async function deleteInterfaceByName(projectId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?projectName=${projectId}&name=${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    }
  );

  if (!response.ok) {
    return { error: `Failed to delete interface: ${response.status}` };
  }

  return await response.json();
}

// Delete interface by ID
export async function deleteInterfaceById(interfaceId: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface?interfaceId=${interfaceId}`,
    {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    }
  );

  if (!response.ok) {
    return { error: `Failed to delete interface: ${response.status}` };
  }

  return await response.json();
}

// Unified delete interface function that accepts either ID or path
export async function deleteInterfaceUnified(params: {
  interfaceId?: string;
  project?: string;
  name?: string;
}) {
  const apiKey = await requireUserApiKey();
  const { interfaceId, project, name } = params;

  // If interface ID is provided, use it directly
  if (interfaceId) {
    return deleteInterfaceById(interfaceId);
  }

  // Otherwise use project+name
  if (project && name) {
    return deleteInterfaceByName(project, name);
  }

  return { error: 'Missing required parameters to identify the interface' };
}

// Create checkpoint for interface by name
export async function createInterfaceCheckpoint(
  projectId: string,
  name: string,
  description: string
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?projectName=${projectId}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: { apiKey: apiKey },
      body: JSON.stringify({ description }),
    }
  );

  if (!response.ok) {
    return { error: `Failed to create checkpoint: ${response.status}` };
  }

  return await response.json();
}

// Create checkpoint for interface by ID
export async function createInterfaceCheckpointById(interfaceId: string, description: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interfaceId=${interfaceId}`,
    {
      method: 'POST',
      headers: { apiKey: apiKey },
      body: JSON.stringify({ description }),
    }
  );

  if (!response.ok) {
    return { error: `Failed to create checkpoint: ${response.status}` };
  }

  return await response.json();
}

// Unified create checkpoint for interface function that accepts either ID or path
export async function createInterfaceCheckpointUnified(params: {
  id?: string;
  project?: string;
  name?: string;
  description: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, project, name, description } = params;

  // If interface ID is provided, use it directly
  if (id) {
    return createInterfaceCheckpointById(id, description);
  }

  // Otherwise use project+name
  if (project && name) {
    return createInterfaceCheckpoint(project, name, description);
  }

  return { error: 'Missing required parameters to identify the interface' };
}

// Interface checkpoint by name
export async function getInterfaceCheckpointByName(projectId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?projectName=${projectId}&name=${encodeURIComponent(name)}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    return { error: `Failed to get interface checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getInterfaceCheckpointById(interfaceId: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interfaceId=${interfaceId}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    return { error: `Failed to get interface checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getInterfaceCheckpointUnified(params: {
  interfaceId?: string;
  projectId?: string;
  name?: string;
}) {
  const apiKey = await requireUserApiKey();
  const { interfaceId, projectId, name } = params;
  if (interfaceId) {
    return getInterfaceCheckpointById(interfaceId);
  }
  if (projectId && name) {
    return getInterfaceCheckpointByName(projectId, name);
  }
  return { error: 'Missing parameters to identify the interface checkpoint' };
}

// Export interface template
export async function exportInterfaceAsTemplate(
  params: Omit<
    ExportInterfaceTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >,
  options?: Pick<
    ExportInterfaceTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >
): Promise<TemplateExportResponse<InterfaceTemplateSchema> | { error: string }> {
  const apiKey = await requireUserApiKey();
  const { interfaceId, projectName, interfaceName } = params;

  const requestBody: ExportInterfaceTemplateRequest = {
    interfaceId,
    projectName,
    interfaceName,
    checkpoint: options?.checkpoint || false,
    includeMetadata: options?.includeMetadata !== false,
    description: options?.description,
    tags: options?.tags || [],
    templateName: options?.templateName,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/interface?export_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to export interface template: ${response.status}` };
  }

  return await response.json();
}

// Import interface template
export async function importInterfaceFromTemplate(
  template: InterfaceTemplateSchema,
  options: Omit<ImportInterfaceTemplateRequest, 'template'> = {} as Omit<
    ImportInterfaceTemplateRequest,
    'template'
  >
): Promise<TemplateImportResponse | { error: string }> {
  const apiKey = await requireUserApiKey();
  const requestBody: ImportInterfaceTemplateRequest = {
    projectName: options.projectName,
    template,
    newInterfaceName: options.newInterfaceName,
    validateFirst: options.validateFirst || true,
    autoSanitize: options.autoSanitize || true,
    overwriteExisting: options.overwriteExisting || false,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/interface?import_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to import interface template: ${response.status}`, success: false };
  }

  return await response.json();
}
