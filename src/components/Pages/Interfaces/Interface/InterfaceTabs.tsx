'use client';

import {
  Plus,
  Settings,
  Save,
  ListRestart,
  Loader2,
  TriangleAlert,
  Check,
  Pen,
  Trash,
  Eye,
  Palette,
} from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/UI/tabs';
import { useEffect, useMemo, useState, CSSProperties } from 'react';
import {
  GranularTabActions,
  GranularInterfaceActions,
  GranularTileActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  ContextActions,
} from '@/types/interfaces/grid';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useTab, useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useInterfaceSync } from '@/contexts/hooks/interface/sync';

import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';

import BaseDropdown from '@/components/Common/Dropdowns/Base';
import ActionButton from '@/components/Common/Buttons/Action';
import DeleteDialog from '@/components/Common/Dialogs/Delete';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { Label } from '@/components/UI/label';
import { Input } from '@/components/UI/input';
import SubmitButton from '@/components/Common/Buttons/Submit';
import ColorPicker from '@/components/Common/Misc/ColorPicker';
import ContextSelector from '../Blocks/Table/Content/ContextSelector';
import { DropdownMenuItem } from '@/components/UI/dropdown-menu';
import { useTabSync } from '@/contexts/hooks/tab/sync';
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery';
import { useTiles } from '@/contexts/hooks/useStore';
import { Command } from '@/contexts/slices/selectors/commands';

