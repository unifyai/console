'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { TileTemplateSchema } from '@/types/interfaces/grid';
import {
  TilePosition,
  UpdateTileRequest,
  CreateTileRequest,
  ExportTileTemplateRequest,
  ImportTileTemplateRequest,
  TemplateImportResponse,
  TemplateExportResponse,
} from '@/types/interfaces/grid';

// List tiles in tab
export async function listTiles(
  tabId: string,
  type?: string,
  checkpoint: boolean = false,
  signal?: AbortSignal
) {
  const apiKey = await requireUserApiKey();
  let url = `${process.env.NEXTAUTH_URL}/api/tile?tabId=${tabId}&checkpoint=${checkpoint}`;
  if (type) {
    url += `&type=${type}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { apiKey: apiKey },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    return { error: `Failed to list tiles: ${response.status}` };
  }

  return await response.json();
}

// Get tile by name
export async function getTileByName(tabId: string, name: string, checkpoint: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tabId=${tabId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return { error: `Failed to get tile: ${response.status}` };
  }

  const tiles = await response.json();
  return tiles.length > 0 ? tiles[0] : null;
}

// Get tile by ID
export async function getTileById(id: string, checkpoint: boolean = false) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tileId=${id}&checkpoint=${checkpoint}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

// Unified get tile function
export async function getTileUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name, checkpoint = false } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return getTileById(id, checkpoint);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return getTileByName(tabId, name, checkpoint);
  }

  return null;
}

// Create tile
export async function createTile(
  tabId: string,
  name: string,
  position: TilePosition,
  data: Omit<CreateTileRequest, 'tileId' | 'tabId' | 'name' | 'position'>,
  tileId?: string,
  type?: string
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({
      tabId,
      name,
      position,
      type,
      tileId,
      ...data,
    }),
  });

  if (!response.ok) {
    return { error: `Failed to create tile: ${response.status}` };
  }

  return await response.json();
}

// Update tile by name
export async function updateTileByName(
  tabId: string,
  name: string,
  data: UpdateTileRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tabId=${tabId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    return { error: `Failed to update tile: ${response.status}` };
  }

  return await response.json();
}

// Update tile by ID
export async function updateTileById(
  id: string,
  data: UpdateTileRequest,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tileId=${id}&checkpoint=${checkpoint}`,
    {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    return { error: `Failed to update tile: ${response.status}` };
  }

  return await response.json();
}

// Unified update tile function
export async function updateTileUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
  data: UpdateTileRequest;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name, data, checkpoint = false } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return updateTileById(id, data, checkpoint);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return updateTileByName(tabId, name, data, checkpoint);
  }

  return { error: 'Missing required parameters to identify the tile' };
}

// Patch tile by name
export async function patchTileByName(
  tabId: string,
  name: string,
  updateData: Partial<UpdateTileRequest>,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tabId=${tabId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
    {
      method: 'PATCH',
      headers: { apiKey: apiKey },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    return { error: `Failed to patch tile: ${response.status}` };
  }

  return await response.json();
}

// Patch tile by ID
export async function patchTileById(
  id: string,
  updateData: Partial<UpdateTileRequest>,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tileId=${id}&checkpoint=${checkpoint}`,
    {
      method: 'PATCH',
      headers: { apiKey: apiKey },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    return { error: `Failed to patch tile: ${response.status}` };
  }

  return await response.json();
}

// Unified patch tile function
export async function patchTileUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
  updateData: Partial<UpdateTileRequest>;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name, updateData, checkpoint = false } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return patchTileById(id, updateData, checkpoint);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return patchTileByName(tabId, name, updateData, checkpoint);
  }

  return { error: 'Missing required parameters to identify the tile' };
}

// Patch specialized tile by name
export async function patchSpecializedTileByName(
  tabId: string,
  name: string,
  tileType: 'Table' | 'Plot' | 'View',
  updateData: Record<string, any>,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  // Build query parameters
  const queryParams = new URLSearchParams();

  // Required parameters
  queryParams.append('tile_type', tileType);
  queryParams.append('tabId', tabId);
  queryParams.append('name', name);
  queryParams.append('checkpoint', checkpoint.toString());

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`, {
    method: 'PATCH',
    headers: { apiKey: apiKey },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
  }

  return await response.json();
}

// Patch specialized tile by ID
export async function patchSpecializedTileById(
  id: string,
  tileType: 'Table' | 'Plot' | 'View',
  updateData: Record<string, any>,
  checkpoint: boolean = false
) {
  const apiKey = await requireUserApiKey();
  // Build query parameters
  const queryParams = new URLSearchParams();

  // Required parameters
  queryParams.append('tileId', id);
  queryParams.append('tile_type', tileType);
  queryParams.append('checkpoint', checkpoint.toString());

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`, {
    method: 'PATCH',
    headers: { apiKey: apiKey },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
  }

  return await response.json();
}

// Unified patch specialized tile function
export async function patchSpecializedTileUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
  tileType: 'Table' | 'Plot' | 'View';
  updateData: Record<string, any>;
  checkpoint?: boolean;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name, tileType, updateData, checkpoint = false } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return patchSpecializedTileById(id, tileType, updateData, checkpoint);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return patchSpecializedTileByName(tabId, name, tileType, updateData, checkpoint);
  }

  return { error: 'Missing required parameters to identify the tile' };
}

// Delete tile by name
export async function deleteTileByName(tabId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile?tabId=${tabId}&name=${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    }
  );

  if (!response.ok) {
    return { error: `Failed to delete tile: ${response.status}` };
  }

  return await response.json();
}

// Delete tile by ID
export async function deleteTileById(id: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile?tileId=${id}`, {
    method: 'DELETE',
    headers: { apiKey: apiKey },
  });

  if (!response.ok) {
    return { error: `Failed to delete tile: ${response.status}` };
  }

  return await response.json();
}

