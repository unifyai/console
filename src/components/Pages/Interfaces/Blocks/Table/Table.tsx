"use client";

import { BaseTable } from "@/components/Common/Tables/Base";
import DataTable from "@/components/Common/Tables/Data/Base";
import { TableArguments, LogProps, GroupedLogProps, LogItemProps } from "@/types/interfaces/logs";
import {
  ColumnFiltersState,
  ColumnSort,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
} from "@tanstack/react-table";
import { DerivedEntryActions, LogsActions, FieldsActions, ContextActions, TableGroupedMetrics } from "@/types/interfaces/grid";
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState, useCallback, createRef } from "react";
import { ScrollArea, ScrollBar } from "@/components/UI/scroll-area";
import { Loader2, SquareSplitHorizontal, Layers } from "lucide-react";
import { buildTree, nestedColumns, encodeRenderedDepth, formatCellValue } from "@/utils/interfaces/table/table";
import { Badge } from "@/components/UI/badge";
import ColumnFilter from "./Buttons/Filters/Main";
import AggregatedCell from "./Content/AggregatedCell";
import VisibilityFilter from "./Buttons/VisibilityFilter";
import DeleteCells from "./Buttons/DeleteCells";
import ColumnDelete from "./Buttons/DeleteColumn";
import ColumnMetrics from "./Buttons/ColumnMetrics";
import SummaryCell from "./Content/SummaryCell";
import FooterCell from "./Content/FooterCell";
import GlobalFilter from "./Buttons/GlobalFilter";
import PageController from "@/components/Common/Tables/Data/Buttons/PageController";
import InfiniteScrollController from "@/components/Common/Tables/Data/Buttons/InfiniteScrollController";
import { extractBaseAndComparisonLogs } from "@/utils/interfaces/selection/selection";
import FreezeLogs from "./Buttons/FreezeLogs";
import RefreshLogs from "./Buttons/RefreshLogs";
import { buildFilterExpression, searchParamToFilters } from "@/utils/interfaces/table/filters";
import { FiltersByColumn } from "@/types/interfaces/columns";
import CellPopover from "./Content/CellPopover";
import { GranularTileActions, ProjectsActions } from "@/types/interfaces/grid";
import { flattenColumnIDs, sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { DraggingColumnsState, DraggingColumnPinnerState } from "@/types/interfaces/columns";
import ColumnCreate from "@/components/Pages/Interfaces/Blocks/Table/Buttons/ColumnCreate";
import ColumnUpdate from "@/components/Pages/Interfaces/Blocks/Table/Buttons/ColumnUpdate";
import ColumnGroupBy from "@/components/Pages/Interfaces/Blocks/Table/Buttons/ColumnGroupBy";
import ColumnGroupSort from "@/components/Pages/Interfaces/Blocks/Table/Buttons/ColumnGroupSort";
import RowExpanding, { RowExpandingProps } from "@/components/Common/Tables/Data/Buttons/RowExpanding";
import { onGroupExpand, maybeFlattenGroupedLogs } from "@/utils/interfaces/table/grouping";
import ContextSelector from "./Content/ContextSelector";
import ResetServerAction from "./Buttons/ResetServerAction";
import CreateEmptyLogRow from "./Buttons/CreateEmptyLogRow"; // Import the new button
import { deselectFromClickOutside } from "@/hooks/Interfaces/useCellSelection";
import { isHiddenByDefault } from "@/utils/interfaces/table/table";
import EmptyTableOverlay from "./EmptyTableOverlay";
import LoadMore from "@/components/Common/Tables/Data/Buttons/LoadMore";

// Import new hooks
import { useTab } from "@/contexts/hooks/tab";
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { shallow } from "zustand/vanilla/shallow";
import { useTableDataQueryWithTracking, useTableGroupedMetricsQuery, useTableArgumentsQuery } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { useListContextsQuery } from "@/hooks/Interfaces/Query/useContextsQuery";
import { useTileSync } from "@/contexts/hooks/tile/sync";
import { useRouter } from "next/navigation"; // Import useRouter
import SettingButton from "@/components/Common/Buttons/Setting";
import { useInfiniteLogsQuery } from "@/hooks/Interfaces/Query/useInfiniteLogsQuery";
import { useQueryClient } from "@tanstack/react-query";
import GroupLoadMore from "@/components/Common/Tables/Data/Buttons/GroupLoadMore";
import { checkHasNextPage } from "@/utils/interfaces/logsCore";
import { calculateGroupHasNextPage as calcGroupHasNextPageUtil } from "@/utils/interfaces/table/grouping";

// Check if advanced table features should be shown
const showAdvancedFeatures = process.env.NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES === 'true';

const LogsTable = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  tileActions,
  projectsActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
}: {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string | undefined;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions,
  contextActions: ContextActions,
}) => {
  const router = useRouter(); // Initialize useRouter
  const queryClient = useQueryClient(); // Add queryClient for cache invalidation
  const [panelCount, setPanelCount] = useState(1);
  const [useVirtualization, setUseVirtualization] = useState(false); // Enable virtualization by default
  const [useBidirectionalLoading, setUseBidirectionalLoading] = useState(true); // Enable bidirectional loading
  const [bidirectionalConfig, setBidirectionalConfig] = useState({
    maxPagesInMemory: 5,
    enableBackwardLoading: true,
    enableForwardLoading: true,
  });

  // Empty table overlay state
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  // Track group-specific offsets for row indexing
  const [groupOffsets, setGroupOffsets] = useState<Map<string, number>>(new Map());

  // Get access to the tab data and actions with granular access
  const { ui: tabUIState, data: tabDataState } = useTab(tabId, interfaceId);
  const context_ = tabDataState?.globalContext;

  // Use granular hooks for better performance
  const {
    meta: tileMetaState,
    ui: tileUIState,
    data: tileDataState,
    tableTile: tableTileState,
    uiActions: tileUIActions,
  } = useTile(tileId, tabId);

  // Use the existing hook structure for metadata and mutations
  const { 
    tableData: tableDataItem, 
    isError: isTableDataError,
    error: tableDataError,
    updateTableDataItemWithUpdater,
    updateLogs,
  } = useTableDataQueryWithTracking(tileId, tabId);

  const listContextsQuery = useListContextsQuery(projectId || null, contextActions);
  const availableContexts = listContextsQuery.data || [];

  // Use the existing table data item as single source of truth
  const {
    fields,
    logs,
    params,
    entriesProperties,
    paramsProperties,
    totalCount,
    newCells,
    error,
    isLoading: isTableDataLoading,
  } = tableDataItem;

  const {data: tableArguments = {} as TableArguments} = useTableArgumentsQuery(tabId || null);
  const tileName = tileMetaState?.name || "";
  const sortingExpression = tableArguments?.[tileName]?.getLogs_parameters?.sorting || null;
  const groupSortingExpression = tableArguments?.[tileName]?.getLogs_parameters?.group_sorting || null;
  
  // TODO: See if we can directly wait for the table arguments to be updated,
  // rather than hacking this to manually get the correct get logs expressions
  // for the infinite scrolls
  const groupingExpression = tileDataState?.grouping || null;
  const filterExpression = buildFilterExpression(
    tileDataState?.filters || undefined,
    tileDataState?.common_filter || undefined,
    tileDataState?.column_context || undefined,
    tileDataState?.freeze || undefined,
    fields
  );

  // Get item data for context and column context
  const { itemActions } = useTileItem(tileId, tabId);
  const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

  // Reset empty table overlay
  const prevContextForOverlayRef = useRef(item?.context);
  const prevProjectIdForOverlayRef = useRef(projectId);
  useEffect(() => {
    if (projectId !== prevProjectIdForOverlayRef.current || item?.context !== prevContextForOverlayRef.current) {
      setOverlayDismissed(false);
    }
    prevProjectIdForOverlayRef.current = projectId;
    prevContextForOverlayRef.current = item?.context;
  }, [projectId, item?.context]);

  // Use infinite scroll query with simplified data handling
  const infiniteLogsQuery = useInfiniteLogsQuery({
    tileId,
    tabId,
    projectId: projectId || null,
    context: item?.context || context_ || null,
    columnContext: item?.column_context || null,
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    limit: tableTileState?.limit || 20,
    group_limit: tableTileState?.group_limit || 20,
    logsActions,
    updateLogs,
    enabled: !!projectId && !!tileId && !!tabId && item?.auto_update !== "true" && !isTableDataLoading,
    bidirectional: {
      enabled: useBidirectionalLoading,
      maxPagesInMemory: bidirectionalConfig.maxPagesInMemory,
      enableBackwardLoading: bidirectionalConfig.enableBackwardLoading,
      enableForwardLoading: bidirectionalConfig.enableForwardLoading,
    },
  });

  // SYNCHRONISED TABLE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTileActions, tableTile } = useTileSync(
    tileId,
    tabId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );
  const syncedTileDataActions = syncedTileActions?.data ?? null;
  const { tableTileActions } = tableTile ?? { tableTileActions: null };
  
  // Get access to the table tile specific data and actions with granular access
  const limit = tableTileState?.limit as number;
  const offset = tableTileState?.offset as number;
  const group_limit = tableTileState?.group_limit as number;
  const group_offset = tableTileState?.group_offset as number;
  
  const setPending = (pending: boolean) => tileUIActions?.setPending(pending);

  // Display loaders for group metrics and shared values
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());

  // Extract params values from logs
  const paramsValues: LogItemProps = {};
  const flatLogs = maybeFlattenGroupedLogs(logs)
  if (Object.entries(params).length && Object.entries(logs).length)
    flatLogs.map(log => Object.entries(log.params).map(([key, value]) => paramsValues[key] = params[key][value]))

  // UI state from the tab
  const interactive = tabUIState?.interactive || false;
  const pending = tabUIState?.pending || tabUIState?.dataPending || tileUIState?.pending;

  // Basic states for quick feedback
  const [summaryPending, setSummaryPending] = useState(false);
  const [showSpinner, setShowSpinner] = useState(pending || !logs);

  useEffect(() => {
    setShowSpinner(pending || !logs);
  }, [pending, logs]);

  // Get base and comparison logs
  const selectedCells = useMemo(() => item?.selected ? item?.selected.split(",") : [], [item?.selected]);
  const { baseLog, comparisonLogs } = extractBaseAndComparisonLogs(
    selectedCells,
    maybeFlattenGroupedLogs(logs)
  );

  // Various table states from the item
  const metric = item?.metric || "mean";
  const logsFilters = item?.filters;
  const commonFilter = item?.common_filter;

  const pageNumber = item?.page_number;
  const sortingStr = item?.sorting;
  const columnOrderStr = item?.column_order;
  const hiddenColumns = item?.hidden_columns;
  // Derive defaultHidden from store (tableTileState) so toggles persist
  const defaultHidden = tableTileState?.default_hidden_columns;
  const setDefaultHidden = useCallback((val: boolean) => {
    tableTileActions?.setDefaultHiddenColumns(val);
  }, [tableTileActions]);
  const groupingStr = item?.grouping;
  const groupSortingStr = item?.group_sorting;
  const columnsPinLeft = item?.columns_pin_left;
  const columnsPinRight = item?.columns_pin_right;
  const context = item?.context;
  const columnContext = item?.column_context;

  // Column definitions
  const entriesTree = useMemo(() => buildTree(entriesProperties), [entriesProperties]);
  const paramsTree = useMemo(() => buildTree(paramsProperties), [paramsProperties]);
  const dataTypes = useMemo(() => fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].data_type])) : {}, [fields]);
  const fieldTypes = useMemo(() => fields ? Object.fromEntries(Object.entries(fields).map(entry => [entry[0], entry[1].field_type])) : {}, [fields]);

  const indicesTitle = "RowNumbering";
  const entriesTitle = "Entries";
  const paramsTitle = "Parameters";

  const effectiveColumnNames = useMemo(() => {
    return logs.length ? [...entriesProperties, ...paramsProperties] : [];
  }, [logs.length, entriesProperties, paramsProperties]);

  const columns = useMemo(() => {
    // Construct the columns array
    return [
      {
        id: indicesTitle,
        cell: ({ row }) => <Badge>{(row.effectiveIndex !== undefined ? row.effectiveIndex : row.index) + 1}</Badge>,
        meta: {
          dataType: null,
          columnType: "util",
          enableRowSpan: false,
          isParent: false,
          renderedDepth: -1,
        },
      },
      ...(paramsProperties.length
        ? [
            {
              id: paramsTitle,
              header: paramsTitle,
              columns: nestedColumns(
                paramsTree,
                "params",
                paramsTitle,
                params,
                true,
                dataTypes,
                fieldTypes,
                columnContext,
                fields
              ),
              meta: {
                columnType: "paramsHeader",
                isParent: true,
                renderedDepth: -1,
              },
            },
          ]
        : []),
      ...(paramsProperties.length
        ? [
            {
              id: entriesTitle,
              header: entriesTitle,
              columns: nestedColumns(
                entriesTree,
                "entries",
                entriesTitle,
                params,
                false,
                dataTypes,
                fieldTypes,
                columnContext,
                fields
              ),
              meta: {
                columnType: "entriesHeader",
                isParent: true,
                renderedDepth: -1,
              },
            },
          ]
        : nestedColumns(
            entriesTree,
            "entries",
            entriesTitle,
            params,
            false,
            dataTypes,
            fieldTypes,
            columnContext,
            fields
          )),
    ];
  }, [entriesTree, paramsTree, dataTypes, fieldTypes, params, columnContext, fields, paramsProperties.length]);
 
  // Apply rendered depth encoding to account for depth mismatch for all headers
  // This is needed for accurate column hiding/showing/grouping to work on all nest levels
  // Always assign depth = 0 for the meta column types as passed here
  encodeRenderedDepth(columns, ["util", "paramsHeader", "entriesHeader"]);

  // Convert those strings → arrays/objects
  const columnIDs = useMemo(() => flattenColumnIDs(columns), [columns]);

  // Flag to track if the column order was manually changed
  // by calling the setColumnOrder function
  // e.g. post drag and drop or create/delete columns on the UI etc.
  const [manualColumnOrderOverride, setManualColumnOrderOverride] = useState(false);
  const columnOrder = useMemo(() => columnOrderStr ? columnOrderStr.split(",") : columnIDs, [columnOrderStr, columnIDs]);
  const setColumnOrder = useCallback((order: string[], manual = true) => {
    // Whenever the user does a "manual" column reorder or adds a column
    // we set the manualColumnOrderOverride flag to true. In all other cases,
    // we call `setColumnOrder` with the default `manual = false`
    if (manual) {
      setManualColumnOrderOverride(true);
    }
    tableTileActions?.setColumnOrder(order.join(","));
  }, [tableTileActions, setManualColumnOrderOverride]);

  // Auto-hide underscores once per context when enabled
  useEffect(() => {
    if (!defaultHidden) return;
    const currentHidden = hiddenColumns != null
      ? hiddenColumns.split(",").filter(x => x)
      : [];
    // Compute underscore-prefixed IDs
    const underscoreIds = columnIDs.filter(id => isHiddenByDefault(id));
    // Only hide those not already hidden
    const toHide = underscoreIds.filter(id => !currentHidden.includes(id));
    if (toHide.length && tableTileActions) {
      tableTileActions.setHiddenColumns([...currentHidden, ...toHide].join(","));
    }
  }, [columnIDs, context, defaultHidden, tableTileActions]);

  // Compute column visibility map: user override or default underscore hide when enabled
  const hiddenList = hiddenColumns != null
    ? hiddenColumns.split(",").filter(x => x)
    : undefined;
  const columnVisibility = useMemo(() => Object.fromEntries(
    columnIDs.map(id => [
      id,
      hiddenList !== undefined
        ? !hiddenList.includes(id)
        : defaultHidden
          ? !isHiddenByDefault(id)
          : true
    ])
  ), [columnIDs, hiddenList, defaultHidden]);
  
  // Toggle handler for updating hiddenColumns from visibility map
  const setColumnVisibility = useCallback((v: { [key: string]: boolean }) => {
    const hidden = Object.keys(v).filter((k) => !v[k]);
    tableTileActions?.setHiddenColumns(
      hidden.length
        ? hidden.join(",")
        : hidden.length === 0
          ? ""
          : undefined
    );
  }, [tableTileActions]);
  
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const setLogsFilters = useCallback((filtersObj: FiltersByColumn) => {
    const keys = Object.keys(filtersObj);
    syncedTileDataActions?.setFilters(
      keys.length
        ? Object.entries(filtersObj)
          .map(([cKey, val]) =>
            Object.entries(val).map(([fn, val2]) => `${cKey}~${fn}~${val2}`)
          )
          .flat()
          .join("§")
        : undefined
    );
  }, [syncedTileDataActions]);

  const sorting: ColumnSort[] = useMemo(() => sortingStr
    ? sortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [], [sortingStr, entriesProperties]);
  const setSorting = useCallback((s: ColumnSort[]) =>
    tableTileActions?.setSorting(s.map((item) => `${sanitizeId(item?.id)}@${item?.desc}`).join(",")), [tableTileActions]);

  const grouping: GroupingState = useMemo(() => groupingStr ? groupingStr.split(",") : [], [groupingStr]);
  const setGrouping = useCallback((g: GroupingState) =>
    syncedTileDataActions?.setGrouping(g.length ? g.join(",") : undefined), [syncedTileDataActions]);

  const groupSorting: ColumnSort[] = useMemo(() => groupSortingStr
    ? groupSortingStr.split(",").map((c) => {
      const [key, order] = c.split("@");
      const id = entriesProperties.includes(key) ? `Entries/${key}` : `Parameters/${key}`;
      const desc = order === "true";
      return { id, desc };
    })
    : [], [groupSortingStr, entriesProperties]);
  const setGroupSorting = useCallback((s: ColumnSort[]) =>
    tableTileActions?.setGroupSorting(s.map((item) => `${sanitizeId(item.id)}@${item.desc}`).join(",")), [tableTileActions]);

  const columnPinning: ColumnPinningState = useMemo(() => ({
    left: columnsPinLeft ? columnsPinLeft.split(",") : [indicesTitle],
    right: columnsPinRight ? columnsPinRight.split(",") : [],
  }), [columnsPinLeft, columnsPinRight, indicesTitle]);
  const setColumnPinning = useCallback((pin: ColumnPinningState) => {
    tableTileActions?.setColumnsPinLeft(pin.left ? pin.left.join(",") : undefined);
    tableTileActions?.setColumnsPinRight(pin.right ? pin.right.join(",") : undefined);
  }, [tableTileActions]);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    columnIDs
      .map((id) => ({ [id]: id === indicesTitle ? 50 : 150 }))
      .reduce((acc, curr) => ({ ...acc, ...curr }), {})
  );

  const [draggingColumns, setDraggingColumns] = useState<DraggingColumnsState>({
    active: {
      ids: [],
      transform: null,
    },
    over: {
      ids: [],
      transform: null,
    },
  });

  const [draggingColumnPinner, setDraggingColumnPinner] = useState<DraggingColumnPinnerState>({
    columnId: null,
    isPinning: false,
    direction: null,
    transform: null
  });

  // Replace the broken state binding for columnVisibility
  const state = {
    selectedCells,
    metric,
    sorting,
    groupSorting,
    columnVisibility,
    columnOrder,
    columnFilters,
    grouping,
    columnPinning,
    columnSizing,
    context,
    draggingColumns,
    draggingColumnPinner,
    newCells
  };

  // Replace the broken setColumnVisibility in setState
  const setState = {
    setSelectedCells: (cells: string[]) => tableTileActions?.setSelected(cells.join(",")),
    setMetric: (newMetric: string) => syncedTileDataActions?.setMetric(newMetric),
    setSorting,
    setGroupSorting,
    setColumnVisibility,
    setColumnOrder,
    setColumnFilters,
    setGrouping,
    setColumnPinning,
    setColumnSizing,
    setContext: (newContext: string) => syncedTileDataActions?.setColumnContext(newContext),
    setDraggingColumns,
    setDraggingColumnPinner,
  };

  // Use refs to detect a *real* page/filter change
  const prevPageRef = useRef(pageNumber);
  const prevFiltersRef = useRef(logsFilters);
  const prevCommonFilterRef = useRef(commonFilter);
  const prevSortingRef = useRef(sortingStr);
  const prevGroupingRef = useRef(groupingStr);
  const prevGroupSortingRef = useRef(groupSortingStr);
  const prevContextRef = useRef(context);

  // Prune base/comparison IDs if user REALLY changes page or filters
  useEffect(() => {
    const pageChanged = prevPageRef.current !== pageNumber;
    const filtersChanged = prevFiltersRef.current !== logsFilters;
    const commonChanged = prevCommonFilterRef.current !== commonFilter;
    const sortingChanged = prevSortingRef.current !== sortingStr;
    const groupingChanged = prevGroupingRef.current !== groupingStr;
    const groupSortingChanged = prevGroupSortingRef.current !== groupSortingStr;

    if (pageChanged || filtersChanged || commonChanged || sortingChanged || groupingChanged || groupSortingChanged) {
      // If base no longer valid, remove it
      const flattenedLogs = maybeFlattenGroupedLogs(logs);
      if (baseLog && !(flattenedLogs).some((l) => l.id === baseLog.id)) {
        tableTileActions?.setSelected(selectedCells.slice(1).join(","));
      }
      // If compare logs not valid, prune them
      if (comparisonLogs) {
        const ids = comparisonLogs.map(cl => cl.id);
        const validIds = ids.filter((id) => flattenedLogs.some((l) => l.id === id));
        if (!validIds.length) {
          tableTileActions?.setSelected(
            (selectedCells.at(0) ? [selectedCells.at(0) as string] : []).join(",")
          );
        } else if (validIds.length < ids.length) {
          tableTileActions?.setSelected(
            selectedCells.filter(cell => validIds.includes(cell.split("_").at(0)!)).join(",")
          );
        }
      }
    }
    // Update the refs
    prevPageRef.current = pageNumber;
    prevFiltersRef.current = logsFilters;
    prevCommonFilterRef.current = commonFilter;
    prevSortingRef.current = sortingStr;
    prevGroupingRef.current = groupingStr;
    prevGroupSortingRef.current = groupSortingStr;
  }, [
    logs,
    pageNumber,
    logsFilters,
    commonFilter,
    sortingStr,
    groupingStr,
    groupSortingStr,
    selectedCells,
    baseLog,
    comparisonLogs,
    tableTileActions
  ]);

  // On initial mount or when the context changes, we need to set the column_order
  // on item correctly so that the view pane can take this state and render
  // the accordions in the correct order
  useEffect(() => {
    if (!shallow(columnOrder, item?.column_order?.split(","))) {
      setColumnOrder(columnOrder, false);
    }
  }, [columnOrder, item?.column_order, setColumnOrder]);

  // Then when the context changes, we reset the manual override
  // so that the column order is not locked in and can be automatically
  // updated when updated data comes in
  useEffect(() => {
    if (context !== prevContextRef.current) {
      setManualColumnOrderOverride(false);
    }
    prevContextRef.current = context;
  }, [context]);

  // Finally, when either of entriesProperties or paramsProperties changes
  // and if the user hasn't manually updated the column order for this context,
  // re-apply the default
  const hasNewColumns = !shallow(columnIDs, item?.column_order?.split(","));
  useEffect(() => {
    if (!manualColumnOrderOverride && hasNewColumns) {
      // Because user hasn't manually adjusted anything for this "fresh" context
      // we revert to the updated columnIDs if we see new columns added or removed
      setColumnOrder(columnIDs, false);
    }
  }, [columnIDs, manualColumnOrderOverride, hasNewColumns, setColumnOrder]);

  // Monitor the grouped metrics query loading state directly
  const { isLoading: isGroupedMetricsLoading } = useTableGroupedMetricsQuery(
    tileId,
    tabId,
    !!groupingExpression, // Only enabled when there's grouping
    logsActions,
    projectId,
    context,
    columnContext,
    effectiveColumnNames,
    filterExpression,
    groupingExpression,
    metric,
    fields,
    "Table-LoadingState"
  );

  // Effect to handle top-level grouped metrics loading states
  // This manages the loading states for the isGroupLoading prop in AggregatedCell
  useEffect(() => {
    if (!logs.length || !groupingExpression) return;

    // Set loading state based on query loading state
    if (isGroupedMetricsLoading) {
      setLoadingGroups(new Set(["_all_groups_"]));
    } else {
      setLoadingGroups(prev => {
        const next = new Set(prev);
        next.delete("_all_groups_");
        return next;
      });
    }
  }, [logs.length, groupingExpression, isGroupedMetricsLoading]);

  // Calculate hasNextPage from infinite query if available, otherwise from initial tableDataItem
  const initialHasNextPage = useMemo(() => {
    if (!isTableDataLoading && !infiniteLogsQuery.isPending && !infiniteLogsQuery.isLoading) {
      // Use infinite query data once it's available
      return infiniteLogsQuery.hasNextPage;
    }
    
    // Calculate from initial tableDataItem using pagination utility
    return checkHasNextPage({
      currentLogs: logs,
      totalCount,
      effectiveOffset: tableTileState?.offset || 0,
      effectiveLimit: tableTileState?.limit || 20,
    });
  }, [
    isTableDataLoading,
    infiniteLogsQuery.isLoading, 
    infiniteLogsQuery.isPending,
    infiniteLogsQuery.hasNextPage, 
    logs.length, 
    tableTileState?.limit, 
    tableTileState?.group_limit,
    tableTileState?.group_offset, 
    tableTileState?.offset,
    groupingExpression, 
    totalCount
  ]);

  const effectiveHasNextPage = useMemo(() => {
    if (!infiniteLogsQuery.isLoading) {
      return infiniteLogsQuery.hasNextPage;
    }
    return initialHasNextPage;
  }, [infiniteLogsQuery.isLoading, infiniteLogsQuery.hasNextPage, initialHasNextPage]);

  const effectiveLoadedCount = logs.length;

  // Helper function to calculate hasNextPage for individual groups
  const calculateGroupHasNextPage = useCallback((groupId: string | undefined): boolean => {
    if (!groupId) return false;

    // Retrieve the group offset for this groupId
    const groupOffset = groupOffsets.get(groupId) || 0;

    return calcGroupHasNextPageUtil(
      logs,
      groupingExpression,
      filterExpression,
      groupId,
      dataTypes,
      fields,
      tableTileState?.group_limit || 20,
      groupOffset,
    );
  }, [
    logs,
    groupingExpression,
    filterExpression,
    dataTypes,
    fields,
    tableTileState?.group_limit,
    groupOffsets,
  ]);

  // --- end group pagination helpers ---

  // Rename column handler
  const renameColumn = async (oldName: string, newName: string) => {
    if (!projectId) return;
    setPending(true);
    const res = await fieldsActions.rename(projectId, item?.context || null, oldName, newName);
    setPending(false);
    if ((res as any).detail) {
      console.error("Rename failed", res);
    } else {
      router.refresh();
    }
  };

  // Empty table overlay display and content
  const showOverlay =
    !showSpinner &&
    logs.length === 0 &&
    !listContextsQuery.isLoading &&
    !overlayDismissed;
  const overlayMode = availableContexts.length > 0 && !context ? "context" : "new";

  const showActions =
    (grouping.length > 0) ||
    (sorting.length > 0 || groupSorting.length > 0) ||
    (logsFilters != undefined || commonFilter != undefined);

  const tableMenu = (
    <div className="mb-2 mx-1 flex flex-nowrap items-start border-b py-2 gap-x-4 overflow-x-auto command-scrollbar">
        {/* Data Section */}
        <div className="flex flex-col gap-1 border-r pr-4">
            <span className="text-xs text-muted-foreground">Data</span>
            <div className="flex items-center gap-2">
                <GlobalFilter
                    interactive={interactive}
                    logsFilters={logsFilters}
                    commonFilter={commonFilter}
                    setCommonFilter={syncedTileDataActions?.setCommonFilter!}
                    logs={logs}
                    currentTable={item?.name || ""}
                    tableArguments={tableArguments}
                />
                {projectId && (
                  <>
                    <ContextSelector
                        tileId={tileId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        context={item?.context || context_}
                        logsActions={logsActions}
                        contextActions={contextActions}
                        setPending={setPending}
                        tileActions={tileActions}
                        projectsActions={projectsActions}
                        fieldsActions={fieldsActions}
                    />
                    <CreateEmptyLogRow
                        projectId={projectId}
                        globalContext={item?.context || context_}
                        fields={tableDataItem.fields}
                        interactive={interactive}
                        createLogsAction={logsActions.create}
                        onSuccess={() => { router.refresh(); setPending(true); }}
                        onError={(errorMessage) => { console.error("Failed to create log:", errorMessage); alert(`Error: ${errorMessage}`); }}
                    />
                  </>
                )}
            </div>
        </div>
        
        {/* Actions Section */}
        {showActions && projectId && (
            <div className="flex flex-col gap-1 border-r pr-4">
                <span className="text-xs text-muted-foreground">Actions</span>
                <div className="flex items-center gap-2">
                    <ResetServerAction condition={grouping.length > 0} type={"grouping"} interactive={interactive} logs={logs} setterFunction={() => {setGrouping([]); setGroupSorting([])}}/>
                    <ResetServerAction condition={(sorting.length > 0 || groupSorting.length > 0)} type={"sorting"} interactive={interactive} logs={logs} setterFunction={() => {setSorting([]); setGroupSorting([])}}/>
                    <ResetServerAction condition={(logsFilters != undefined || commonFilter != undefined)} type={"filters"} interactive={interactive} logs={logs} setterFunction={() => {setLogsFilters({}); syncedTileDataActions?.setCommonFilter(undefined)}}/>
                </div>
            </div>
        )}
        
        {/* Display Section */}
        <div className="flex flex-col gap-1 border-r pr-4">
            <span className="text-xs text-muted-foreground">Display</span>
            <div className="flex items-center gap-2">
                {projectId && <VisibilityFilter
                    fields={fields}
                    columnVisibility={columnVisibility}
                    setColumnVisibility={setColumnVisibility}
                    context={item?.context ?? null}
                    defaultHidden={defaultHidden ?? true}
                    setDefaultHidden={setDefaultHidden}
                />}
                <SettingButton
                    tooltip={`Cycle split view (${panelCount})`}
                    icon={<SquareSplitHorizontal className="h-4 w-4" />}
                    onClick={() => setPanelCount(c => (c % 2) + 1)}
                />
                {showAdvancedFeatures && (
                  <>
                    <SettingButton
                        tooltip={`Toggle virtualization (${useVirtualization ? 'ON' : 'OFF'})`}
                        icon={<Layers className="h-4 w-4" />}
                        onClick={() => setUseVirtualization(!useVirtualization)}
                        variant={useVirtualization ? "primary" : "outline"}
                    />
                    <SettingButton
                        tooltip={`Toggle bidirectional loading (${useBidirectionalLoading ? 'ON' : 'OFF'})`}
                        icon={<div className="h-4 w-4 flex items-center justify-center text-xs font-bold">↕</div>}
                        onClick={() => setUseBidirectionalLoading(!useBidirectionalLoading)}
                        variant={useBidirectionalLoading ? "primary" : "outline"}
                    />
                    {useBidirectionalLoading && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Pages:</span>
                        <select
                          value={bidirectionalConfig.maxPagesInMemory}
                          onChange={(e) => setBidirectionalConfig(prev => ({ 
                            ...prev, 
                            maxPagesInMemory: Number(e.target.value) 
                          }))}
                          className="text-xs border rounded px-1 py-0.5"
                        >
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                          <option value={7}>7</option>
                          <option value={10}>10</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
            </div>
        </div>
        
        {/* Monitoring Section */}
        {projectId && (
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Monitoring</span>
                <div className="flex items-center gap-2">
                    <FreezeLogs tileId={tileId} tabId={tabId} interfaceId={interfaceId} projectId={projectId} />
                    <RefreshLogs tileId={tileId} tabId={tabId} projectId={projectId} pending={showSpinner} filterExpression={filterExpression} sortingExpression={sortingExpression} groupingExpression={groupingExpression} groupSortingExpression={groupSortingExpression} tileActions={tileActions} logsActions={logsActions} projectsActions={projectsActions} contextActions={contextActions} fieldsActions={fieldsActions} />
                </div>
            </div>
        )}
    </div>
  );

  const tableFooter = projectId && (
    <div className="pt-2 px-1 border-border border-t">
        {useBidirectionalLoading ? (
          // Custom bidirectional controls
          <div className="flex items-center justify-center p-2">
            <div className="text-center">
              <div className="text-sm">
                {(() => {
                  const globalOffset = infiniteLogsQuery.bidirectionalInfo?.globalOffset || 0;
                  const rangeStart = globalOffset + 1;
                  const rangeEnd = globalOffset + effectiveLoadedCount;
                  const itemType = grouping.length > 0 ? "groups" : "logs";
                  
                  if (effectiveLoadedCount === 0) {
                    return `0 of ${totalCount} ${itemType}`;
                  }
                  
                  return `${rangeStart}-${rangeEnd} of ${totalCount} ${itemType} ${showAdvancedFeatures ? `(${effectiveLoadedCount} loaded)` : ""}`;
                })()}
              </div>
              {infiniteLogsQuery.bidirectionalInfo && showAdvancedFeatures && (
                <div className="text-xs text-muted-foreground">
                  Pages: {infiniteLogsQuery.bidirectionalInfo.pagesInMemory}/{infiniteLogsQuery.bidirectionalInfo.maxPagesInMemory}
                  {infiniteLogsQuery.bidirectionalInfo.windowStart !== infiniteLogsQuery.bidirectionalInfo.windowEnd && (
                    <span> | Window: {infiniteLogsQuery.bidirectionalInfo.windowStart}-{infiniteLogsQuery.bidirectionalInfo.windowEnd}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Standard unidirectional controller
          <InfiniteScrollController
              loadedCount={effectiveLoadedCount}
              estimatedTotal={totalCount}
              totalCount={totalCount}
              hasNextPage={effectiveHasNextPage}
              isFetchingNextPage={infiniteLogsQuery.isFetchingNextPage}
              onLoadMore={() => infiniteLogsQuery.fetchNextPage()}
              onRefresh={() => infiniteLogsQuery.refetch()}
              interactive={interactive}
              itemName={grouping.length > 0 ? "groups" : "logs"}
              showRefresh={false}
              className="w-full"
          />
        )}
    </div>
  );

  // Handle cell deselection from clicks
  const containerRef = useRef<HTMLDivElement>(null); 
  const onContainerClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (tableTileActions) deselectFromClickOutside(event, containerRef, selectedCells, tableTileActions.setSelected, ["LogsTable", "LogsTablePreferences"])
  }

  // Manage per-panel scroll refs
  const [panelScrollRefs, setPanelScrollRefs] = useState<React.RefObject<HTMLDivElement>[]>(() =>
    Array.from({ length: panelCount }, () => createRef<HTMLDivElement>())
  );
  useEffect(() => {
    setPanelScrollRefs(prev => {
      const updated = prev.slice(0, panelCount);
      while (updated.length < panelCount) {
        updated.push(createRef<HTMLDivElement>());
      }
      return updated;
    });
  }, [panelCount]);

  return (
    <div
      ref={containerRef} 
      className="flex-1 flex flex-col gap-2 w-full h-[80%] p-2 bg-background rounded-md"
      onClick={onContainerClick}
    >
      {/* If truly pending or logs not present, show a spinner */}
      {showSpinner ? (
        <div className="flex justify-center items-center h-full w-full">
          <Loader2 className="animate-spin my-36" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {tableMenu}
          <ScrollArea className="w-full flex-1 tutorial-logs-table pb-3 relative overflow-x-auto overscroll-y-contain">
            {showOverlay && (
              <EmptyTableOverlay tileName={tileName} mode={overlayMode} onDismiss={() => setOverlayDismissed(true)}/>
            )}
            {/* <div className="min-w-max w-full"> */}
              <div className="min-w-fit w-max">
              {projectId ? (
                <div className="flex h-full gap-2">
                  {Array.from({ length: panelCount }).map((_, idx) => (
                    <div
                      key={idx}
                      ref={panelScrollRefs[idx]}
                      className="relative flex-1 flex-col gap-2 overflow-y-auto border-l ml-2 border-gray-200 first:border-none snap-y snap-mandatory"
                      style={{
                        minWidth: "100%",
                        overflowX: "visible",
                        overflowY: "visible",
                      }}
                    >
                      <DataTable<LogProps | GroupedLogProps>
                        className="LogsTable"
                        interactive={interactive}
                        auto_update={item?.auto_update === "true"}
                        data={logs}
                        columns={columns}
                        state={state}
                        setState={setState}
                        scrollContainerRef={panelScrollRefs[idx]}
                        
                        // Row indexing offset information
                        offsetInfo={{
                          globalOffset: infiniteLogsQuery.bidirectionalInfo?.globalOffset || 0,
                          groupOffsets: groupOffsets,
                        }}
                        
                        // Virtualization props - only enabled when useVirtualization is true
                        enableVirtualization={useVirtualization}
                        virtualRowHeight={60}
                        virtualContainerHeight={600}

                        // Forward loading
                        hasNextPage={effectiveHasNextPage}
                        isFetchingNextPage={infiniteLogsQuery.isFetchingNextPage}
                        fetchNextPage={infiniteLogsQuery.fetchNextPage}

                        // Backward loading
                        hasPreviousPage={infiniteLogsQuery.hasPreviousPage}
                        isFetchingPreviousPage={infiniteLogsQuery.isFetchingPreviousPage}
                        fetchPreviousPage={infiniteLogsQuery.fetchPreviousPage}

                        // Bidirectional loading
                        bidirectionalEnabled={useBidirectionalLoading}
                        bidirectionalInfo={infiniteLogsQuery.bidirectionalInfo}

                        isItemLoaded={(index: number) => !!logs[index]}
                        
                        // Component props
                        LoadMore={LoadMore}
                        
                        // Multi-level LoadMore props
                        GroupLoadMore={({groupId, colSpan, interactive, position}) => (
                          <GroupLoadMore
                            key={`${groupId}-${position || 'after'}`}
                            tileId={tileId}
                            tabId={tabId}
                            projectId={projectId!}
                            context={item?.context || context || context_ || null}
                            columnContext={item?.column_context || null}
                            filterExpression={filterExpression}
                            sortingExpression={sortingExpression}
                            groupingExpression={groupingExpression}
                            groupSortingExpression={groupSortingExpression}
                            limit={tableTileState?.limit || 20}
                            group_limit={tableTileState?.group_limit || 20}
                            logsActions={logsActions}
                            groupId={groupId}
                            dataTypes={dataTypes}
                            fields={fields}
                            isTableDataLoading={isTableDataLoading}
                            updateLogs={updateLogs}
                            colSpan={colSpan}
                            interactive={interactive}
                            LoadMoreComponent={LoadMore}
                            calculateGroupHasNextPage={calculateGroupHasNextPage}
                            bidirectionalEnabled={useBidirectionalLoading}
                            bidirectionalConfig={bidirectionalConfig}
                            position={position}
                            onGroupOffsetChange={(groupId, offset) => {
                                setGroupOffsets(prev => {
                                  const current = prev.get(groupId || "");
                                  if (current === offset) return prev; // no change, keep same reference
                                  const next = new Map(prev);
                                  next.set(groupId || "", offset);
                                  return next;
                                });
                              }}
                          />
                        )}
                        
                        ColumnGroupBy={(column, groupLoading, setGroupLoading, setGroupSortLoading, setIsGrouped, renderMode = "button") => (
                          <ColumnGroupBy
                            interactive={interactive}
                            auto_update={item?.auto_update === "true"}
                            column={column}
                            grouping={state.grouping}
                            setGrouping={setState.setGrouping}
                            setGroupSorting={setState.setGroupSorting}
                            data={logs}
                            groupLoading={groupLoading}
                            setGroupLoading={setGroupLoading}
                            setGroupSortLoading={setGroupSortLoading}
                            setIsGrouped={setIsGrouped}
                            renderMode={renderMode}
                          />
                        )}
                        ColumnGroupSort={(column, groupSortLoading, setGroupSortLoading, setGroupSortingDirection, renderMode = "button", direction) => (
                          <ColumnGroupSort
                            interactive={interactive}
                            column={column}
                            groupSorting={state.groupSorting}
                            setGroupSorting={setState.setGroupSorting}
                            logs={logs}
                            groupSortLoading={groupSortLoading}
                            setGroupSortLoading={setGroupSortLoading}
                            setGroupSortingDirection={setGroupSortingDirection}
                            renderMode={renderMode}
                            direction={direction}
                          />
                        )}
                        ColumnFilters={(column, filterLoading, setIsFiltered, setFilterLoading, open, setOpen, renderMode = "button") => (
                          <ColumnFilter
                            tileId={tileId}
                            tabId={tabId}
                            projectId={projectId}
                            interactive={interactive}
                            setColumnFilterQuery={setLogsFilters}
                            columnFilters={searchParamToFilters(logsFilters, item?.column_context)}
                            column={column.id}
                            dataTypes={dataTypes}
                            open={open}
                            setOpen={setOpen}
                            filterLoading={filterLoading}
                            setIsFiltered={setIsFiltered}
                            setFilterLoading={setFilterLoading}
                            renderMode={renderMode as "button" | "menuItem"}
                            entriesProperties={entriesProperties}
                            paramsProperties={paramsProperties}
                            logsActions={logsActions}
                          />
                        )}
                        ColumnDelete={(column) => (
                          <ColumnDelete
                            tileId={tileId}
                            tabId={tabId}
                            project={projectId}
                            context={context}
                            columnContext={item?.column_context}
                            column={column.id}
                            interactive={interactive}
                            setPending={setPending}
                            getLogFieldsIds={logsActions.get}
                            deleteLogFields={logsActions.delete}
                            logsActions={logsActions}
                            projectsActions={projectsActions}
                            contextActions={contextActions}
                            fieldsActions={fieldsActions}
                          />
                        )}
                        ColumnCreate={(previousColumn: string, setOpen: (open: boolean) => void) => (
                          <ColumnCreate
                            tileId={tileId}
                            tabId={tabId}
                            project={projectId}
                            context={item?.context}
                            columnContext={item?.column_context}
                            currentTable={item?.name || ""}
                            tableArguments={tableArguments}
                            logs={logs}
                            columnOrder={columnOrder}
                            previousColumn={previousColumn}
                            create={derivedEntryActions.create}
                            setPending={setPending}
                            setColumnOrder={setColumnOrder}
                            setOpen={setOpen}
                            logsActions={logsActions}
                            projectsActions={projectsActions}
                            contextActions={contextActions}
                            fieldsActions={fieldsActions}
                          />
                        )}
                        ColumnUpdate={(colId: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode = "button") => (
                          <ColumnUpdate
                            tileId={tileId}
                            tabId={tabId}
                            project={projectId}
                            context={item?.context}
                            colId={colId}
                            previousEquation={fields[sanitizeId(colId)].artifacts}
                            currentTable={item?.name || ""}
                            tableArguments={tableArguments}
                            logs={logs}
                            open={open}
                            updateLoading={updateLoading}
                            renderMode={renderMode as "button" | "menuItem"}
                            update={derivedEntryActions.update}
                            setPending={setPending}
                            setOpen={setOpen}
                            setUpdateLoading={setUpdateLoading}
                            logsActions={logsActions}
                            projectsActions={projectsActions}
                            contextActions={contextActions}
                            fieldsActions={fieldsActions}
                          />
                        )}
                        RowExpanding={(props: RowExpandingProps) => (
                          <RowExpanding
                            row={props.row}
                            groupingColumnId={props.groupingColumnId}
                            isLoading={props.isLoading}
                            isAnimating={props.isAnimating}
                            setExpandingRowId={props.setExpandingRowId}
                            onExpand={
                              async (
                                groupingColumnId: string, 
                                groupingValue: string, 
                                parentId: string, 
                                setExpandingRowId: (id: string | null) => void,
                              ) => {
                              setLoadingGroups(prev => {
                                const next = new Set(prev);
                                if (next.has("_all_groups_")) {
                                  next.delete("_all_groups_");
                                }
                                next.add(props.row.id);
                                return next;
                              });

                              // Initialise group offset to 0 for this expanded group
                              setGroupOffsets(prev => {
                                if (prev.get(props.row.id) === 0) return prev;
                                const next = new Map(prev);
                                next.set(props.row.id, 0);
                                return next;
                              });

                              await onGroupExpand(
                                props.row.id,
                                groupingColumnId,
                                groupingValue,
                                parentId,
                                tileId,
                                tabId,
                                projectId!,
                                item?.context || context || context_ || null,
                                item?.column_context ?? null,
                                filterExpression,
                                sortingExpression,
                                groupingExpression,
                                groupSortingExpression,
                                limit,
                                offset,
                                group_limit,
                                group_offset,
                                logsActions,
                                setExpandingRowId,
                                updateTableDataItemWithUpdater,
                                dataTypes,
                                fields,
                                logs,
                                queryClient,
                                effectiveColumnNames,
                                metric
                              );

                              setLoadingGroups(prev => {
                                const next = new Set(prev);
                                next.delete(props.row.id);
                                return next;
                              });
                            }}
                          />
                        )}
                        AggregatedCell={(cell, row) => (
                          <AggregatedCell
                            tileId={tileId}
                            tabId={tabId}
                            projectId={projectId}
                            context={item?.context || context || context_ || null}
                            columnContext={item?.column_context || null}
                            columns={effectiveColumnNames}
                            filterExpression={filterExpression}
                            groupingExpression={groupingExpression}
                            fields={fields}
                            logsActions={logsActions}
                            cell={cell}
                            row={row}
                            metric={state.metric}
                            isGroupLoading={loadingGroups.has(row.id) || loadingGroups.has("_all_groups_")}
                          />
                        )}
                        FooterCell={(column, resizeMap, table, draggingColumnPinner) =>
                          <FooterCell
                            column={column}
                            resizeMap={resizeMap}
                            draggingColumns={state.draggingColumns}
                            draggingColumnPinner={draggingColumnPinner}
                            setDraggingColumnPinner={setDraggingColumnPinner}
                            columnPinning={columnPinning}
                            columnOrder={columnOrder}
                            table={table}
                          >
                            {
                              column.columnDef.id === indicesTitle
                                ? logs.length > 0
                                ? <ColumnMetrics
                                    tileId={tileId}
                                    tabId={tabId}
                                    projectId={projectId}
                                    interactive={interactive}
                                    metric={state.metric}
                                    setMetric={setState.setMetric}
                                    logs={logs}
                                    entriesProperties={entriesProperties}
                                    paramsProperties={paramsProperties}
                                    filterExpression={filterExpression}
                                    logsActions={logsActions}
                                  /> : null
                                : !column.getIsGrouped()
                                  ? <SummaryCell
                                      tileId={tileId}
                                      tabId={tabId}
                                      projectId={projectId}
                                      column={column}
                                      metric={metric}
                                      pending={summaryPending}
                                      draggingColumns={state.draggingColumns}
                                      entriesProperties={entriesProperties}
                                      paramsProperties={paramsProperties}
                                      filterExpression={filterExpression}
                                      logsLength={logs.length}
                                      logsActions={logsActions}
                                    />
                                  : null
                            }
                          </FooterCell>
                        }
                        ExtraComponents={(table) => {
                          return <DeleteCells project={projectId} selectedCells={selectedCells} logs={logs} deleteLogFields={logsActions.delete} columnContext={item?.column_context} context={item?.context} setPending={setPending}/>
                        }}
                        ExtraCellContent={(cell, isCellExpanded, setExpandedCells) =>
                          <CellPopover flatLogs={flatLogs} paramsValues={paramsValues} cell={cell} isCellExpanded={isCellExpanded} setExpandedCells={setExpandedCells} />
                        }
                        error={error}
                        onRenameColumn={renameColumn}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <BaseTable items={[{ Entries: "Select a project to display your logs." }]} />
              )}
              </div>
            {/* </div> */}
            <ScrollBar orientation="vertical" className="z-50" />
            <ScrollBar orientation="horizontal" className="z-50" />
          </ScrollArea>
          {tableFooter}
        </div>
      )}
    </div>
  );
};

export default LogsTable;