import { getCurrentUser } from '@/lib/user/user';
import { isUnifyStaffMember } from '@/lib/auth/unify-staff';

import * as projects from '@/lib/interfaces/projects';
import * as interfaces from '@/lib/interfaces/interfaces';
import * as tabs from '@/lib/interfaces/tabs';
import * as tiles from '@/lib/interfaces/tiles';
import * as logs from '@/lib/interfaces/logs';
import * as contexts from '@/lib/interfaces/contexts';
import * as favourites from '@/lib/interfaces/favourites';
import * as resourceAccess from '@/lib/user/resource-access';
import * as organizations from '@/lib/user/organization';

import { redirect } from 'next/navigation';
import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  Favourite,
} from '@/types/interfaces/grid';
import { ResourcesActions } from '@/types/resource';
import { createInterfaceActions, createTabActions, createTileActions } from './utils';
import Main from '@/components/Pages/Interfaces/Server/Main.server';
import { SearchParams } from 'nuqs';
import { isSelfHost } from '@/lib/environment/environment';

/**
 * Debug flag for UI initial state logging
 * Set NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE=true to enable detailed logging
 */
const DEBUG_UI_INITIAL_STATE = process.env.NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE === 'true';

/**
 * Conditional debug logger for UI initial state
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_UI_INITIAL_STATE) {
    console.log(...args);
  }
};

const InterfacesPage = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const resolvedSearchParams = await searchParams;
  // Debug logging for searchParams
  debugLog('[InterfacesPage] ==> SERVER COMPONENT RENDER <==');
  debugLog('[InterfacesPage] Received searchParams:', resolvedSearchParams);
  debugLog('[InterfacesPage] Project:', resolvedSearchParams?.project);
  debugLog('[InterfacesPage] Interface:', resolvedSearchParams?.interface);
  debugLog('[InterfacesPage] Tab:', resolvedSearchParams?.tab);
  debugLog('[InterfacesPage] All keys:', Object.keys(resolvedSearchParams));
  debugLog('[InterfacesPage] Timestamp:', new Date().toISOString());

  // get user
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  // Interfaces is not part of the self-host assistant experience.
  if (isSelfHost()) {
    redirect('/assistants');
  }

  // Internal page: requires a verified unify.ai session email operating
  // inside the Unify org (the org name alone is user-choosable).
  const isUnifyMember = isUnifyStaffMember(user.email, user.organizations);
  if (!isUnifyMember) {
    redirect('/assistants');
  }
  // get server actions - Legacy actions for backward compatibility
  const projectsActions = {
    get: projects.getProjects,
    create: projects.createProject,
    rename: projects.renameProject,
    update: projects.patchProject,
    delete: projects.deleteProject,
    exportTemplate: projects.exportProjectAsTemplate,
    importTemplate: projects.importProjectFromTemplate,
    getProject: projects.getProject,
    transferToOrg: projects.transferProjectToOrg,
    transferToPersonal: projects.transferProjectToPersonal,
  };

  const logsActions = {
    create: logs.createLogs,
    get: logs.getLogs,
    getMetrics: logs.getLogMetrics,
    delete: logs.deleteLogs,
    getLatest: logs.getLatestTimestamp,
    update: logs.updateLogsWithSync,
  };

  const derivedEntryActions = {
    create: logs.createDerivedEntry,
    update: logs.updateDerivedEntry,
  };

  const fieldsActions = {
    get: logs.getLogFields,
    rename: logs.renameLogFields,
  };

  const contextActions = {
    get: contexts.getContexts,
    create: contexts.createContext,
    delete: contexts.deleteContext,
    rename: contexts.renameContext,
  };

  // Favourites actions - gracefully handle failures
  let initialFavourites: Favourite[] = [];
  try {
    initialFavourites = await favourites.getFavourites();
  } catch (error) {
    console.error('[InterfacesPage] Failed to fetch favourites:', error);
    // Continue without favourites rather than crashing the page
  }

  const favouritesActions = {
    create: favourites.createFavourite,
    delete: favourites.deleteFavourite,
  };

  // Create the granular actions using the factory functions
  const interfaceActions: GranularInterfaceActions = createInterfaceActions(
    interfaces.listInterfaces,
    interfaces.getInterfaceByName,
    interfaces.getInterfaceById,
    interfaces.createNewInterface,
    interfaces.updateInterfaceByName,
    interfaces.updateInterfaceById,
    interfaces.deleteInterfaceByName,
    interfaces.deleteInterfaceById,
    interfaces.createInterfaceCheckpoint,
    interfaces.createInterfaceCheckpointById,
    interfaces.getInterfaceUnified,
    interfaces.updateInterfaceUnified,
    interfaces.deleteInterfaceUnified,
    interfaces.createInterfaceCheckpointUnified,
    interfaces.getInterfaceCheckpointByName,
    interfaces.getInterfaceCheckpointById,
    interfaces.getInterfaceCheckpointUnified,
    interfaces.exportInterfaceAsTemplate,
    interfaces.importInterfaceFromTemplate
  );

  const tabActions: GranularTabActions = createTabActions(
    tabs.listTabs,
    tabs.getTabByName,
    tabs.getTabById,
    tabs.getTabUnified,
    tabs.createTab,
    tabs.updateTabByName,
    tabs.updateTabById,
    tabs.updateTabUnified,
    tabs.deleteTabByName,
    tabs.deleteTabById,
    tabs.deleteTabUnified,
    tabs.createTabCheckpointByName,
    tabs.createTabCheckpointById,
    tabs.createTabCheckpointUnified,
    tabs.getTabCheckpointByName,
    tabs.getTabCheckpointById,
    tabs.getTabCheckpointUnified,
    tabs.exportTabAsTemplate,
    tabs.importTabFromTemplate
  );

  const tileActions: GranularTileActions = createTileActions(
    tiles.listTiles,
    tiles.getTileByName,
    tiles.getTileById,
    tiles.getTileUnified,
    tiles.createTile,
    tiles.updateTileByName,
    tiles.updateTileById,
    tiles.updateTileUnified,
    tiles.patchTileByName,
    tiles.patchTileById,
    tiles.patchTileUnified,
    tiles.patchSpecializedTileByName,
    tiles.patchSpecializedTileById,
    tiles.patchSpecializedTileUnified,
    tiles.deleteTileByName,
    tiles.deleteTileById,
    tiles.deleteTileUnified,
    tiles.createTileCheckpointByName,
    tiles.createTileCheckpointById,
    tiles.createTileCheckpointUnified,
    tiles.getTileCheckpointByName,
    tiles.getTileCheckpointById,
    tiles.getTileCheckpointUnified,
    tiles.exportTileAsTemplate,
    tiles.importTileFromTemplate
  );

  const resourcesActions: ResourcesActions = {
    grantAccess: resourceAccess.grantResourceAccessAction,
    revokeAccess: resourceAccess.revokeResourceAccessAction,
    updateAccess: resourceAccess.updateResourceAccessAction,
    listAccess: resourceAccess.listResourceAccessAction,
    listRoles: organizations.getOrganizationRolesAction,
  };

  const userMeta = {
    organizations: user.organizations,
    id: user.id,
  };
  return (
    <Main
      project={resolvedSearchParams?.project as string | null}
      interfaceName={resolvedSearchParams?.interface as string | null}
      searchParams={resolvedSearchParams}
      actions={{
        projectsActions,
        logsActions,
        derivedEntryActions,
        contextActions,
        fieldsActions,
        interfaceActions,
        tabActions,
        tileActions,
        favouritesActions,
        resourcesActions,
      }}
      initialFavourites={initialFavourites}
      userMeta={userMeta}
    />
  );
};

export default InterfacesPage;
