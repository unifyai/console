'use server';

import { InterfaceTemplateSchema, TileProps } from '@/types/interfaces/grid';
import {
  UpdateInterfaceRequest,
  ExportInterfaceTemplateRequest,
  ImportInterfaceTemplateRequest,
  TemplateImportResponse,
  TemplateExportResponse,
} from '@/types/interfaces/grid';

// create interface
export const createInterface = async (apiKey: string) => {
  return async (
    name: string,
    project: string,
    context: string | undefined,
    items: TileProps[],
    newCounter: number,
    temporary: boolean = false,
    color: string | undefined
  ) => {
    'use server';

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
  };
};

// get interface
export const getInterface = async (apiKey: string) => {
  return async (project: string, temporary: boolean = false) => {
    'use server';

    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/interface?temporary=${temporary}&projectName=${project}`,
      { method: 'GET', headers: { apiKey: apiKey }, cache: 'no-store' }
    );
    if (!response.ok) return null;
    return await response.json();
  };
};

// update interface
export const updateInterface = async (apiKey: string) => {
  return async (
    name: string,
    project: string,
    context: string | undefined,
    items: TileProps[],
    newCounter: number,
    newName: string | undefined = undefined,
    temporary: boolean = false,
    color: string | undefined
  ) => {
    'use server';
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
  };
};

// delete interface
export const deleteInterface = async (apiKey: string) => {
  return async (name: string, project: string, temporary: boolean = false) => {
    'use server';

    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/interface?name=${name}&projectName=${project}&temporary=${temporary}`,
      { method: 'DELETE', headers: { apiKey: apiKey } }
    );
    return await response.json();
  };
};

// List interfaces
export const listInterfaces = async (apiKey: string) => {
  return async (projectId: string, checkpoint: boolean = false, signal?: AbortSignal) => {
    'use server';

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
  };
};

// Get interface by name
export const getInterfaceByName = async (apiKey: string) => {
  return async (projectId: string, name: string, checkpoint: boolean = false) => {
    'use server';

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
  };
};

// Get interface by ID
export const getInterfaceById = async (apiKey: string) => {
  return async (interfaceId: string, checkpoint: boolean = false) => {
    'use server';

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
  };
};

// Unified get interface function that accepts either ID or path
export const getInterfaceUnified = async (apiKey: string) => {
  return async (params: {
    interfaceId?: string;
    project?: string;
    name?: string;
    checkpoint?: boolean;
  }) => {
    'use server';

    const { interfaceId, project, name, checkpoint = false } = params;

    // If interface ID is provided, use it directly
    if (interfaceId) {
      const getById = await getInterfaceById(apiKey);
      return getById(interfaceId, checkpoint);
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
    'use server';

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
          typeof err === 'string' ? err : err?.detail || err?.message || JSON.stringify(err);
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
  return async (
    projectId: string,
    name: string,
    data: UpdateInterfaceRequest,
    checkpoint: boolean = false
  ) => {
    'use server';

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
          typeof err === 'string' ? err : err?.detail || err?.message || JSON.stringify(err);
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
  return async (interfaceId: string, data: UpdateInterfaceRequest, checkpoint: boolean = false) => {
    'use server';

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
          typeof err === 'string' ? err : err?.detail || err?.message || JSON.stringify(err);
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
    interfaceId?: string;
    project?: string;
    name?: string;
    data: UpdateInterfaceRequest;
    checkpoint?: boolean;
  }) => {
    'use server';

    const { interfaceId, project, name, data, checkpoint = false } = params;

    // If interface ID is provided, use it directly
    if (interfaceId) {
      const updateById = await updateInterfaceById(apiKey);
      return updateById(interfaceId, data, checkpoint);
    }

    // Otherwise use project+name
    if (project && name) {
      const updateByName = await updateInterfaceByName(apiKey);
      return updateByName(project, name, data, checkpoint);
    }

    return { error: 'Missing required parameters to identify the interface' };
  };
};

// Delete interface by name
export const deleteInterfaceByName = async (apiKey: string) => {
  return async (projectId: string, name: string) => {
    'use server';

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
  };
};

// Delete interface by ID
export const deleteInterfaceById = async (apiKey: string) => {
  return async (interfaceId: string) => {
    'use server';

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
  };
};

// Unified delete interface function that accepts either ID or path
export const deleteInterfaceUnified = async (apiKey: string) => {
  return async (params: { interfaceId?: string; project?: string; name?: string }) => {
    'use server';

    const { interfaceId, project, name } = params;

    // If interface ID is provided, use it directly
    if (interfaceId) {
      const deleteById = await deleteInterfaceById(apiKey);
      return deleteById(interfaceId);
    }

    // Otherwise use project+name
    if (project && name) {
      const deleteByName = await deleteInterfaceByName(apiKey);
      return deleteByName(project, name);
    }

    return { error: 'Missing required parameters to identify the interface' };
  };
};

// Create checkpoint for interface by name
export const createInterfaceCheckpoint = async (apiKey: string) => {
  return async (projectId: string, name: string, description: string) => {
    'use server';

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
  };
};

// Create checkpoint for interface by ID
export const createInterfaceCheckpointById = async (apiKey: string) => {
  return async (interfaceId: string, description: string) => {
    'use server';

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
  };
};

// Unified create checkpoint for interface function that accepts either ID or path
export const createInterfaceCheckpointUnified = async (apiKey: string) => {
  return async (params: { id?: string; project?: string; name?: string; description: string }) => {
    'use server';

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

    return { error: 'Missing required parameters to identify the interface' };
  };
};

// Interface checkpoint by name
export const getInterfaceCheckpointByName = async (apiKey: string) => {
  return async (projectId: string, name: string) => {
    'use server';

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
  };
};

export const getInterfaceCheckpointById = async (apiKey: string) => {
  return async (interfaceId: string) => {
    'use server';

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
  };
};

export const getInterfaceCheckpointUnified = async (apiKey: string) => {
  return async (params: { interfaceId?: string; projectId?: string; name?: string }) => {
    'use server';
    const { interfaceId, projectId, name } = params;
    if (interfaceId) {
      const fn = await getInterfaceCheckpointById(apiKey);
      return fn(interfaceId);
    }
    if (projectId && name) {
      const fn = await getInterfaceCheckpointByName(apiKey);
      return fn(projectId, name);
    }
    return { error: 'Missing parameters to identify the interface checkpoint' };
  };
};

// Export interface template
export const exportInterfaceAsTemplate = async (apiKey: string) => {
  return async (
    params: Omit<
      ExportInterfaceTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >,
    options?: Pick<
      ExportInterfaceTemplateRequest,
      'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
    >
  ): Promise<TemplateExportResponse<InterfaceTemplateSchema> | { error: string }> => {
    'use server';

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
  };
};

// Import interface template
export const importInterfaceFromTemplate = async (apiKey: string) => {
  return async (
    template: InterfaceTemplateSchema,
    options: Omit<ImportInterfaceTemplateRequest, 'template'>
  ): Promise<TemplateImportResponse | { error: string }> => {
    'use server';

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
  };
};
