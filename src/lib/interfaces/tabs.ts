'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { TabTemplateSchema } from '@/types/interfaces/grid';
import {
  UpdateTabRequest,
  CreateTabRequest,
  ExportTabTemplateRequest,
  ImportTabTemplateRequest,
  TemplateImportResponse,
  TemplateExportResponse,
} from '@/types/interfaces/grid';

// List tabs in interface
export async function listTabs(
  interfaceId: string,
  checkpoint: boolean = false,
  signal?: AbortSignal
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
      signal,
    }
  );

  if (!response.ok) {
    return { error: `Failed to list tabs: ${response.status}` };
  }

  return await response.json();
}

// Get tab by name
export async function getTabByName(interfaceId: string, name: string, checkpoint: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return { error: `Failed to get tab: ${response.status}` };
  }

  const tabs = await response.json();
  return tabs.length > 0 ? tabs[0] : null;
}

// Get tab by ID
export async function getTabById(id: string, checkpoint: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}&checkpoint=${checkpoint}`,
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

// Unified get tab function that accepts either ID or path
export async function getTabUnified(params: {
  id?: string;
  interfaceId?: string;
  name?: string;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, interfaceId, name, checkpoint = false } = params;

  // If tab ID is provided, use it directly
  if (id) {
    return getTabById(id, checkpoint);
  }

  // Otherwise use interfaceId+name
  if (interfaceId && name) {
    return getTabByName(interfaceId, name, checkpoint);
  }

  return null;
}

// Create tab
export async function createTab(
  interfaceId: string,
  name: string,
  data: Omit<CreateTabRequest, 'tabId' | 'interfaceId' | 'name'>,
  tabId?: string
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({
      interfaceId,
      name,
      tabId,
      ...data,
    }),
  });

  if (!response.ok) {
    return { error: `Failed to create tab: ${response.status}` };
  }

  return await response.json();
}

// Update tab by name
export async function updateTabByName(
  interfaceId: string,
  name: string,
  data: UpdateTabRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    return { error: `Failed to update tab: ${response.status}` };
  }

  return await response.json();
}

// Update tab by ID
export async function updateTabById(
  id: string,
  data: UpdateTabRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    return { error: `Failed to update tab: ${response.status}` };
  }

  return await response.json();
}

// Unified update tab function
export async function updateTabUnified(params: {
  id?: string;
  interfaceId?: string;
  name?: string;
  data: UpdateTabRequest;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, interfaceId, name, data, checkpoint = false } = params;

  // If tab ID is provided, use it directly
  if (id) {
    return updateTabById(id, data, checkpoint);
  }

  // Otherwise use interfaceId+name
  if (interfaceId && name) {
    return updateTabByName(interfaceId, name, data, checkpoint);
  }

  return { error: 'Missing required parameters to identify the tab' };
}

// Delete tab by name
export async function deleteTabByName(interfaceId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    }
  );

  if (!response.ok) {
    return { error: `Failed to delete tab: ${response.status}` };
  }

  return await response.json();
}

// Delete tab by ID
export async function deleteTabById(id: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab?tabId=${id}`, {
    method: 'DELETE',
    headers: { apiKey: apiKey },
  });

  if (!response.ok) {
    return { error: `Failed to delete tab: ${response.status}` };
  }

  return await response.json();
}

// Unified delete tab function
export async function deleteTabUnified(params: {
  id?: string;
  interfaceId?: string;
  name?: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, interfaceId, name } = params;

  // If tab ID is provided, use it directly
  if (id) {
    return deleteTabById(id);
  }

  // Otherwise use interfaceId+name
  if (interfaceId && name) {
    return deleteTabByName(interfaceId, name);
  }

  return { error: 'Missing required parameters to identify the tab' };
}

// Create checkpoint for tab by name
export async function createTabCheckpointByName(
  interfaceId: string,
  name: string,
  description: string
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
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

// Create checkpoint for tab by ID
export async function createTabCheckpointById(id: string, description: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tabId=${id}`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    return { error: `Failed to create checkpoint: ${response.status}` };
  }

  return await response.json();
}

// Unified create checkpoint for tab function
export async function createTabCheckpointUnified(params: {
  id?: string;
  interfaceId?: string;
  name?: string;
  description: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, interfaceId, name, description } = params;

  // If tab ID is provided, use it directly
  if (id) {
    return createTabCheckpointById(id, description);
  }

  // Otherwise use interfaceId+name
  if (interfaceId && name) {
    return createTabCheckpointByName(interfaceId, name, description);
  }

  return { error: 'Missing required parameters to identify the tab' };
}

export async function getTabCheckpointByName(interfaceId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interfaceId=${interfaceId}&name=${encodeURIComponent(name)}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    return { error: `Failed to get tab checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getTabCheckpointById(tabId: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tabId=${tabId}`, {
    method: 'GET',
    headers: { apiKey: apiKey },
    cache: 'no-store',
  });
  if (!response.ok) {
    return { error: `Failed to get tab checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getTabCheckpointUnified(params: {
  id?: string;
  interfaceId?: string;
  name?: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, interfaceId, name } = params;
  if (id) {
    return getTabCheckpointById(id);
  }
  if (interfaceId && name) {
    return getTabCheckpointByName(interfaceId, name);
  }
  return { error: 'Missing parameters to identify the tab checkpoint' };
}

// Export tab template
export async function exportTabAsTemplate(
  params: Omit<
    ExportTabTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >,
  options?: Pick<
    ExportTabTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >
): Promise<TemplateExportResponse<TabTemplateSchema> | { error: string }> {
  const apiKey = await requireUserApiKey();
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

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab?export_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to export tab template: ${response.status}` };
  }

  return await response.json();
}

// Import tab template
export async function importTabFromTemplate(
  template: TabTemplateSchema,
  params: Pick<ImportTabTemplateRequest, 'interfaceId' | 'interfaceName'>,
  options: Omit<
    ImportTabTemplateRequest,
    'template' | 'interfaceId' | 'interfaceName'
  > = {} as Omit<ImportTabTemplateRequest, 'template' | 'interfaceId' | 'interfaceName'>
): Promise<TemplateImportResponse | { error: string }> {
  const apiKey = await requireUserApiKey();
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

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tab?import_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to import tab template: ${response.status}`, success: false };
  }

  return await response.json();
}
