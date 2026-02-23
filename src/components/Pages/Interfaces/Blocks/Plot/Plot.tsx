'use client';

import { useEffect, useRef, useId, useState, useMemo } from 'react';
import {
  LogsActions,
  FieldsActions,
  GranularTileActions,
  ContextActions,
  ProjectsActions,
} from '@/types/interfaces/grid';
import { clearFixedTooltip } from '@/utils/interfaces/plots/tooltip';
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { useTab } from '@/contexts/hooks/tab';
import PlotSettings from './Sidebar';
import {
  usePlotArgumentsQuery,
  usePlotDataQueryWithTracking,
} from '@/hooks/Interfaces/Query/usePlotDataQuery';
import { usePlotTileSync } from '@/contexts/hooks/tile/sync/usePlotTileSync';
import { PlotArguments } from '@/types/interfaces/logs';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';
import { Button } from '@/components/UI/button';
import { useQueryClient } from '@tanstack/react-query';
import { usePlotAutoUpdateQuery } from '@/hooks/Interfaces/Query/usePlotAutoUpdateQuery';
import { PlotCanvas } from '@/components/Common/Plot/PlotCanvas';

const LogsPlot = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  tileActions,
  projectsActions,
  contextActions,
  logsActions,
  fieldsActions,
}: {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
}) => {
  // Use granular hooks for better performance
  const {
    ui: tileUIState,
    dataActions: tileDataActions,
    plotTile: plotTileState,
  } = useTile(tileId, tabId);

  // SYNCHRONISED PLOT-SPECIFIC ACTIONS (optimistic + router refresh)
  const { plotTileActions } = usePlotTileSync(
    tileId,
    tabId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );

  const { itemActions } = useTileItem(tileId, tabId);

  // Get access to the tab context and actions with granular access
  const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabId, interfaceId);
  const setFocusPaneOpen = useStoreContext((state) => state.setFocusPaneOpen);
  const queryClient = useQueryClient();

  // Get the item representation for the current tile
  const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

  // Get global UI mode settings
  const { isInteractive } = useGlobalUIMode();

  // UI state from the tab
  const interactive = isInteractive;
  const pending = tabUIState?.pending || tileUIState?.pending || false;

  // Use React Query to access plotDataItem and plotArguments
  const {
    plotDataItem,
    isLoading: isPlotDataLoading,
    isError: isPlotDataError,
    error: plotDataError,
  } = usePlotDataQueryWithTracking(tileId);

  const { data: args } = usePlotArgumentsQuery(tabId);

  // Wire up manual refresh for Retry using the auto-update hook's queryFn
  const { manualRefresh: manualPlotRefresh } = usePlotAutoUpdateQuery(
    tileId,
    tabId,
    projectId,
    pending,
    logsActions,
    projectsActions,
    contextActions,
    fieldsActions
  );

  // Init logs and handle local updates
  const {
    plotLogs: logs,
    plotFields: fields,
    preAggregatedBarData,
  } = useMemo(() => plotDataItem, [plotDataItem]);

  // Show error UI flags if data fetch failed (rendered later, after all hooks)
  const plotError = (plotDataItem as any)?.error as any;
  const showPlotError = !!(plotError && typeof plotError === 'string' && !isPlotDataLoading);
  const isTimeout =
    typeof plotError === 'string' && (plotError.includes('timeout') || plotError.includes('504'));

  // Initialize shared refs
  let svgRef = useRef<SVGSVGElement>(null);
  let containerRef = useRef<HTMLDivElement>(null);
  let settingsRef = useRef<HTMLDivElement>(null);

  // Plot settings
  let plotType = item?.plotType;
  plotType = plotType ? plotType : 'Scatter Plot';

  let metric = item?.metric ? item?.metric : 'mean';
  let aggregateProperty = item?.plotAggregate;
  const groupings = Object.fromEntries(
    Object.entries(args as PlotArguments)
      .filter(([_, tableArgs]) => tableArgs.grouping)
      .map(([table, tableArgs]) => [table, tableArgs.grouping.split(',')])
  );

  let binCount = item?.binCount ? parseFloat(item?.binCount) : 10;
  const [binCounts, setBinCounts] = useState([1, 100]);
  let showRegression = item?.regressionLine === 'true' ? 'true' : 'false';

  let scaleX = item?.plotScaleX;
  let scaleY = item?.plotScaleY;
  const [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
  const [logScaleYEnabled, setLogScaleYEnabled] = useState(true);
  scaleX = scaleX ? scaleX : 'linear';
  scaleY = scaleY ? scaleY : 'linear';

  // Axes and grouping selected on the plot
  const selectedXAxisProperty = item?.xAxis;
  const selectedYAxisProperty = item?.yAxis;
  const groupByProperty = item?.plotGroupBy;
  const [isGroupingKeyMinimized, setIsGroupingKeyMinimized] = useState(false);

  useEffect(() => {
    if (settingsRef.current) {
      (settingsRef.current as any).__isGroupingKeyMinimized = isGroupingKeyMinimized;
      (settingsRef.current as any).__setIsGroupingKeyMinimized = setIsGroupingKeyMinimized;
    }
  }, [isGroupingKeyMinimized, setIsGroupingKeyMinimized]);

  // Sort bars for bar chart
  const [sortBars, setSortBars] = useState('asc');

  // Fixed tooltip states
  const [isTooltipMinimized, setIsTooltipMinimized] = useState(false);

  // Track zoom level
  const [zoomEnabled, setZoomEnabled] = useState(false);

  // Handle scale changes from PlotCanvas
  const handleScaleXChange = (scale: string) => {
    plotTileActions?.setPlotScaleX(scale);
  };

  const handleScaleYChange = (scale: string) => {
    plotTileActions?.setPlotScaleY(scale);
  };

  const handleBinCountChange = (count: number) => {
    plotTileActions?.setBinCount(String(count));
  };

  if (showPlotError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-h4 mb-2">Failed to Load Plot Data</h3>
          <p className="text-body max-w-md text-muted-foreground">
            {isTimeout
              ? 'The request timed out. The server may be under heavy load or temporarily unavailable.'
              : String(plotError)}
          </p>
        </div>
        <Button
          onClick={async () => {
            await manualPlotRefresh();
          }}
        >
          Retry Loading Data
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-row items-stretch overflow-hidden">
      {/* Chart Container - Uses PlotCanvas with shared refs */}
      <div className="relative flex h-full flex-1 overflow-hidden">
        <PlotCanvas
          logs={logs}
          fields={fields}
          plotType={plotType}
          xAxis={selectedXAxisProperty}
          yAxis={selectedYAxisProperty}
          groupBy={groupByProperty}
          aggregate={aggregateProperty}
          scaleX={scaleX}
          scaleY={scaleY}
          metric={metric}
          binCount={binCount}
          showRegression={showRegression}
          sortBars={sortBars}
          interactive={interactive}
          zoomEnabled={zoomEnabled}
          hoveredLog={tabUIState?.hoveredLog}
          onHoverLog={tabUIActions?.setHoveredLog}
          onScaleXChange={handleScaleXChange}
          onScaleYChange={handleScaleYChange}
          onBinCountChange={handleBinCountChange}
          onLogScaleXEnabledChange={setLogScaleXEnabled}
          onLogScaleYEnabledChange={setLogScaleYEnabled}
          plotTileState={plotTileState}
          // Pass shared refs so PlotSettings can access them
          svgRef={svgRef}
          containerRef={containerRef}
          settingsRef={settingsRef}
          // Pass pre-aggregated bar chart data from backend
          preAggregatedBarData={preAggregatedBarData}
        />
      </div>

      {/* Settings Panel - shares refs with PlotCanvas */}
      <PlotSettings
        showSettings={interactive}
        tabUIState={tabUIState}
        tabUIActions={tabUIActions}
        setFocusPaneOpen={setFocusPaneOpen}
        tileName={item?.name}
        interactive={interactive}
        pending={pending}
        svgRef={svgRef}
        containerRef={containerRef}
        settingsRef={settingsRef}
        plotType={plotType}
        fields={fields}
        selectedXAxisProperty={selectedXAxisProperty}
        selectedYAxisProperty={selectedYAxisProperty}
        logs={logs}
        metric={metric}
        scaleX={scaleX}
        scaleY={scaleY}
        logScaleXEnabled={logScaleXEnabled}
        logScaleYEnabled={logScaleYEnabled}
        groupByProperty={groupByProperty}
        binCounts={binCounts}
        binCount={binCount}
        sortBars={sortBars}
        setSortBars={setSortBars}
        groupings={groupings}
        aggregateProperty={aggregateProperty}
        showRegression={showRegression}
        zoomEnabled={zoomEnabled}
        setZoomEnabled={setZoomEnabled}
        tileId={tileId}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        serverTileActions={tileActions}
        projectsActions={projectsActions}
        contextActions={contextActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        plotTileState={plotTileState}
        isTooltipMinimized={isTooltipMinimized}
        setIsTooltipMinimized={setIsTooltipMinimized}
        isGroupingKeyMinimized={isGroupingKeyMinimized}
        setIsGroupingKeyMinimized={setIsGroupingKeyMinimized}
        plotTileActions={plotTileActions}
        tileDataActions={tileDataActions}
      />
    </div>
  );
};

export default LogsPlot;
