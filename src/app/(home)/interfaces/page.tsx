import { getCurrentUser } from '@/lib/user/user';

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

const InterfacesPage = async ({ searchParams }: { searchParams: SearchParams }) => {
  // Debug logging for searchParams
  debugLog('[InterfacesPage] ==> SERVER COMPONENT RENDER <==');
  debugLog('[InterfacesPage] Received searchParams:', searchParams);
  debugLog('[InterfacesPage] Project:', searchParams?.project);
  debugLog('[InterfacesPage] Interface:', searchParams?.interface);
  debugLog('[InterfacesPage] Tab:', searchParams?.tab);
  debugLog('[InterfacesPage] All keys:', Object.keys(searchParams));
  debugLog('[InterfacesPage] Timestamp:', new Date().toISOString());

  // get user and api key
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  const UNIFY_ORG_ID = 5;
  const isUnifyMember = user.organizations?.some((o) => o.id === UNIFY_ORG_ID);
  if (!isUnifyMember) {
    redirect('/assistants');
  }

  const userId = user.id;
  const apiKey = user.apiKey;

  // get server actions - Legacy actions for backward compatibility
  const projectsActions = {
    get: await projects.getProjects(apiKey),
    create: await projects.createProject(apiKey),
    rename: await projects.renameProject(apiKey),
    update: await projects.patchProject(apiKey),
    delete: await projects.deleteProject(apiKey),
    exportTemplate: await projects.exportProjectAsTemplate(apiKey),
    importTemplate: await projects.importProjectFromTemplate(apiKey),
    getProject: await projects.getProject(apiKey),
    transferToOrg: await projects.transferProjectToOrg(apiKey),
    transferToPersonal: await projects.transferProjectToPersonal(apiKey),
  };

  const logsActions = {
    create: await logs.createLogs(apiKey),
    get: await logs.getLogs(apiKey),
    getMetrics: await logs.getLogMetrics(apiKey),
    delete: await logs.deleteLogs(apiKey),
    getLatest: await logs.getLatestTimestamp(apiKey),
    update: await logs.updateLogsWithSync(apiKey),
  };

  const derivedEntryActions = {
    create: await logs.createDerivedEntry(apiKey),
    update: await logs.updateDerivedEntry(apiKey),
  };

  const fieldsActions = {
    get: await logs.getLogFields(apiKey),
    rename: await logs.renameLogFields(apiKey),
  };

  const contextActions = {
    get: await contexts.getContexts(apiKey),
    create: await contexts.createContext(apiKey),
    delete: await contexts.deleteContext(apiKey),
    rename: await contexts.renameContext(apiKey),
  };

  // Favourites actions - gracefully handle failures
  let initialFavourites: Favourite[] = [];
  try {
    initialFavourites = await favourites.getFavourites(apiKey);
  } catch (error) {
    console.error('[InterfacesPage] Failed to fetch favourites:', error);
    // Continue without favourites rather than crashing the page
  }

  const favouritesActions = {
    create: await favourites.createFavourite(apiKey),
    delete: await favourites.deleteFavourite(apiKey),
  };

  // Create the granular actions using the factory functions
  const interfaceActions: GranularInterfaceActions = await createInterfaceActions(
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
    interfaces.importInterfaceFromTemplate,
    apiKey
  );

  const tabActions: GranularTabActions = await createTabActions(
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
    tabs.importTabFromTemplate,
    apiKey
  );

  const tileActions: GranularTileActions = await createTileActions(
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
    tiles.importTileFromTemplate,
    apiKey
  );

  const resourcesActions: ResourcesActions = {
    grantAccess: await resourceAccess.grantResourceAccessAction(apiKey),
    revokeAccess: await resourceAccess.revokeResourceAccessAction(apiKey),
    updateAccess: await resourceAccess.updateResourceAccessAction(apiKey),
    listAccess: await resourceAccess.listResourceAccessAction(apiKey),
    listRoles: await organizations.getOrganizationRolesAction(apiKey),
  };

  const userMeta = {
    organizations: user.organizations,
    id: user.id,
  };
  return (
    <Main
      project={searchParams?.project as string | null}
      interfaceName={searchParams?.interface as string | null}
      searchParams={searchParams}
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