// Unified delete tile function
export async function deleteTileUnified(params: { id?: string; tabId?: string; name?: string }) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return deleteTileById(id);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return deleteTileByName(tabId, name);
  }

  return { error: 'Missing required parameters to identify the tile' };
}

// Create checkpoint for tile by name
export async function createTileCheckpointByName(tabId: string, name: string, description: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tabId=${tabId}&name=${encodeURIComponent(name)}`,
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

// Create checkpoint for tile by ID
export async function createTileCheckpointById(id: string, description: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tileId=${id}`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    return { error: `Failed to create checkpoint: ${response.status}` };
  }

  return await response.json();
}

// Unified create checkpoint for tile function
export async function createTileCheckpointUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
  description: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name, description } = params;

  // If tile ID is provided, use it directly
  if (id) {
    return createTileCheckpointById(id, description);
  }

  // Otherwise use tabId+name
  if (tabId && name) {
    return createTileCheckpointByName(tabId, name, description);
  }

  return { error: 'Missing required parameters to identify the tile' };
}

export async function getTileCheckpointByName(tabId: string, name: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tabId=${tabId}&name=${encodeURIComponent(name)}`,
    {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    return { error: `Failed to get tile checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getTileCheckpointById(tileId: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tileId=${tileId}`, {
    method: 'GET',
    headers: { apiKey: apiKey },
    cache: 'no-store',
  });
  if (!response.ok) {
    return { error: `Failed to get tile checkpoint: ${response.status}` };
  }
  return await response.json();
}

export async function getTileCheckpointUnified(params: {
  id?: string;
  tabId?: string;
  name?: string;
}) {
  const apiKey = await requireUserApiKey();
  const { id, tabId, name } = params;
  if (id) {
    return getTileCheckpointById(id);
  }
  if (tabId && name) {
    return getTileCheckpointByName(tabId, name);
  }
  return { error: 'Missing parameters to identify the tile checkpoint' };
}

// Export tile template
export async function exportTileAsTemplate(
  params: Omit<
    ExportTileTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >,
  options?: Pick<
    ExportTileTemplateRequest,
    'checkpoint' | 'includeMetadata' | 'description' | 'tags' | 'templateName'
  >
): Promise<TemplateExportResponse<TileTemplateSchema> | { error: string }> {
  const apiKey = await requireUserApiKey();
  const { tileId, tabId, tileName } = params;

  const requestBody: ExportTileTemplateRequest = {
    tileId,
    tabId,
    tileName,
    checkpoint: options?.checkpoint || false,
    includeMetadata: options?.includeMetadata !== false,
    description: options?.description,
    tags: options?.tags || [],
    templateName: options?.templateName,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile?export_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to export tile template: ${response.status}` };
  }

  return await response.json();
}

// Import tile template
export async function importTileFromTemplate(
  template: TileTemplateSchema,
  params: Pick<ImportTileTemplateRequest, 'tabId' | 'interfaceId' | 'tabName'>,
  options: Omit<
    ImportTileTemplateRequest,
    'template' | 'tabId' | 'interfaceId' | 'tabName'
  > = {} as Omit<ImportTileTemplateRequest, 'template' | 'tabId' | 'interfaceId' | 'tabName'>
): Promise<TemplateImportResponse | { error: string }> {
  const apiKey = await requireUserApiKey();
  const { tabId, interfaceId, tabName } = params;

  const requestBody: ImportTileTemplateRequest = {
    projectName: options.projectName,
    template,
    tabId,
    interfaceId,
    tabName,
    newTileName: options.newTileName,
    validateFirst: options.validateFirst || true,
    autoSanitize: options.autoSanitize || true,
    overwriteExisting: options.overwriteExisting || false,
  };

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/tile?import_template`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return { error: `Failed to import tile template: ${response.status}`, success: false };
  }

  return await response.json();
}
