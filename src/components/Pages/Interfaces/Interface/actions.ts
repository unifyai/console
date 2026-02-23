import { QueryClient } from '@tanstack/react-query';
import {
  ProjectsActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  LogsActions,
  ContextActions,
  FavouritesActions,
  Favourite,
  InterfaceTemplateSchema,
  TemplateExportResponse,
} from '@/types/interfaces/grid';
import { createCompleteDefaultInterface } from '@/utils/interfaces/interfaceSelector';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';

// Comprehensive action bundle interface
export interface InterfacePageActions {
  projects: ProjectsActions;
  favourites: FavouritesActions;
  interfaces: GranularInterfaceActions;
  tabs: GranularTabActions;
  tiles: GranularTileActions;
  logs: LogsActions;
  contexts: ContextActions;
}

// ===============================================
// Project-level action helpers
// ===============================================

export async function createProject(
  name: string,
  actions: ProjectsActions,
  existingProjects: string[],
  icon?: string
): Promise<{ success: boolean; error?: string; projectName?: string }> {
  if (!name.trim()) {
    return { success: false, error: 'Project name is required.' };
  }

  if (existingProjects.includes(name.trim())) {
    return { success: false, error: 'A project with this name already exists.' };
  }

  try {
    if (!actions || typeof actions.create !== 'function') {
      throw new Error('Project actions not available');
    }
    // Backend now supports icon field
    const response = await (actions as any).create(name.trim(), icon); // cast any to support extended signature
    if ('info' in response) {
      showSuccessToast('Project created successfully');
      return { success: true, projectName: name.trim() };
    }
    throw new Error(response.detail || 'Failed to create project');
  } catch (error) {
    const message = (error as Error).message;
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export async function renameProject(
  oldName: string,
  newName: string,
  actions: ProjectsActions,
  existingProjects: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!newName.trim()) {
    return { success: false, error: 'Project name cannot be empty.' };
  }

  if (existingProjects.includes(newName.trim())) {
    return { success: false, error: 'A project with this name already exists.' };
  }

  try {
    await actions.rename(oldName, newName.trim());
    showSuccessToast('Project renamed successfully');
    return { success: true };
  } catch (error) {
    const message = 'Failed to rename project.';
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export type DeleteProjectOption = 'project' | 'logs' | 'logsAndContexts';

export async function deleteProject(
  projectName: string,
  option: DeleteProjectOption,
  deleteFunctions: {
    project?: (project: string) => Promise<any>;
    logs?: (project: string) => Promise<any>;
    logsAndContexts?: (project: string) => Promise<any>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    let message: string;

    switch (option) {
      case 'project':
        if (deleteFunctions.project) {
          await deleteFunctions.project(projectName);
          message = 'Project deleted successfully';
        } else {
          throw new Error('Delete project function not available');
        }
        break;
      case 'logs':
        if (deleteFunctions.logs) {
          await deleteFunctions.logs(projectName);
          message = 'Project logs deleted successfully';
        } else {
          throw new Error('Delete logs function not available');
        }
        break;
      case 'logsAndContexts':
        if (deleteFunctions.logsAndContexts) {
          await deleteFunctions.logsAndContexts(projectName);
          message = 'Project logs and contexts deleted successfully';
        } else {
          throw new Error('Delete logs and contexts function not available');
        }
        break;
    }

    showSuccessToast(message);
    return { success: true };
  } catch (error) {
    const message = (error as Error).message;
    showErrorToast(message);
    return { success: false, error: message };
  }
}

// ===============================================
// Interface-level action helpers
// ===============================================

export async function createInterface(
  name: string,
  project: string,
  queryClient: QueryClient,
  actions: {
    interfaces: GranularInterfaceActions;
    tabs: GranularTabActions;
    tiles: GranularTileActions;
  },
  existingInterfaces: Array<{ id?: string; name: string }>
): Promise<{ success: boolean; error?: string; interface?: { id?: string; name: string } }> {
  if (!name.trim()) {
    return { success: false, error: 'Interface name is required.' };
  }

  if (existingInterfaces.some((iface) => iface.name.toLowerCase() === name.trim().toLowerCase())) {
    return { success: false, error: 'An interface with this name already exists.' };
  }

  try {
    const newInterface = await createCompleteDefaultInterface({
      queryClient,
      project,
      interfaceActions: actions.interfaces,
      tabActions: actions.tabs,
      tileActions: actions.tiles,
      baseName: name.trim(),
    });

    if (newInterface?.name) {
      showSuccessToast('Interface created successfully');
      return { success: true, interface: newInterface };
    } else {
      throw new Error('Failed to create interface.');
    }
  } catch (error) {
    const message = (error as Error).message;
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export async function renameInterface(
  interfaceId: string,
  currentName: string,
  newName: string,
  actions: GranularInterfaceActions,
  existingInterfaces: Array<{ id?: string; name: string }>
): Promise<{ success: boolean; error?: string }> {
  if (!newName.trim()) {
    return { success: false, error: 'Interface name is required.' };
  }

  if (newName.trim() === currentName) {
    return { success: true }; // No change needed
  }

  if (
    existingInterfaces.some(
      (iface) =>
        iface.name.toLowerCase() === newName.trim().toLowerCase() && iface.id !== interfaceId
    )
  ) {
    return { success: false, error: 'An interface with this name already exists.' };
  }

  try {
    await actions.update({
      interfaceId: interfaceId,
      data: { name: newName.trim() },
    });
    showSuccessToast('Interface renamed successfully');
    return { success: true };
  } catch (error) {
    const message = (error as Error).message;
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export async function deleteInterface(
  interfaceId: string,
  interfaceName: string,
  actions: GranularInterfaceActions
): Promise<{ success: boolean; error?: string }> {
  try {
    await actions.delete({ interfaceId: interfaceId });
    showSuccessToast(`Interface "${interfaceName}" deleted successfully`);
    return { success: true };
  } catch (error) {
    const message = 'Failed to delete interface';
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export async function exportInterfaceTemplate(
  interfaceId: string,
  interfaceName: string,
  project: string,
  actions: GranularInterfaceActions
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await actions.exportTemplate(
      { interfaceId: interfaceId, projectName: project, interfaceName: interfaceName },
      { includeMetadata: true, templateName: interfaceName }
    );

    if ('error' in result) {
      throw new Error(result.error);
    }

    // Create and download the file
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${interfaceName}-template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessToast('Template exported successfully');
    return { success: true };
  } catch (error) {
    const message = 'Failed to export template';
    showErrorToast(message);
    return { success: false, error: message };
  }
}

export async function importInterfaceTemplate(
  templateData: TemplateExportResponse<InterfaceTemplateSchema>,
  project: string,
  newInterfaceName: string,
  actions: GranularInterfaceActions,
  existingInterfaces: Array<{ id?: string; name: string }>
): Promise<{
  success: boolean;
  error?: string;
  importedInterface?: { id?: string; name: string };
}> {
  if (!newInterfaceName.trim()) {
    return { success: false, error: 'Interface name is required.' };
  }

  if (
    existingInterfaces.some((iface) => iface.name.toLowerCase() === newInterfaceName.toLowerCase())
  ) {
    return { success: false, error: 'An interface with this name already exists.' };
  }

  try {
    const result = await actions.importTemplate(templateData.template, {
      projectName: project,
      newInterfaceName: newInterfaceName.trim(),
      validateFirst: true,
      autoSanitize: true,
    });

    if ('error' in result) {
      throw new Error(result.error);
    }

    // Find the newly created interface
    const interfaces = await actions.list(project);
    const importedInterface = interfaces.find((i) => i.name === newInterfaceName.trim());

    showSuccessToast('Template imported successfully');
    return { success: true, importedInterface };
  } catch (error) {
    const message = (error as Error).message;
    showErrorToast(message);
    return { success: false, error: message };
  }
}

// ===============================================
// Favourites action helpers
// ===============================================

export async function toggleFavourite(
  itemName: string,
  currentFavourite: Favourite | null,
  actions: FavouritesActions,
  favourites: Favourite[] = []
): Promise<{ success: boolean; newFavourites?: Favourite[] }> {
  try {
    if (currentFavourite) {
      // Remove from favourites
      const success = await actions.delete(currentFavourite.id);
      if (success) {
        const newFavourites = favourites.filter((f) => f.id !== currentFavourite.id);
        showSuccessToast('Removed from Favourites');
        return { success: true, newFavourites };
      } else {
        throw new Error('Failed to remove from Favourites');
      }
    } else {
      // Add to favourites
      const newPosition = favourites.length;
      const newFavourite = await actions.create(itemName, 'layout-dashboard', newPosition);
      if (newFavourite) {
        const newFavourites = [...favourites, newFavourite];
        showSuccessToast('Added to Favourites');
        return { success: true, newFavourites };
      } else {
        throw new Error('Failed to add to Favourites');
      }
    }
  } catch (error) {
    console.error('Error toggling favourite:', error);
    showErrorToast('An error occurred while managing Favourites.');
    return { success: false };
  }
}
