"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, lazy, useCallback } from 'react';
import { Loader2, Search, Plus, RefreshCw } from "lucide-react";
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';
import { useRouter } from "next/navigation";
import { Tabs, TabsContent } from "../../../UI/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../../UI/dialog";
import ActionButton from "../../../Common/Buttons/Action";
import { Button } from "../../../UI/button";
import { Icon } from "../../../UI/icon-picker";
import SkeletonLoader from "../../../Common/Loaders/SkeletonLoader";
// InterfaceButtons is loaded lazily to reduce initial JS
// import InterfaceTabs from "./InterfaceTabs"; // HIDDEN: Using sidebar navigation for tabs instead
import ProjectButtons from "./Buttons/ProjectButtons";
import { useQueryState } from "nuqs";
import { ProjectsActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, FileActions, Favourite, FavouritesActions } from '@/types/interfaces/grid';
import { debounce } from 'lodash';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import AutoComplete from '../../../Common/Misc/AutoComplete';
import { useStoreApiContext, useStoreContext } from '@/contexts/providers/StoreProvider';
import { Command } from '@/contexts/slices/selectors/commands';
import { iconMap } from '@/constants/logs';
import dynamic from 'next/dynamic';
import { useCreateTabQuery, useUpdateTabQuery } from '@/hooks/Interfaces/Query/useTabsQuery';
import { useSaveTabWithTilesQuery } from '@/hooks/Interfaces/Query/useSaveTabWithTilesQuery';
import { useCommand } from '@/contexts/hooks/commands/useCommand';
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';
import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery';
import { useInterfaceSync } from '@/contexts/hooks/interface/sync/useInterfaceSync';
import { useTabSync } from '@/contexts/hooks/tab/sync';
import { selectActiveTab, selectTotalInactiveTabsForInterface } from '@/contexts/selectors/tab';
import { useInterfaceData } from '@/contexts/hooks/interface/useInterfaceData';
import SaveResetOverlay from './SaveResetOverlay';
import { useSidebar } from '@/components/UI/sidebar';
import { ScrollArea } from '../../../UI/scroll-area';
import InterfaceNav from './InterfaceNav';
import { withLoadingToastFn } from '@/components/Common/Toasts/notifications'
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { TileProps } from '@/types/interfaces/grid';
import { cn } from '@/lib/utils';
import { useListInterfacesQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery'
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery';
import { 
  createInterfaceUrl,
  createCompleteDefaultInterface,
} from "@/utils/interfaces/interfaceSelector"

function getUniqueDefaultInterfaceName(baseProject: string, actions: GranularInterfaceActions) {
  // This is a small wrapper to keep call sites consistent if we later centralize naming
  // We cannot query synchronously here; the real uniqueness check is handled server-side.
  // Keep a deterministic prefix; server can add suffixes as needed.
  return Promise.resolve('Default');
}

export const PageScrollContext = React.createContext<React.RefObject<HTMLDivElement> | null>(null);
export const InterfaceNavContext = React.createContext<{
  isNavigating: boolean;
  beginNavigation: () => number;
  setProject: (project: string | null, options?: { openProjectSelection?: boolean; openInterfaceSelection?: boolean }) => void;
  setInterface: (projectId: string, interfaceName: string) => Promise<void>;
}>({ isNavigating: false, beginNavigation: () => 0, setProject: () => {}, setInterface: async () => {} });

// Lazy load components
const DefaultProject = lazy(() => import('./Buttons/DefaultProject'));
const FocusDialog = lazy(() => import('./Buttons/FocusDialog'));
const EditTileName = lazy(() => import('./Buttons/EditTileName'));
const Tab = lazy(() => import('../Tab/Tab'));
const InterfaceButtons = lazy(() => import('./Buttons/InterfaceButtons'));
const Toaster = dynamic(() => import('sonner').then(m => m.Toaster), { ssr: false });

/**
 * Debug flag for tab prefetching indicators
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable streaming indicators
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

interface InterfaceComponentProps {
  interfaceId: string;
  projectsActions: ProjectsActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
  favouritesActions: FavouritesActions;
  initialFavourites: Favourite[];
}

const Interface = ({ 
  interfaceId, 
  projectsActions,
  interfaceActions,
  tabActions,
  tileActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
  fileActions,
  favouritesActions,
  initialFavourites,
}: InterfaceComponentProps) => {

  const router = useRouter();
  // Query params - project/interface use deep routing (trigger server), tab uses shallow (client-only)
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });
  const [interfaceQueryParam, setInterfaceQueryParam] = useQueryState("interface", { shallow: false });
  const [tabQueryParam, setTabQueryParam] = useQueryState("tab", { shallow: true });  // Shallow for instant switching
  const [selectProjectParam, setSelectProjectParam] = useQueryState("selectProject", { shallow: false });
  const [selectInterfaceParam, setSelectInterfaceParam] = useQueryState("selectInterface", { shallow: false });
  const [noticeParam, setNoticeParam] = useQueryState("notice", { shallow: false });
  const [missingParam, setMissingParam] = useQueryState("missing", { shallow: false });
  const [isSwitchingInterface, setIsSwitchingInterface] = useState(false);
  const [isRefreshingInterface, setIsRefreshingInterface] = useState(false);
  const [tabBarReady, setTabBarReady] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interfaceLoadFailures, setInterfaceLoadFailures] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const lastNoticeKeyRef = useRef<string | null>(null);
  const navTokenRef = useRef(0);
  const beginNavigation = useCallback(() => { navTokenRef.current += 1; return navTokenRef.current; }, []);
  const storeApi = useStoreApiContext(); // storeApi for seeding and queue worker
  const queryClient = useQueryClient();
  // Global bootstrap error overlay state
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapRetryToken, setBootstrapRetryToken] = useState(0);

  // Seed contexts on project change
  const activeProjectId = projectQueryParam || null;
  const contextsQuery = useListContextsQuery(activeProjectId, contextActions);
  useEffect(() => {
    if (!activeProjectId) return;
    if (contextsQuery.data && Array.isArray(contextsQuery.data)) {
      const s = storeApi.getState() as any;
      s.setProjectContexts?.(activeProjectId, contextsQuery.data.map((c: any) => c.name));
      if (s.projectDefaultContext?.[activeProjectId] === undefined) {
        s.setProjectDefaultContext?.(activeProjectId, null);
      }
    }
  }, [activeProjectId, contextsQuery.data, storeApi]);

  // Show error notification for context failures (non-blocking) - only once per project
  const contextsErrorShownRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (contextsQuery.isError && activeProjectId && !contextsErrorShownRef.current.has(activeProjectId)) {
      contextsErrorShownRef.current.add(activeProjectId);
      showErrorToast(
        'Failed to load contexts',
        'Some features may be unavailable. Context selection will not work until this is resolved.'
      );
    }
  }, [contextsQuery.isError, activeProjectId]);
  
  // Helper to render icon (similar to renderSidebarIcon in InterfaceNav)
  const renderIcon = (iconStr: string | undefined | null, className: string, defaultIcon: string = 'folder') => {
    let icon = iconStr;
    if (!icon || typeof icon !== 'string' || icon.trim() === '' || 
        icon === 'null' || icon === 'undefined' || icon === 'none') {
      icon = defaultIcon;
    } else {
      icon = icon.trim();
    }
    
    // Check if it's an emoji or special character
    if (/[^a-zA-Z0-9_-]/.test(icon)) {
      return <span className={cn(className, "inline-flex items-center justify-center")}>{icon}</span>;
    }
    
    return <Icon name={icon as any} className={className} />;
  };
  
  // Auto-select interface when none is specified
  const shouldAutoSelectInterface = !interfaceId && projectQueryParam && selectInterfaceParam !== 'true';
  const { data: projectInterfaces = [], isLoading: isLoadingInterfaces, isError: isErrorInterfaces, refetch: refetchInterfaces } = useListInterfacesQuery(
    shouldAutoSelectInterface ? projectQueryParam : null,
    interfaceActions
  );
  
  // Add a flag to track if we're deliberately showing selection screen
  const [preventAutoSelect, setPreventAutoSelect] = useState(false);
  
  // Track which interface is being loaded
  const [loadingInterfaceId, setLoadingInterfaceId] = useState<string | null>(null);
  
  // Track which project is being loaded
  const [loadingProjectName, setLoadingProjectName] = useState<string | null>(null);
  
  // Show project/interface selection when user deliberately deselected
  const showProjectSelection = selectProjectParam === 'true';
  const showInterfaceSelection = selectInterfaceParam === 'true' && projectQueryParam && !interfaceId;
  
  // Set preventAutoSelect when showing selection screens
  useEffect(() => {
    if (showInterfaceSelection || showProjectSelection) {
      setPreventAutoSelect(true);
    } else {
      setPreventAutoSelect(false);
    }
  }, [showInterfaceSelection, showProjectSelection]);
  
  // Get projects from store to check if Assistants project exists
  const projects = useStoreContext(state => state.projects);
  const hasAssistantsProject = projects?.includes("Assistants");
  
  // Determine if we should auto-open the project selection screen when no projects exist
  const shouldAutoShowProjectSelection = !projectQueryParam && !interfaceQueryParam && !hasAssistantsProject;
  
  // Effective flag to render the project selection screen
  const effectiveShowProjectSelection = showProjectSelection || shouldAutoShowProjectSelection;
  
  // Ensure the URL reflects the selection screen state when auto-showing
  useEffect(() => {
    if (shouldAutoShowProjectSelection && selectProjectParam !== 'true') {
      setSelectProjectParam('true');
    }
  }, [shouldAutoShowProjectSelection, selectProjectParam, setSelectProjectParam]);
  
  // Bootstrap batch for project change
  const { data: bootstrapData, isError: isBootstrapError, error: bootstrapErrorObj, refetch: refetchBootstrap } = useQuery({
    queryKey: ['bootstrap', projectQueryParam],  // Removed bootstrapRetryToken to prevent unnecessary refetches
    queryFn: async () => {
      if (!projectQueryParam) return null;
      const res = await fetch(`/api/bootstrap?project=${encodeURIComponent(projectQueryParam)}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to bootstrap');
      }
      return res.json();
    },
    enabled: !!projectQueryParam,
    staleTime: 5 * 60 * 1000,  // 5 minutes - bootstrap data doesn't change often
    gcTime: 30 * 60 * 1000,     // 30 minutes - keep in cache longer
    refetchOnMount: false,       // Don't refetch if we have cached data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2,                    // Retry twice on failure
  });

  // Warm caches after bootstrap
  useEffect(() => {
    const data: any = bootstrapData as any;
    if (!data || !projectQueryParam) return;
    try {
      if (Array.isArray(data.projectsTree)) {
        queryClient.setQueryData(['projects', 'tree'], data.projectsTree);
      }
      if (Array.isArray(data.interfaces)) {
        queryClient.setQueryData(['interfaces', projectQueryParam, false], data.interfaces);
        queryClient.setQueryData(['interfaces', projectQueryParam], data.interfaces);
      }
      if (Array.isArray(data.contexts)) {
        queryClient.setQueryData(['contexts', projectQueryParam], data.contexts);
        // Seed store contexts if not already present
        const s = storeApi.getState() as any;
        s.setProjectContexts?.(projectQueryParam, data.contexts.map((c: any) => c.name));
        if (s.projectDefaultContext?.[projectQueryParam] === undefined) {
          s.setProjectDefaultContext?.(projectQueryParam, null);
        }
      }
    } catch {}
  }, [bootstrapData, projectQueryParam, queryClient]);

  // Fetch project tree with icons
  const { data: projectTree = [], isError: isProjectTreeError, error: projectTreeErrorObj, refetch: refetchProjectTree } = useQuery<
    Array<{project:string; icon:string; interfaces:Array<{id: string; name: string; icon?: string; updated_at?: string}>; favorite:boolean; position:number|null}>
  >({
    queryKey: ['projects', 'tree'],
    queryFn: async () => {
      const res = await fetch('/api/projects/tree')
      if (!res.ok) throw new Error('Failed to fetch project tree')
      return res.json()
    },
    initialData: Array.isArray((bootstrapData as any)?.projectsTree) ? (bootstrapData as any)?.projectsTree : undefined,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: false,
  });
  
  // Get interfaces from projectTree for selection screen (faster than separate API call)
  const safeProjectTree = Array.isArray(projectTree) ? projectTree : [];
  const currentProjectData = safeProjectTree.find(p => p.project === projectQueryParam);
  const interfacesForSelection = currentProjectData?.interfaces || [];
  const isLoadingInterfacesForSelection = showInterfaceSelection && safeProjectTree.length === 0;

  useEffect(() => {
    // When the interface param changes (navigation completes), hide the loader.
    setIsSwitchingInterface(false);
    setLoadingMessage('Loading...');
    setLoadingProjectName(null);
    setLoadingInterfaceId(null);    
  }, [interfaceQueryParam]);

  useEffect(() => {
    // Reset failure count when the project changes
    setInterfaceLoadFailures(0);
   }, [projectQueryParam]);  

  useEffect(() => {
    // Trigger tab bar entrance animation after mount
    const t = setTimeout(() => setTabBarReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!noticeParam) return;

    const missing = Array.isArray(missingParam) ? missingParam[0] : missingParam;
    const key = `${noticeParam}:${missing || ''}`;
    if (lastNoticeKeyRef.current === key) {
      // Already shown this notice in this session
      setNoticeParam(null);
      setMissingParam(null);
      return;
    }
    lastNoticeKeyRef.current = key;
    if (noticeParam === 'projectNotFound') {
      showErrorToast('Project not found', undefined, `notice:${key}`);
    } else if (noticeParam === 'interfaceNotFound') {
      showErrorToast('Interface not found', undefined, `notice:${key}`);
    }

    // Clear the notice params so it only shows once
    setNoticeParam(null);
    setMissingParam(null);
  }, [noticeParam, missingParam, setNoticeParam, setMissingParam]);

  const pageScrollContainerRef = useRef<HTMLDivElement>(null);

  // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedInterfaceActions } = useInterfaceSync(interfaceId, projectQueryParam, interfaceActions, tabActions);
  const syncedInterfaceDataActions = syncedInterfaceActions?.data ?? null;
  const syncedInterfaceUIActions = syncedInterfaceActions?.ui ?? null;
  
  // Get current active tab name using selector - this is our source of truth
  const state = useStoreApiContext().getState();
  const activeTab = selectActiveTab(state, interfaceId);
  const activeTabId = activeTab?.id || null;
  const activeTabName = activeTab?.name || null;
  
  // Wrapper that updates both Zustand store AND URL (shallow)
  const setTabQueryParamFromSync = useCallback((tabName: string | null) => {
    if (tabName && syncedInterfaceUIActions?.setActiveTab) {
      syncedInterfaceUIActions.setActiveTab(tabName);
    }
    setTabQueryParam(tabName);  // Update URL with shallow routing (no server re-render)
  }, [syncedInterfaceUIActions, setTabQueryParam]);

  // Sync URL when active tab changes in store (e.g. from sidebar navigation)
  useEffect(() => {
    if (activeTabName && activeTabName !== tabQueryParam) {
      setTabQueryParam(activeTabName);
    }
  }, [activeTabName, tabQueryParam, setTabQueryParam]);

  // Store state and actions for UI control
  const focusPaneOpen = useStoreContext((state) => state.focusPaneOpen);
  const saveInterfaceOpen = useStoreContext((state) => state.saveInterfaceOpen);
  const setFocusPaneOpen = useStoreContext((state) => state.setFocusPaneOpen);
  const setSaveInterfaceOpen = useStoreContext((state) => state.setSaveInterfaceOpen);
  const deleteProjectOpen = useStoreContext((state) => state.deleteProjectOpen);
  const createProjectOpen = useStoreContext((state) => state.createProjectOpen);
  const selectProjectsOpen = useStoreContext((state) => state.selectProjectsOpen);
  const fileUploadOpen = useStoreContext((state) => state.fileUploadOpen);
  const globalContextOpen = useStoreContext((state) => state.globalContextOpen);
  const setGlobalContextOpen = useStoreContext((state) => state.setGlobalContextOpen);
  
  const setDeleteProjectOpen = useStoreContext((state) => state.setDeleteProjectOpen);
  const setCreateProjectOpen = useStoreContext((state) => state.setCreateProjectOpen);
  const setSelectProjectsOpen = useStoreContext((state) => state.setSelectProjectsOpen);
  const setFileUploadOpen = useStoreContext((state) => state.setFileUploadOpen);
  
  // Global UI modes
  const { isEditMode, isDashboardMode, setEditMode, setDashboardMode } = useGlobalUIMode();

  // Command state
  const storeCommands = useStoreContext((state) => state.commands);

  // Initialize React Query mutations for tab operations
  const createTabMutation = useCreateTabQuery();
  const updateTabMutation = useUpdateTabQuery();
  const saveTabWithTilesMutation = useSaveTabWithTilesQuery(tabActions, tileActions, "Manual save");

  // Use granular interface and tab hooks for better performance
  const { dataActions: interfaceDataActions } = useInterfaceData(interfaceId);
  const { data: tabDataState, dataActions: tabDataActions } = useTabData(activeTabId, interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(activeTabId, interfaceId);

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(activeTabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;
  const syncedTabUIActions = syncedTabActions?.ui ?? null;

  // NEW: Use tab streaming for all tab data management
  const tabStreamingQuery = useTabStreamingQuery(
    interfaceId,
    activeTabName,
    projectQueryParam,
    {
      tabActions,
      tileActions,
      fieldsActions,
      logsActions,
      projectsActions,
      contextActions,
    },
    {
      enableNonActivePrefetch: !isSwitchingInterface,
      prefetchMode: 'full',  // Prefetch complete data so tabs are ready
      deferMs: 1200,
      concurrency: 2,  // Prefetch 2 tabs concurrently
    }
  );

  // Sidebar state for proper positioning
  const isMobile = useIsMobile();
  const { state: sidebarState } = useSidebar();
  const sidebarWidth = isMobile ? '0rem' : sidebarState === 'collapsed' ? '3rem' : '14rem';

  // Overlay state for save/reset operations
  const [overlayState, setOverlayState] = useState<{
    isVisible: boolean;
    operation: 'saving' | 'resetting' | 'refreshing' | null;
    status: 'loading' | 'success' | 'error' | null;
  }>({
    isVisible: false,
    operation: null,
    status: null,
  });

  // Track refresh status for navbar icon
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Initialize command hooks
  const commandHooks = useCommand({
    projectId: projectQueryParam,
    interfaceId,
    tabId: activeTabId,
    setProjectQueryParam,
    setTabQueryParam: setTabQueryParamFromSync,
    setInterfaceQueryParam,
    projectActions: projectsActions,
    interfaceActions,
    tabActions,
    tileActions,
    fileActions,
    logsActions,
    contextActions,
    codeActions,
    setOverlayState,
  });
  const resetInterfaceCommand = storeCommands.find(cmd => cmd.id === "reset-interface");

  // Reference for the grid container
  const gridRef = useRef<HTMLDivElement>(null);

  // Get tab names from streaming query
  const tabNames = useMemo(() => interfaceDataActions?.getTabNames() || [], [interfaceDataActions]);

  // Auto-select first tab if no active tab is set and tabs are available
  useEffect(() => {
    if (tabNames.length > 0 && syncedInterfaceUIActions && (!activeTabName || (activeTabName && !tabNames.includes(activeTabName)))) {
      
      syncedInterfaceUIActions.setActiveTab(tabNames[tabNames.length - 1]);
    }
  }, [activeTabName, tabNames, syncedInterfaceUIActions]);

  // Track pending tab change
  const [pendingTabChange, setPendingTabChange] = useState<string | undefined>(undefined);

  // Actual tab switch handler - will be debounced
  const performTabSwitch = useCallback((value: string | undefined) => {
    if (!value || !syncedInterfaceUIActions) return;
    
    // Clear the pending state
    setPendingTabChange(undefined);
    
    // Check if tab data is already cached
    const isCached = tabStreamingQuery?.switchTab(value) || false;
    
    if (isCached) {
      // Instant switch - data is already available
      syncedInterfaceUIActions.setActiveTab(value);
    } else {
      // Show loading state while fetching
      if (tabUIActions) {
        tabUIActions.setPending(true);
      }
      syncedInterfaceUIActions.setActiveTab(value);
    }
  }, [syncedInterfaceUIActions, tabStreamingQuery, tabUIActions]);

  // Create debounced version of tab switch handler
  const debouncedTabSwitch = useMemo(
    () => debounce(performTabSwitch, 100),
    [performTabSwitch]
  );

  // Enhanced tab change handler with debounced switching
  const handleTabChange = useCallback((value: string | undefined) => {
    if (!value) return;
    
    // Block tab switching during mutations to prevent state desync
    if (createTabMutation.isPending || updateTabMutation.isPending || saveTabWithTilesMutation.isPending) {
      console.log('[Interface] Blocking tab switch - mutation in progress');
      return;
    }
    
    // Set pending tab change immediately for UI feedback
    setPendingTabChange(value);
    
    // Debounce the actual tab switch
    debouncedTabSwitch(value);
  }, [debouncedTabSwitch, createTabMutation.isPending, updateTabMutation.isPending, saveTabWithTilesMutation.isPending]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedTabSwitch.cancel();
    };
  }, [debouncedTabSwitch]);

  

  // Auto-select interface when none is specified
  useEffect(() => {
    // Add delay and additional check to prevent race conditions
    if (!shouldAutoSelectInterface || isLoadingInterfaces || isErrorInterfaces || !projectQueryParam || preventAutoSelect) return;

    // Debounce the auto-selection to ensure URL params have settled
    const timer = setTimeout(() => {
      // Double-check the selectInterface param hasn't been set in the meantime
      const currentParams = new URLSearchParams(window.location.search);
      if (currentParams.get('selectInterface') === 'true') {
        return;
      }

      const selectOrCreateInterface = async () => {
        try {
          const tokenAtStart = navTokenRef.current;
          setLoadingMessage('Loading interfaces...');
          setIsSwitchingInterface(true);

          // Only create a default interface if the list call completed and confirmed empty
          if (projectInterfaces.length > 0) {
            // If interfaces exist, find the most recently updated one and redirect.
            const sortedInterfaces = [...projectInterfaces].sort((a, b) => {
              const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
              const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
              return dateB - dateA; // Sort descending (newest first)
            });
            const latestInterface = sortedInterfaces[0];
            
            if (latestInterface) {
              const searchParams = new URLSearchParams(window.location.search);
              const newUrl = createInterfaceUrl(searchParams, latestInterface.name);
              if (tokenAtStart === navTokenRef.current) {
                router.push(newUrl);
              }
            }
          } else if (!isErrorInterfaces && Array.isArray(projectInterfaces) && projectInterfaces.length === 0) {
            // Explicitly empty array and not an error => safe to create a default
            setLoadingMessage('Creating default interface...');
            const newInterface = await interfaceActions.create(
              projectQueryParam,
              await getUniqueDefaultInterfaceName(projectQueryParam, interfaceActions),
              undefined
            );

            if (newInterface && newInterface.name) {
              const searchParams = new URLSearchParams(window.location.search);
              const newUrl = createInterfaceUrl(searchParams, newInterface.name);
              if (tokenAtStart === navTokenRef.current) {
                router.push(newUrl);
              }
            }
          } else {
            // Error fetching interfaces OR invalid data: do not auto-create; show selection overlay instead
            console.error('[Interface] Cannot auto-create - error state or invalid data:', { isErrorInterfaces, projectInterfaces });
            setIsSwitchingInterface(false);
            setSelectInterfaceParam('true');
          }
        } catch (err) {
          console.error("Error in interface selection/creation:", err);
          setIsSwitchingInterface(false);
          setInterfaceLoadFailures(prev => prev + 1);
          const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
          showErrorToast('Failed to load interface', errorMsg);
          setLoadingMessage('Loading...');
        }
      };

      selectOrCreateInterface();
    }, 500); // 500ms delay to let URL params settle

    return () => clearTimeout(timer);
  }, [shouldAutoSelectInterface, isLoadingInterfaces, isErrorInterfaces, projectInterfaces, projectQueryParam, router, interfaceActions, tabActions, tileActions, queryClient, preventAutoSelect]);
  
  // Don't clean up selection params - they should persist until user makes a choice
  // This prevents auto-selection from re-triggering after deselection

  // Safety timeout: hide switching overlay and cancel queries if navigation stalls
  useEffect(() => {
    if (!isSwitchingInterface) return;

    const timer = setTimeout(() => {
      // Invalidate any pending navigations
      beginNavigation();

      // Abort any long-running queries (network-level via AbortSignal in queryFns)
      queryClient.cancelQueries({ predicate: (q: any) => {
        const key0 = q.queryKey?.[0] as string;
        return [
          'interfaces', 'interface', 'interface-by-id', 'interface-with-tabs',
          'tabs', 'tiles', 'tab', 'tile', 'tabCompleteData', 'logs'
        ].includes(key0);
      }});
      
      // Hide the overlay and show an error
      setIsSwitchingInterface(false);
      showErrorToast('Navigation timed out. Please try again.', 'Failed to load the selected interface.');
    }, 90000); // 90 seconds

    return () => clearTimeout(timer);
  }, [isSwitchingInterface, queryClient, beginNavigation]);

  // Function to hide overlay
  const hideOverlay = () => {
    setOverlayState({
      isVisible: false,
      operation: null,
      status: null,
    });
  };

  // Scroll to the bottom whenever new tiles are added
  useEffect(() => {
    gridRef.current?.scrollTo({
      top: gridRef.current?.scrollHeight,
      behavior: "smooth",
    });
  }, [tabDataState?.tileIds]);

  // Removed: tab-specific colours are now applied within the Tab component scope so
  // that they do not override the project/global theme for other tabs.

  // Reset pending state when tab data loads successfully
  useEffect(() => {
    if (tabStreamingQuery?.activeTab.data && tabUIState?.pending) {
      tabUIActions?.setPending(false);
    }
  }, [tabStreamingQuery?.activeTab.data, tabUIState?.pending, tabUIActions]);

  // Cancel heavy queries immediately when switching interface
  useEffect(() => {
    if (!isSwitchingInterface) return;
    queryClient.cancelQueries({
      predicate: (q: any) => {
        const k0 = q?.queryKey?.[0] as string;
        return k0 === 'tabCompleteData' || k0 === 'logs';
      }
    });
  }, [isSwitchingInterface, queryClient]);

  // Full refresh handler used by sidebar refresh button
  const handleInterfaceRefresh = async () => {
    if (refreshStatus === 'loading') return;

    setRefreshStatus('loading');
    setIsRefreshingInterface(true);
    
    // Invalidate relevant React Query caches so subsequent queries hit backend
    try {
      await queryClient.invalidateQueries({ predicate: (q: any) => {
        const key0 = q.queryKey?.[0] as string;
        // Common keys used in hooks
        return [
          'interfaces', 'interface', 'interface-by-id', 'interface-with-tabs',
          'tabs', 'tiles', 'tab', 'tile'
        ].includes(key0);
      }});
    } catch (err) {
      
    }

    try {
        await withLoadingToastFn(
            async () => {
                await router.refresh();
            },
            {
                loadingMessage: 'Refreshing interface...',
                successMessage: 'Interface refreshed!',
                errorMessage: 'Failed to refresh interface.'
            }
        );
        setRefreshStatus('success');
        setIsRefreshingInterface(false);
    } catch (err) {
      setRefreshStatus('idle');
      setIsRefreshingInterface(false);
      // Error is already handled by withLoadingToast
    } finally {
        setTimeout(() => setRefreshStatus('idle'), 2000);
    }
  };

  // Add a useEffect to reset the error state and refresh data
  useEffect(() => {
    // Reset any error states when tab changes
    if (createTabMutation.isError) {
      createTabMutation.reset();
    }
    if (updateTabMutation.isError) {
      updateTabMutation.reset();
    }
  }, [activeTabName, createTabMutation, updateTabMutation]);

  // Add a useEffect to handle repeated interface load failures
  useEffect(() => {
    if (interfaceLoadFailures >= 3) {
        // Reset counter to prevent loop if user navigates back to the same project
        setInterfaceLoadFailures(0);
        
        // Show a more persistent error message
        showErrorToast('Failed to load interface after 3 attempts.', 'Returning to project selection.');
        
        // Navigate back to project selection screen
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('project');
        newParams.delete('interface');
        newParams.set('selectProject', 'true');
        
        router.push(`/interfaces?${newParams.toString()}`);
    }
   }, [activeTabName, createTabMutation, updateTabMutation]);

  // Render the active tab based on streaming query - memoized to prevent infinite loops
  const renderActiveTab = useCallback(() => {
    if (!activeTabId || !projectQueryParam) {
      return (
        <div className="flex items-center justify-center h-full">
          Please select a tab
        </div>
      );
    }

    // Check for streaming errors
    if (tabStreamingQuery?.activeTab.isError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-h4 mb-2">Failed to Load Tab</h3>
          <p className="text-body text-muted-foreground mb-4">
            {tabStreamingQuery.activeTab.error?.message || 'Unable to load tab data. The server may be unavailable.'}
          </p>
          <Button
            onClick={() => {
              if (tabStreamingQuery?.refreshTabData && activeTabName) {
                tabStreamingQuery.refreshTabData(activeTabName, { refetchFields: true });
              }
            }}
            className="w-full max-w-xs"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Loading Tab
          </Button>
        </div>
      );
    }

    return (
      <div className="w-full h-full">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }>
          <Tab
            tabId={activeTabId}
            interfaceId={interfaceId}
            projectId={projectQueryParam}
            projectsActions={projectsActions}
            tabActions={tabActions}
            tileActions={tileActions}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            derivedEntryActions={derivedEntryActions}
            contextActions={contextActions}
            codeActions={codeActions}
            fileActions={fileActions}
          />
        </Suspense>
      </div>
    );
  }, [activeTabId, projectQueryParam, tabStreamingQuery, activeTabName, interfaceId, projectsActions, tabActions, tileActions, logsActions, fieldsActions, derivedEntryActions, contextActions, codeActions, fileActions]);

  // Handle save dialog submission
  const handleSaveDialog = async () => {
    if (!activeTabName || !projectQueryParam || !interfaceQueryParam) {
      console.error("Missing tab or project or interface");
      return;
    }
    
    // Hide the dialog and show overlay
    setSaveInterfaceOpen(false);
    setOverlayState({
      isVisible: true,
      operation: 'saving',
      status: 'loading',
    });
    
    // Show loading state
    if (tabUIActions) {
      tabUIActions.setPending(true);
    }
    
    try {
      // Get the tile IDs for this tab
      const tileIds = tabDataActions?.getItems().map(item => item.id) || [];
      
      // Perform the save operation
      await saveTabWithTilesMutation.mutateAsync({
        interface_id: interfaceId,
        tab_name: activeTabName,
        tile_ids: tileIds
      });
      
      // Show success in overlay
      setOverlayState({
        isVisible: true,
        operation: 'saving',
        status: 'success',
      });
      
      // Show success message in UI state
      if (tabUIActions) {
        tabUIActions.setSaveSuccess(true);
      }
      
    } catch (error) {
      console.error("Failed to save tab:", error);
      
      // Show error in overlay
      setOverlayState({
        isVisible: true,
        operation: 'saving',
        status: 'error',
      });
      
      if (tabUIActions) {
        tabUIActions.setSaveSuccess(false);
      }
    } finally {
      // Hide loading state
      if (tabUIActions) {
        tabUIActions.setPending(false);
      }
    }
  };

  // Function to handle commands
  const handleCommand = (id: string) => {
    // First try using direct UI toggles for dialogs
    switch (id) {
      case "select-projects":
        setSelectProjectsOpen(!selectProjectsOpen);
        break;
      case "create-project":
        setCreateProjectOpen(!createProjectOpen);
        break;
      case "delete-project":
        setDeleteProjectOpen(!deleteProjectOpen);
        break;
      case "file-upload":
        setFileUploadOpen(!fileUploadOpen);
        break;
      case "focus-pane":
        setFocusPaneOpen(!focusPaneOpen);
        break;
      case "global-context":
        setGlobalContextOpen(!globalContextOpen);
        break;
      case "save-interface":
        setSaveInterfaceOpen(!saveInterfaceOpen);
        break;
      case "reset-interface":
        commandHooks.resetTab();
        break;
      case "close-project":
        commandHooks.closeProject();
        break;
      default:
        
    }
  };

  // No early return – we render a local overlay in the workspace area instead

  const handleSidebarAddTile = () => {
    if (!activeTabId || !tabDataActions) return;
    const items = tabDataActions.getItems() as TileProps[] || [];
    let idx = items.length;
    while (items.some(it => it.name === `Tile_${idx}`)) idx++;
    const newTileName = `Tile_${idx}`;
    const position = { x: 0, y: 0, width: 4, height: 4 } as any;
    // Use synced actions to ensure a UUID is generated and server tile is created
    if (syncedTabDataActions?.initTile) {
      syncedTabDataActions.initTile(newTileName, { position, minW: null, minH: null, type: null, visible: true });
    } else {
    tabDataActions.initTile(newTileName, { position, minW: null, minH: null, type: null, visible: true });
    }
  };

  // Background worker: process context sync queue
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const backoff = (attempt: number) => Math.min(30000, 500 * Math.pow(2, attempt));

    const runOnce = async () => {
      if (cancelled) return;
      const s = storeApi.getState() as any;
      if (s.processingQueue) return; // avoid concurrent runs
      const job = s.peekContextSync?.();
      if (!job) return; // nothing to do
      try {
        s.setProcessingQueue?.(true);
        // Execute job against Orchestra using granular actions
        if (job.scope === 'interface') {
          await interfaceActions.updateById(job.targetId, { context: job.context });
        } else if (job.scope === 'tab') {
          await tabActions.updateById(job.targetId, { context: job.context });
        } else if (job.scope === 'tile') {
          await tileActions.updateById(job.targetId, { context: job.context });
        }
        // Remove from queue after success
        s.dequeueContextSync?.();
      } catch (e) {
        // Re-enqueue with incremented attempts and backoff
        const nextAttempts = (job.attempts || 0) + 1;
        const delay = backoff(nextAttempts);
        // Put back at front with updated attempts and scheduled delay by just waiting
        s.dequeueContextSync?.();
        s.enqueueContextSync?.(job.scope, job.targetId, job.context, {
          projectId: job.projectId,
          interfaceId: job.interfaceId,
          tabId: job.tabId,
        });
        // sleep
        await new Promise(r => setTimeout(r, delay));
      } finally {
        s.setProcessingQueue?.(false);
      }
    };

    const pump = () => {
      const s = storeApi.getState() as any;
      if (!s.peekContextSync?.()) return; // nothing queued
      runOnce().finally(() => {
        if (!cancelled) timer = setTimeout(pump, 200); // continue draining
      });
    };

    // React to queue length changes by polling quickly
    timer = setInterval(pump, 500);

    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [storeApi, interfaceActions, tabActions, tileActions]);

  return (
  <PageScrollContext.Provider value={pageScrollContainerRef}>
  <InterfaceNavContext.Provider value={{
    isNavigating: isSwitchingInterface,
    beginNavigation,
    setProject: (project, opts) => {
      const token = beginNavigation();
      const newParams = new URLSearchParams(window.location.search);
      if (!project) {
        newParams.delete('project');
        newParams.delete('interface');
        newParams.delete('tab');
        if (opts?.openProjectSelection) newParams.set('selectProject', 'true');
        router.push(`/interfaces?${newParams.toString()}`);
        return;
      }
      newParams.set('project', project);
      newParams.delete('tab');
      if (opts?.openInterfaceSelection) {
        newParams.delete('interface');
        newParams.set('selectInterface', 'true');
      }
      // Route via single source
      const url = `/interfaces?${newParams.toString()}`;
      router.push(url);
    },
    setInterface: async (projectId, interfaceName) => {
      const token = beginNavigation();
      const newParams = new URLSearchParams(window.location.search);
      newParams.set('project', projectId);
      newParams.set('interface', interfaceName);
      newParams.delete('selectInterface');
      newParams.delete('tab');
      router.push(`/interfaces?${newParams.toString()}`);
    }
  }}>

    <div className="w-full h-full relative overflow-hidden">
      {/* New Interface Navigation Sidebar */}
      <InterfaceNav
        interfaceId={interfaceId}
        projectId={projectQueryParam || ''}
        isEditMode={isEditMode}
        isCommandMode={isDashboardMode}
        onEditModeToggle={() => {
          setEditMode(!isEditMode);
        }}
        onCommandModeToggle={() => {
          setDashboardMode(!isDashboardMode);
        }}
        onNavCollapseChange={setIsNavCollapsed}
        onRefresh={handleInterfaceRefresh}
        refreshStatus={refreshStatus}
        projectActions={projectsActions}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
        tileActions={tileActions}
        fileActions={fileActions}
        logsActions={logsActions}
        contextActions={contextActions}
        codeActions={codeActions}
        favouritesActions={favouritesActions}
        initialFavourites={initialFavourites}
        setIsSwitchingInterface={setIsSwitchingInterface}
        setLoadingMessage={setLoadingMessage}
        onAddTile={handleSidebarAddTile}
        fieldsActions={fieldsActions}
        syncedInterfaceUIActions={syncedInterfaceUIActions}
        projectTree={safeProjectTree}
        refetchProjectTree={refetchProjectTree}
        onHoverPrefetchTab={tabStreamingQuery.prefetchTab}
      />
      
      {/* Main Content Area */}
      {isBootstrapError && projectQueryParam ? (
        /* Bootstrap Error Screen - Critical data failed to load */
        <div
          className="absolute top-0 right-0 bottom-0 bg-background z-10 transition-all duration-300 flex items-center justify-center"
          style={{ left: 'var(--interface-nav-width, 256px)' }}
        >
          <div className="w-full max-w-md p-6">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="text-h3 mb-2">Failed to Load Project</h1>
                <p className="text-body text-muted-foreground mb-2">
                  Unable to load project data for <span className="font-semibold">{projectQueryParam}</span>.
                </p>
                <p className="text-caption text-muted-foreground mb-6">
                  {bootstrapErrorObj instanceof Error ? bootstrapErrorObj.message : 'The server timed out or is unavailable.'}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    if (isSwitchingInterface) return; // Prevent double-click
                    setIsSwitchingInterface(true);
                    setLoadingMessage('Retrying...');
                    try {
                      await refetchBootstrap();
                    } finally {
                      setIsSwitchingInterface(false);
                      setLoadingMessage('Loading...');
                    }
                  }}
                  className="w-full"
                  disabled={isSwitchingInterface}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setProjectQueryParam(null);
                    setSelectProjectParam('true');
                  }}
                  className="w-full"
                >
                  Choose Different Project
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : isErrorInterfaces && shouldAutoSelectInterface && !showInterfaceSelection ? (
        /* Interface Error Screen - Show when interface fetch fails */
        <div
          className="absolute top-0 right-0 bottom-0 bg-background z-10 transition-all duration-300 flex items-center justify-center"
          style={{ left: 'var(--interface-nav-width, 256px)' }}
        >
          <div className="w-full max-w-md p-6">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="text-h3 mb-2">Connection Error</h1>
                <p className="text-body text-muted-foreground mb-6">
                  Unable to communicate with the server. The request timed out or the server is unavailable.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    if (isLoadingInterfaces || isSwitchingInterface) return; // Prevent double-click
                    setIsSwitchingInterface(true);
                    setLoadingMessage('Retrying...');
                    try {
                      await refetchInterfaces();
                    } finally {
                      setIsSwitchingInterface(false);
                      setLoadingMessage('Loading...');
                    }
                  }}
                  className="w-full"
                  disabled={isLoadingInterfaces || isSwitchingInterface}
                >
                  {isLoadingInterfaces || isSwitchingInterface ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Connection
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectInterfaceParam('true');
                  }}
                  className="w-full"
                >
                  Select Interface Manually
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : effectiveShowProjectSelection ? (
        /* Project Selection Screen - Full viewport, left-aligned */
        <div
          className="absolute top-0 right-0 bottom-0 bg-background z-10 transition-all duration-300 flex items-center justify-center"
          style={{ left: 'var(--interface-nav-width, 256px)' }}
        >
          <div className="w-full max-w-sm p-4">
              <div className="text-center mb-6">
                  <h1 className="text-h3">Select a project</h1>
                  <p className="text-subtitle">Choose a project from the list below</p>
              </div>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-1 pb-6 max-h-[250px]">
                  {projects?.map((project) => {
                    const projectData = safeProjectTree.find(p => p.project === project);
                    const icon = projectData?.icon;
                    const isLoading = loadingProjectName === project;
                    return (
                      <button
                        key={project}
                        onClick={() => {
                          setLoadingProjectName(project);
                          setLoadingMessage(`Loading project...`);
                          setIsSwitchingInterface(true);
                          setSelectProjectParam(null);
                          setProjectQueryParam(project);
                        }}
                        disabled={isLoading || loadingProjectName !== null}
                        className={cn(
                          "w-full p-2 text-left rounded-md transition-colors duration-200 group flex items-center gap-2",
                          isLoading 
                            ? "cursor-not-allowed opacity-50" 
                            : "hover:bg-primary hover:text-primary-foreground"
                        )}
                      >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-muted-foreground group-hover:text-primary-foreground">
                              {renderIcon(icon, "h-4 w-4", "folder")}
                            </span>
                          )}
                          <span className={cn(
                              "text-body",
                              isLoading && "text-muted-foreground"
                          )}>{project}</span>
                      </button>
                    );
                  }) || (
                    <div className="text-center text-body text-muted-foreground py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>Loading projects...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
          </div>
        </div>
      ) : showInterfaceSelection ? (
        /* Interface Selection Screen - Full viewport, left-aligned */
        <div
          className="absolute top-0 right-0 bottom-0 bg-background z-10 transition-all duration-300 flex items-center justify-center"
          style={{ left: 'var(--interface-nav-width, 256px)' }}
        >
          <div className="w-full max-w-sm p-4">
            <div className="text-center mb-6">
              <h1 className="text-h3">Select an Interface</h1>
              <p className="text-subtitle">Choose an interface for the selected project.</p>
            </div>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-1 pb-6 max-h-[250px]">
                {isLoadingInterfacesForSelection ? (
                  <div className="text-center text-body text-muted-foreground py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Loading interfaces...</p>
                  </div>
                ) : interfacesForSelection.length > 0 ? (
                  interfacesForSelection.map((iface) => {
                    // Interface already comes from projectTree, so icon is directly available
                    const icon = iface.icon;
                    const isLoading = loadingInterfaceId === iface.id;
                    
                    return (
                      <button
                        key={iface.id}
                        onClick={() => {
                          setLoadingInterfaceId(iface.id);
                          setLoadingMessage(`Loading interface...`);
                          setIsSwitchingInterface(true);
                          const newParams = new URLSearchParams(window.location.search);
                          newParams.set('interface', iface.name);
                          newParams.delete('selectInterface');
                          router.push(`/interfaces?${newParams.toString()}`);
                        }}
                        disabled={isLoading || loadingInterfaceId !== null}
                        className={cn(
                          "w-full p-2 text-left rounded-md transition-colors duration-200 group flex items-center gap-2",
                          isLoading 
                              ? "cursor-not-allowed opacity-50" 
                              : "hover:bg-primary hover:text-primary-foreground"
                        )}
                      >
                          {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                              <span className="text-muted-foreground group-hover:text-primary-foreground">
                                  {renderIcon(icon, "h-4 w-4", "layout-grid")}
                              </span>
                          )}
                          <span className={cn(
                              "text-body",
                              isLoading && "text-muted-foreground"
                          )}>{iface.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className="mb-6">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <Icon name="layout-grid" className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-body text-muted-foreground">No interfaces found for this project.</p>
                    </div>
                    <Button
                      size="default"
                      onClick={async () => {
                        setLoadingMessage('Creating default interface...');
                        setIsSwitchingInterface(true);
                        try {
                          const newInterface = await createCompleteDefaultInterface({
                            queryClient,
                            project: projectQueryParam || '',
                            interfaceActions,
                            tabActions,
                            tileActions,
                            baseName: "Default"
                          });
                          
                          if (newInterface && newInterface.name) {
                            const newParams = new URLSearchParams(window.location.search);
                            newParams.set('interface', newInterface.name);
                            newParams.delete('selectInterface');
                            router.push(`/interfaces?${newParams.toString()}`);
                          }
                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : 'Failed to create interface';
                          showErrorToast('Failed to create interface', errorMsg);
                          setLoadingMessage('Loading...');
                        } finally {
                          setIsSwitchingInterface(false);
                        }
                      }}
                      className="mx-auto"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Create Default Interface
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* Regular Interface Content - With sidebar margin */
                  <div 
            className="absolute top-0 right-0 bottom-0 transition-all duration-300"
            style={{
              left: 'var(--interface-nav-width, 256px)'
            }}
          >
          <div className="relative flex-1 min-w-0 h-full">
          {(isSwitchingInterface || isRefreshingInterface) && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm bg-background/70"
              style={{ left: 'var(--interface-nav-width, 256px)', top: '2.5rem', right: 0, bottom: 0 }}
            >
              <div className="flex flex-col items-center gap-4 bg-background border border-border shadow-lg rounded-xl px-6 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-body text-muted-foreground text-center whitespace-nowrap">
                  {isRefreshingInterface ? 'Refreshing interface...' : loadingMessage}
                </p>
              </div>
            </div>
          )}
          <ScrollArea ref={pageScrollContainerRef} className="flex-1 min-w-0 h-full">
                     <div className="relative bg-background pt-3" ref={gridRef}>
          <Toaster richColors position="bottom-right" closeButton />
          {/* ---------------------------------------------------------
              Top-level Suspense: covers the whole Tabs area so that
              the user sees a Skeleton while the tabs are being loaded
              --------------------------------------------------------- */}
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
            >
            <Tabs
              value={activeTabName || undefined}
              onValueChange={handleTabChange}
              className="w-full h-full flex flex-col tutorial-details-panel"
              >
              {/* Floating Top Menu Elements (KEEPING FOR NOW) */}
            <div 
              className="fixed top-10 z-40 transition-all duration-300 ease-linear pointer-events-none h-0"
              style={{ 
                left: 'var(--interface-nav-width, 256px)',
                right: 0,
              }}
              >
              <div className="flex justify-between gap-5 w-full px-4 py-0 pointer-events-auto command-scrollbar overflow-x-hidden">
                {/* ProjectButtons removed as per UI simplification */}

                <div className="flex flex-row gap-2 items-center">
                  {tabUIState?.resetting && (
                    <div className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg p-2">
                      <Loader2 className="animate-spin" />
                    </div>
                  )}
                </div>

                <InterfaceButtons
                  tabIdOrName={activeTabId}
                  interfaceId={interfaceId}
                  interfaceActions={interfaceActions}
                  tabActions={tabActions}
                  tileActions={tileActions}
                  favouritesActions={favouritesActions}
                  initialFavourites={initialFavourites}
                  disabled={saveTabWithTilesMutation.isPending}
                  setOverlayState={setOverlayState}
                  setIsSwitchingInterface={setIsSwitchingInterface}
                  hideAddTileButton={true}
                />
              </div>
            </div>

            {/* Content area with deadspace for floating menus */}
            <div 
              className="transition-all duration-200 ease-linear"
              style={{ 
                paddingTop: 0,
                paddingLeft: '1rem',
                paddingRight: '1rem',
                height: '100%',
              }}
              >
              {tabNames.length === 0 ? (
                (projectQueryParam && (!interfaceQueryParam || tabUIState?.pending)) ? (
                  null
                ) : !projectQueryParam && !interfaceQueryParam ? (
                  hasAssistantsProject ? (
                    <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin my-36" /></div>}>
                      <DefaultProject
                        projectActions={projectsActions}
                        interfaceActions={interfaceActions}
                        tabActions={tabActions}
                        tileActions={tileActions}
                        logsActions={logsActions}
                        codeActions={codeActions}
                        fileActions={fileActions}
                        derivedEntryActions={derivedEntryActions}
                        setTabQueryParam={setTabQueryParamFromSync}
                        setInterfaceQueryParam={setInterfaceQueryParam}
                        setProjectQueryParam={setProjectQueryParam}
                      />
                    </Suspense>
                  ) : null
                ) : null
              ) : (
                tabNames.map((tabName: string, idx: number) => (
                  <TabsContent
                  key={idx}
                    value={tabName}
                    className="mb-auto tutorial-selection-pane relative w-full h-full"
                  >
                    {/* Check if we're in loading states */}
                    {(tabUIState?.pending || createTabMutation.isPending || updateTabMutation.isPending) ? (
                      <div className="flex justify-center">
                        <Loader2 className="animate-spin my-36" />
                      </div>
                    ) : activeTabName !== tabName ? (
                      <div className="flex justify-center">
                        {/* Show different indicator for pending tab switch */}
                        {pendingTabChange === tabName ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="animate-spin my-36" />
                            <div className="text-body text-muted-foreground">Switching tab...</div>
                          </div>
                        ) : (
                          <Loader2 className="animate-spin my-36" />
                        )}
                      </div>
                    ) : (
                      <Suspense fallback={<div className="w-full h-full"><SkeletonLoader /></div>}>
                        <div className="w-full h-full relative">
                          {/* Use renderActiveTab instead of direct Tab component render */}
                          {renderActiveTab()}
                          
                          {/* Show streaming indicators */}
                          {DEBUG_TAB_PREFETCHING && tabStreamingQuery.prefetchProgress.total > 0 && (
                            <div className="fixed bottom-16 right-4 text-caption text-muted-foreground bg-background/80 p-2 rounded border">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  // Get actual tabs from the store using selector
                                  const inactiveTabsCount = selectTotalInactiveTabsForInterface(state, interfaceId);
                                  
                                  // Calculate total prefetchable tabs (excluding active tab)
                                  const prefetchableTabsCount = inactiveTabsCount;
                                  
                                  // Get current prefetch progress with safe fallbacks
                                  const { completed } = tabStreamingQuery.prefetchProgress;
                                  const totalPrefetched = Math.min(completed, prefetchableTabsCount);
                                  
                                  // Only show if there are tabs to prefetch
                                  const shouldShow = prefetchableTabsCount > 0;
                                  const isComplete = totalPrefetched === prefetchableTabsCount;
                                  
                                  if (!shouldShow) return null;
                                  
                                  return (
                                    <>
                                      <div className={`w-2 h-2 bg-green-500 rounded-full ${isComplete ? '' : 'animate-pulse'}`}></div>
                                      <span>
                                        Prefetched: {totalPrefetched}/{prefetchableTabsCount} tabs
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </Suspense>
                    )}
                  </TabsContent>
                ))
              )}
              
              {/* Bottom spacer to allow dragging tiles downward without touching screen bottom */}
              <div className="w-full h-40" />
            </div>

            {/* Floating Bottom Tab Bar - HIDDEN: Using sidebar navigation for tabs instead */}
            {/* {projectQueryParam && interfaceQueryParam && (
              <div 
                className={cn(
                  "fixed bottom-0 z-40 pointer-events-none transform transition-all duration-500 ease-out",
                  tabBarReady && !isSwitchingInterface && !isRefreshingInterface
                    ? "translate-y-0 opacity-100"
                    : "translate-y-12 opacity-0"
                )}
                style={{ 
                  left: 'var(--interface-nav-width, 256px)',
                  right: 0,
                }}
              >
                <div className="px-4 py-1 w-fit flex justify-start pointer-events-auto">
                  <InterfaceTabs
                    tabIdOrName={activeTabId}
                    interfaceId={interfaceId}
                    projectsActions={projectsActions}
                    contextActions={contextActions}
                    interfaceActions={interfaceActions}
                    tabActions={tabActions}
                    tileActions={tileActions}
                    fieldsActions={fieldsActions}
                    logsActions={logsActions}
                    setTabQueryParam={setTabQueryParamFromSync}
                    pendingTabChange={pendingTabChange}
                    setSaveInterfaceOpen={setSaveInterfaceOpen}
                    resetInterfaceCommand={resetInterfaceCommand}
                  />
                </div>
              </div>
            )} */}
          </Tabs>
          
          {/* Save/Reset Overlay */}
          <SaveResetOverlay
            isVisible={overlayState.isVisible}
            operation={overlayState.operation}
            status={overlayState.status}
            onComplete={hideOverlay}
          />
        </Suspense>

        {/* Bootstrap/global fetch error overlay */}
        {isProjectTreeError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[min(520px,92vw)] rounded-lg border bg-card p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-destructive">⚠️</div>
                <div className="flex-1">
                  <div className="font-medium mb-1">Failed to load projects</div>
                  <div className="text-sm text-muted-foreground mb-3 break-words">
                    {projectTreeErrorObj instanceof Error ? projectTreeErrorObj.message : 'Please check your connection and try again.'}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
                    <Button onClick={() => refetchProjectTree()}>Retry</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Focus Dialog */}
        {focusPaneOpen && (
          <Dialog open={true} onOpenChange={() => {
            setFocusPaneOpen(false);
            tabUIActions?.setFocusedTileNames([undefined, undefined]);
          }}>
            <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] !flex !flex-col !p-0 !overflow-hidden">
              <DialogTitle className="sr-only">Focus Mode</DialogTitle>
              <DialogDescription className="sr-only">View and interact with multiple tiles in focus mode</DialogDescription>
              <Suspense fallback={<SkeletonLoader />}>
                <FocusDialog
                  tabIdOrName={activeTabId || ""}
                  interfaceId={interfaceId}
                  projectId={projectQueryParam || ""}
                  tileActions={tileActions}
                  tabActions={tabActions}
                  logsActions={logsActions}
                  fieldsActions={fieldsActions}
                  derivedEntryActions={derivedEntryActions}
                  contextActions={contextActions}
                  codeActions={codeActions}
                  fileActions={fileActions}
                  projectsActions={projectsActions}
                  />
              </Suspense>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Tile Name Dialog */}
        {isEditMode && tabUIState?.editTile && (
          <Suspense fallback={<div className="w-full h-16"><SkeletonLoader /></div>}>
            <EditTileName
              tabIdOrName={activeTabId || ""}
              interfaceId={interfaceId}
              tabActions={tabActions}
              tileActions={tileActions}
              />
          </Suspense>
        )}

        {/* Save Dialog */}
        {saveInterfaceOpen && (
          <Dialog open={true} onOpenChange={() => setSaveInterfaceOpen(false)}>
            <DialogContent className="w-1/4">
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  Are you sure you want to save the changes to{" "}
                  <span className="text-strong">{activeTabName}</span>?
                </div>
                <div className="flex flex-col gap-2">
                  {saveTabWithTilesMutation.isPending && (
                    <div className="text-body text-center">
                      <Loader2 className="h-4 w-4 inline-block mr-2 animate-spin" />
                      Saving changes...
                    </div>
                  )}
                  {saveTabWithTilesMutation.isError && (
                    <div className="text-body text-destructive text-center">
                      Error saving changes: {saveTabWithTilesMutation.error?.message || "Unknown error"}
                      <br />
                      Please try again.
                    </div>
                  )}
                  <div className="flex justify-end pr-2">
                    <ActionButton
                      className="w-fit remove cursor-pointer mr-0 justify-self-end"
                      onClick={handleSaveDialog}
                      text="Save"
                      tooltip="Save changes to tab and all tiles"
                      variant="primary"
                      disabled={saveTabWithTilesMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Floating Action Search Button */}
        {/* 
        <div className="fixed bottom-5 right-5 z-50">
            <AutoComplete
                type={"Actions"}
                displayMode="icon"
                triggerIcon={<Search />}
                items={storeCommands.map((cmd: Command) => ({
                    label: cmd.label,
                    value: cmd.id,
                    icon: cmd.icon ? iconMap[cmd.icon] : undefined,
                    disabled: cmd.disabled
                    }))}
                    onSelect={(commandId: string) => {
                      handleCommand(commandId);
                      }}
                      loading={false}
                      />
                      </div> 
                      */}
         </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  </InterfaceNavContext.Provider>
  </PageScrollContext.Provider>
  );
};

export default Interface;