/**
 * Debug flag for tab prefetching indicators
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable prefetched tab indicators
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

const InterfaceTabs = ({
  tabIdOrName,
  interfaceId,
  projectsActions,
  contextActions,
  interfaceActions,
  tabActions,
  tileActions,
  fieldsActions,
  logsActions,
  setTabQueryParam,
  setSaveInterfaceOpen,
  resetInterfaceCommand,
  pendingTabChange,
}: {
  tabIdOrName: string | null;
  interfaceId: string;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
  setTabQueryParam: (tabQueryParam: string | null) => void;
  setSaveInterfaceOpen: (open: boolean) => void;
  resetInterfaceCommand?: Command;
  pendingTabChange?: string;
}) => {
  // Tab states and actions with granular access
  const {
    meta: tabMetaState,
    data: tabDataState,
    ui: tabUIState,
    uiActions: tabUIActions,
    dataActions: tabDataActions,
  } = useTab(tabIdOrName || '', interfaceId);
  const tabName = tabMetaState?.name || '';
  const tabId = tabMetaState?.id || null;

  // Global states
  const project = useStoreContext((s) => s.activeProjectId);
  const globalContextOpen = useStoreContext((s) => s.globalContextOpen);
  const setGlobalContextOpen = useStoreContext((s) => s.setGlobalContextOpen);

  // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedInterfaceActions } = useInterfaceSync(
    interfaceId,
    project,
    interfaceActions,
    tabActions
  );
  const syncedInterfaceDataActions = syncedInterfaceActions?.data;
  const syncedInterfaceUIActions = syncedInterfaceActions?.ui;

  const tabNamesToShow = syncedInterfaceDataActions?.getTabNames() || [];

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;
  const syncedTabUIActions = syncedTabActions?.ui ?? null;
  const DEBUG_TABS = process.env.NEXT_PUBLIC_DEBUG_TABS === 'true';
  const tabLog = (...args: any[]) => {
    if (DEBUG_TABS) console.log(...args);
  };

  // Use React Query to fetch contexts
  const listContextsQuery = useListContextsQuery(project || null, contextActions);
  const contexts = useMemo(
    () => (Array.isArray(listContextsQuery.data) ? listContextsQuery.data : []),
    [listContextsQuery.data]
  );

  // Streaming integration for instant tab switching (when enabled)
  const { prefetchedTabs } = useTabStreamingQuery(interfaceId, tabName, project, {
    tabActions,
    tileActions,
    fieldsActions,
    logsActions,
    projectsActions,
    contextActions,
  });

  // Get tileIds from tab data properly
  const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);
  const tiles = useTiles(tileIds, [
    'name',
    'type',
    'tableTile',
    'visible',
    'id',
    'context',
    'columnContext',
  ]);

  // Calculate derived state
  const items = useMemo(() => {
    return !tabDataActions ? [] : tabDataActions.getItems();
  }, [tabDataActions]);

  const saveIcon = tabUIState?.saveSuccess ? (
    <Check />
  ) : tabUIState?.saveSuccess === false ? (
    <TriangleAlert />
  ) : (
    <Save />
  );
  const resetIcon = tabUIState?.resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;

  // Use combined disabled state from prop and other sources
  const isDisabled = !project || tabUIState?.pending;

  // Handle context change
  const handleContextChange = (ctx: string) => {
    if (syncedTabDataActions && tabUIActions && project && tabName) {
      // First update the tab's context using synchronized action
      syncedTabDataActions.setGlobalContext(ctx, (pending: boolean) =>
        tabUIActions.setDataPending(pending)
      );

      // Then update each tile's context-related properties if needed
      tiles.forEach((tile) => {
        // Get the corresponding item to check current context
        const item = items.find((i) => i.id === tile.id);
        if (item) {
          const validContext = contexts.some((c) => c.name === ctx);
          const validItemContext = item.context?.startsWith(ctx);
          const prefixContexts = contexts.filter((c) => c.name.startsWith(ctx));

          // Determine the new context value based on conditions
          const newContext = validContext
            ? ctx
            : validItemContext
              ? item.context
              : prefixContexts.length === 1
                ? prefixContexts[0].name
                : undefined;

          // Update the tile's context
          syncedTabDataActions?.updateTile(tile.id || '', {
            context: newContext,
            columnContext: validItemContext ? item.columnContext : undefined,
          });
        }
      });
    }
  };

  // States for various dialogs and dropdowns
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteTabOpen, setDeleteTabOpen] = useState(false);
  const [renameTabOpen, setRenameTabOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renameError, setRenameError] = useState('');

  // Handle tab deletion
  const handleDeleteTab = async () => {
    if (!tabName || !interfaceId) {
      return { error: 'No tab selected for deletion' };
    }

    try {
      // If this is the only tab, prevent deletion
      const interfaceData = syncedInterfaceDataActions?.getTabNames() || [];
      if (interfaceData.length <= 1) {
        showErrorToast('Cannot delete the last remaining tab.');
        return { error: 'Cannot delete the last remaining tab' };
      }

      // Switch to another tab first
      const tabIdx = interfaceData.indexOf(tabName);
      const nextTabIdx = tabIdx > 0 ? tabIdx - 1 : interfaceData.length > 1 ? 1 : -1;
      const nextTabName = nextTabIdx !== -1 ? interfaceData[nextTabIdx] : null;

      // Update active tab before deletion
      if (nextTabName && syncedInterfaceUIActions) {
        syncedInterfaceUIActions.setActiveTab(nextTabName);
      }

      // Use synchronized action to remove the tab
      await syncedInterfaceDataActions?.removeTab(tabName);

      showSuccessToast(`Tab "${tabName}" was successfully deleted.`);
      return { info: `Tab "${tabName}" was successfully deleted.` };
    } catch (error) {
      showErrorToast('Failed to delete tab. Please try again.');
      return { error: 'Failed to delete tab. Please try again.' };
    }
  };

  // Handle tab rename
  const handleRenameTab = async () => {
    if (!tabName || !interfaceId) {
      setRenameError('No tab selected for renaming');
      return;
    }

    const trimmedName = newTabName.trim();

    // Validation
    if (!trimmedName) {
      setRenameError('Tab name cannot be empty');
      return;
    }

    if (trimmedName === tabName) {
      setRenameTabOpen(false);
      setNewTabName('');
      setRenameError('');
      return;
    }

    // Check for duplicates (case insensitive)
    const interfaceData = syncedInterfaceDataActions?.getTabNames() || [];
    const duplicate = interfaceData.some(
      (name) => name.toLowerCase() === trimmedName.toLowerCase() && name !== tabName
    );

    if (duplicate) {
      setRenameError(`A tab called "${trimmedName}" already exists`);
      return;
    }

    try {
      // Use synchronized action to rename the tab
      await syncedInterfaceDataActions?.renameTab(tabName, trimmedName);

      showSuccessToast('Tab Renamed', `Tab successfully renamed to "${trimmedName}"`);
      setRenameTabOpen(false);
      setNewTabName('');
      setRenameError('');
    } catch (error) {
      setRenameError('Failed to rename tab. Please try again.');
      showErrorToast('Failed to rename tab. Please try again.');
    }
  };

  // Enhanced tab click handler with instant switching
  const handleTabClick = (tabName: string) => {
    tabLog('[InterfaceTabs] handleTabClick', { tabName });
    // Only update the URL param, Interface.tsx's handleTabChange will handle the actual switching
    setTabQueryParam(tabName);
  };

  // Handle tab creation
  const handleCreateTab = async () => {
    try {
      // Generate a new tab name that doesn't exist
      let initialIndex = tabNamesToShow.length + 1;
      while (tabNamesToShow.includes(`tab${initialIndex}`)) {
        initialIndex++;
      }
      const newTabName = `tab${initialIndex}`;

      // Set pending state before operation
      tabUIActions?.setPending(true);

      // Use synchronized action to add a new tab AND WAIT for it to complete
      const result = await syncedInterfaceDataActions?.addTab(newTabName);

      // Only update active tab AFTER the tab has been created successfully
      if (result && syncedInterfaceUIActions) {
        // Update active tab using synced action
        syncedInterfaceUIActions.setActiveTab(newTabName);
        setTabQueryParam(newTabName);
        showSuccessToast('Tab Created', `New tab "${newTabName}" was created successfully.`);
      }
    } catch (error) {
      // Error is handled by the lower-level `showErrorToast` utility
      console.error('Error creating tab:', error);
      showErrorToast('Failed to create tab. Please try again.', 'Tab Creation Error');
    } finally {
      // Always reset pending state
      tabUIActions?.setPending(false);
    }
  };

  // Reset rename dialog when it opens
  useEffect(() => {
    if (renameTabOpen) {
      setNewTabName(tabName || '');
      setRenameError('');
    }
  }, [renameTabOpen, tabName]);

  // Close settings dropdown if a dialog is opened
  useEffect(() => {
    if (globalContextOpen || deleteTabOpen || renameTabOpen) setDropdownOpen(true);
    else setDropdownOpen(false);
  }, [globalContextOpen, deleteTabOpen, renameTabOpen]);

  const explicitTabColor = tabUIState?.color ?? '';

  // Only apply a style override when the tab has an explicit colour.
  const triggerStyle = useMemo<CSSProperties | undefined>(
    () =>
      explicitTabColor
        ? ({ '--primary': explicitTabColor, '--accent': explicitTabColor } as CSSProperties)
        : undefined,
    [explicitTabColor]
  );

  return (
    <div className="flex items-center gap-4">
      {tabNamesToShow.length > 0 ? (
        <TabsList className="bg-background/90 border-border/50 justify-start rounded-lg border p-1 shadow-md backdrop-blur-sm">
          <div className="flex flex-row gap-1">
            {tabNamesToShow.map((tabNameToShow, idx) => {
              return (
                <TabsTrigger
                  style={triggerStyle}
                  key={idx}
                  value={tabNameToShow}
                  className="data-[state=active]:text-strong relative flex flex-row gap-2 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  <div
                    className="relative h-5 min-w-[4rem] text-center"
                    onClick={() => handleTabClick(tabNameToShow)}
                  >
                    {tabNameToShow}
                    {/* Cached data indicator for streaming - show if streaming enabled or if tab is prefetched */}
                    {DEBUG_TAB_PREFETCHING &&
                      (() => {
                        const isPrefetched = prefetchedTabs?.has(tabNameToShow) || false;
                        return (
                          <div
                            className={`absolute -left-1 -top-1 h-1.5 w-1.5 bg-[color:var(--status-success)] ${isPrefetched ? '' : 'animate-pulse'} rounded-full`}
                            title="Tab Prefetched"
                          />
                        );
                      })()}
                    {/* Pending tab change indicator */}
                    {pendingTabChange === tabNameToShow && (
                      <div
                        className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 transform animate-pulse rounded-full bg-primary"
                        title="Tab switch pending"
                      />
                    )}
                  </div>
                </TabsTrigger>
              );
            })}
          </div>

          <div className="ml-1 flex items-center border-l pl-1">
            {/* Add tab button integrated into tabs */}
            <ActionButton
              className="h-8 w-8 p-0"
              variant="ghost"
              onClick={handleCreateTab}
              disabled={tabUIState?.pending}
              tooltip="Add new tab"
              icon={<Plus size={16} />}
            />

            {/* Tab Settings Dropdown */}
            <BaseDropdown
              context="tab"
              button={
                <ActionButton
                  className="h-8 w-8 p-0"
                  tooltip="Tab Settings"
                  icon={<Settings />}
                  variant="ghost"
                />
              }
              className="w-fit min-w-0"
              open={dropdownOpen}
              setOpen={setDropdownOpen}
            >
              <div className="flex w-56 flex-col items-center p-2">
                {/* Save Tab */}
                <div className="w-full border-b pb-1">
                  <ActionButton
                    className="w-full justify-start"
                    text="Save tab"
                    tooltip={
                      !project ? 'Select a project first' : 'Save changes to the current tab'
                    }
                    icon={saveIcon}
                    variant="ghost"
                    disabled={isDisabled}
                    onClick={() => setSaveInterfaceOpen(true)}
                  />
                </div>

                {/* Reset Tab */}
                <div className="w-full border-b py-1">
                  <ActionButton
                    className="w-full justify-start"
                    text="Reset tab"
                    tooltip={
                      !project
                        ? 'Select a project first'
                        : 'Revert current tab changes to the last saved state'
                    }
                    icon={resetIcon}
                    variant="ghost"
                    disabled={isDisabled || tabUIState?.resetting}
                    onClick={() => {
                      if (resetInterfaceCommand) {
                        resetInterfaceCommand.action?.();
                      }
                    }}
                  />
                </div>

                {/* Delete button */}
                <div className="w-full border-b py-1">
                  <DeleteDialog
                    type="tab"
                    args={[]}
                    deletingFunction={handleDeleteTab}
                    variant="ghost"
                    text="Delete tab"
                    customOpen={deleteTabOpen}
                    setCustomOpen={setDeleteTabOpen}
                    onDelete={() => {}}
                    icon={<Trash />}
                  />
                </div>

                {/* Rename button */}
                <div className="w-full border-b py-1">
                  <BaseDialog
                    button={
                      <ActionButton
                        className="w-full justify-start"
                        text="Rename tab"
                        tooltip={!project ? 'Select a project first' : 'Rename the current tab'}
                        icon={<Pen />}
                        variant="ghost"
                        disabled={isDisabled}
                        onClick={() => setRenameTabOpen(true)}
                      />
                    }
                    title="Rename Tab"
                    body={
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="tab-name">New Tab Name</Label>
                          <Input
                            id="tab-name"
                            value={newTabName}
                            onChange={(e) => {
                              setNewTabName(e.target.value);
                              if (renameError) setRenameError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameTab();
                              }
                            }}
                            placeholder="Enter new tab name"
                            autoFocus
                          />
                          {renameError && (
                            <p className="text-caption mt-1 text-destructive">{renameError}</p>
                          )}
                        </div>
                      </div>
                    }
                    footer={
                      <SubmitButton
                        text="Rename"
                        onClick={handleRenameTab}
                        disabled={!newTabName.trim() || newTabName.trim() === tabName}
                      />
                    }
                    open={renameTabOpen}
                    setOpen={setRenameTabOpen}
                  />
                </div>

                {/* Context selector */}
                <div className="w-full border-b py-1">
                  <ContextSelector
                    tabId={tabId || undefined}
                    interfaceId={interfaceId}
                    projectId={project || undefined}
                    context={tabDataState?.globalContext}
                    setContext={handleContextChange}
                    customOpen={globalContextOpen}
                    setCustomOpen={setGlobalContextOpen}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    projectsActions={projectsActions}
                    fieldsActions={fieldsActions}
                    setPending={tabUIActions?.setPending!}
                    text="Set tab context"
                  />
                </div>

                {/* Color selector */}
                <div className="w-full pt-1">
                  <ColorPicker
                    value={explicitTabColor}
                    onChange={(color) => syncedTabUIActions?.setColor(color)}
                    useDialog={true}
                    showReset={true}
                    onReset={() => syncedTabUIActions?.setColor(undefined)}
                  >
                    <ActionButton
                      className="w-full justify-start"
                      icon={<Palette />}
                      variant="ghost"
                      text="Set tab color"
                      tooltip="Change the color for the current tab"
                      disabled={!project}
                    />
                  </ColorPicker>
                </div>
              </div>
            </BaseDropdown>
          </div>
        </TabsList>
      ) : (
        /* When no tabs exist, show standalone add button with glass morphism */
        <div className="bg-background/90 border-border/50 rounded-lg border p-2 shadow-md backdrop-blur-sm">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handleCreateTab}
            disabled={tabUIState?.pending}
            title="Add new tab"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default InterfaceTabs;
