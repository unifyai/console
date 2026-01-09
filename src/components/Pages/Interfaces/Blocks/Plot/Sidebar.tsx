"use client";

import React, { useEffect, useState, useMemo, Dispatch, SetStateAction } from 'react';
import { LuPanelLeftOpen, LuPanelRightOpen } from 'react-icons/lu';

import { Button } from "@/components/UI/button";
import { Accordion } from "@/components/UI/accordion";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { ScrollArea } from '@/components/UI/scroll-area';

import { LogFieldsResponseProps, LogProps } from '@/types/interfaces/logs';
import { ContextActions, GranularTileActions, FieldsActions, LogsActions, ProjectsActions } from '@/types/interfaces/grid';

import { PlotActions } from '@/contexts/hooks/tile/usePlotTile';
import { TileDataActions } from '@/contexts/hooks';
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';
import { PlotTile } from '@/contexts/slices/selectors/plotTile';

import PlotType from './Buttons/PlotType';
import PlotAxis from './Buttons/PlotAxis';
import PlotScale from './Buttons/PlotScale';
import PlotSort from './Buttons/PlotSort';
import PlotBins from './Buttons/PlotBins';
import PlotGroupBy from './Buttons/PlotGroupBy';
import PlotAggregate from './Buttons/PlotAggregate';
import PlotRegression from './Buttons/PlotRegression';
import PlotRefresh from './Buttons/PlotRefresh';
import PlotReset from './Buttons/PlotReset';
import PlotZoom from './Buttons/PlotZoom';
import ActionButton from '@/components/Common/Buttons/Action';
import { Maximize2 } from 'lucide-react';
import { ColorSchemePicker } from '@/components/Common/Misc/ColorSchemePicker';
import { useStoreContext } from '@/contexts/providers/StoreProvider';


const PlotSettings = ({
  interactive,
  pending,
  svgRef,
  containerRef,
  settingsRef,
  plotType,
  fields,
  selectedXAxisProperty,
  selectedYAxisProperty,
  logs,
  metric,
  scaleX,
  scaleY,
  logScaleXEnabled,
  logScaleYEnabled,
  groupByProperty,
  binCount,
  binCounts,
  sortBars,
  setSortBars,
  groupings,
  aggregateProperty,
  showRegression,
  zoomEnabled,
  setZoomEnabled,
  tileId,
  tabId,
  interfaceId,
  projectId,
  isTooltipMinimized,
  setIsTooltipMinimized,
  isGroupingKeyMinimized,
  setIsGroupingKeyMinimized,
  serverTileActions,
  logsActions,
  projectsActions,
  contextActions,
  fieldsActions,
  plotTileState,
  plotTileActions,
  tileDataActions,
  showSettings,
  tabUIState,
  tabUIActions,
  setFocusPaneOpen,
  tileName
}: {
  /* Statuses */
  interactive: boolean;
  pending: boolean;
  
  /* Containers */
  svgRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  settingsRef: React.RefObject<HTMLDivElement>;

  /* Data */
  logs: LogProps[] | undefined;
  fields: LogFieldsResponseProps;
  
  /* Main settings */
  plotType: string;
  selectedXAxisProperty: string | undefined;
  selectedYAxisProperty: string | undefined;
  
  /* Axis scales */
  scaleX: string; 
  scaleY: string;
  logScaleXEnabled: boolean;
  logScaleYEnabled: boolean;
  
  /* Grouping by */
  groupByProperty: string | undefined;
  metric: string;
  isGroupingKeyMinimized: boolean;
  setIsGroupingKeyMinimized: Dispatch<SetStateAction<boolean>>;

  /* Aggregating by */
  groupings: {[k: string]: string[]};
  aggregateProperty: string | undefined;

  /* Bar chart sorting */
  sortBars: string;
  setSortBars: (x: string) => void;
  
  /* Histogram bins */
  binCounts: number[];
  binCount: number;

  /* Scatter plot regression line */
  showRegression: string;

  /* Zoom toggle */
  zoomEnabled: boolean;
  setZoomEnabled: (enabled: boolean) => void;

  /* Refreshing and streaming */
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  
  /* Fixed tooltip */
  isTooltipMinimized: boolean;
  setIsTooltipMinimized: Dispatch<SetStateAction<boolean>>;

  /* Server actions */
  serverTileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  logsActions: LogsActions ;
  fieldsActions: FieldsActions;

  /* UI state */
  plotTileState: PlotTile | null

  /* UI state actions */
  plotTileActions: PlotActions | null;
  tileDataActions: TileDataActions | null;
  /* Focus pane helpers */
  showSettings: boolean;
  tabUIState: any;
  tabUIActions: any;
  setFocusPaneOpen: (open:boolean)=>void;
  tileName: string | undefined;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const focusPaneOpen = useStoreContext(state=>state.focusPaneOpen);
  
  // Get global UI mode settings
  const { isEditMode } = useGlobalUIMode();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Memoize default open accordion items
  const defaultAccordionValue = useMemo(() => {
      const values = ['plot-type'];
      if (selectedXAxisProperty) values.push('axis-x');
      if (selectedYAxisProperty) values.push('axis-y');
      return values;
  }, [selectedXAxisProperty, selectedYAxisProperty]);

  // Map actions to setters
  const setPlotType = plotTileActions?.setPlotType;
  const setXAxis = plotTileActions?.setXAxis;
  const setYAxis = plotTileActions?.setYAxis;
  const setScaleX = plotTileActions?.setPlotScaleX;
  const setScaleY = plotTileActions?.setPlotScaleY;
  const setBinCount = plotTileActions?.setBinCount;
  const setGroupBy = plotTileActions?.setPlotGroupBy;
  const setAggregateProperty = plotTileActions?.setAggregateProperty;
  const setShowRegression = plotTileActions?.setRegressionLine;
  const setMetric = tileDataActions?.setMetric;

  // Attach isOpen state and setter to ref
  useEffect(() => {
    if (settingsRef.current) {
        const node = settingsRef.current as any;
        node.__isOpen = isOpen;
        node.__setIsOpen = setIsOpen;
    }
  }, [
      isOpen, setIsOpen, settingsRef
  ]);

  // Show fixed tooltip / grouping key
  const showFixedTooltip = true;
  const showGroupByKey = groupByProperty != undefined && groupByProperty != "None";

  return (
    <div 
      ref={settingsRef}
      className={`relative flex flex-col bg-background border-l border-border transition-all duration-300 ease-in-out ${showSettings ? (isOpen ? 'w-64' : 'w-12') : 'w-0 opacity-0 pointer-events-none'}`}
    >
      {/* Settings Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 delay-100`}>
        {isOpen && (
          <ScrollArea>
            {/* Scrollable Accordion Section */}
            <div className="flex-1 px-1">
              <Accordion type="multiple" defaultValue={defaultAccordionValue} className="w-full px-2">

                {/* Plot Type Selection */}
                <PlotType
                  interactive={interactive}
                  settingsRef={settingsRef}
                  plotType={plotType}
                  svgRef={svgRef}
                  containerRef={containerRef}
                  fields={fields}
                  selectedXAxisProperty={selectedXAxisProperty}
                  selectedYAxisProperty={selectedYAxisProperty}
                  setPlotType={setPlotType}
                  setXAxis={setXAxis}
                  setYAxis={setYAxis}
                  setIsTooltipMinimized={setIsTooltipMinimized}
                />

                {/* X Axis Selection */}
                {<PlotAxis
                    interactive={interactive}
                    plotType={plotType}
                    fields={fields}
                    axisProperty={selectedXAxisProperty}
                    setAxisProperty={setXAxis}
                    axis="X"
                    logs={logs}
                    metric={metric}
                    setMetric={setMetric}
                />}

                {/* Y Axis Selection */}
                <PlotAxis
                    interactive={interactive}
                    plotType={plotType}
                    fields={fields}
                    axisProperty={selectedYAxisProperty}
                    setAxisProperty={setYAxis}
                    axis="Y"
                    logs={logs}
                    metric={metric}
                    setMetric={setMetric}
                  />

                {/* Grouping by */}
                <PlotGroupBy
                    interactive={interactive}
                    plotType={plotType}
                    fields={fields}
                    groupBy={groupByProperty}
                    logs={logs}
                    setGroupBy={setGroupBy}
                />

                {/* Aggregate by metric */}
                <PlotAggregate
                    interactive={interactive}
                    plotType={plotType}
                    groupings={groupings}
                    aggregateProperty={aggregateProperty}
                    logs={logs}
                    setAggregateProperty={setAggregateProperty}
                />
                {/* Axis scales */}
                <PlotScale 
                    interactive={interactive}
                    plotType={plotType}
                    scaleX={scaleX} 
                    scaleY={scaleY}
                    logScaleXEnabled={logScaleXEnabled} 
                    logScaleYEnabled={logScaleYEnabled} 
                    selectedXAxisProperty={selectedXAxisProperty} 
                    fields={fields}
                    setScaleX={setScaleX}
                    setScaleY={setScaleY} 
                />

                {/* Bar chart sorting */}
                <PlotSort
                  interactive={interactive}
                  plotType={plotType}
                  groupByProperty={groupByProperty}
                  sortBars={sortBars}
                  setSortBars={setSortBars}
                />

                {/* Histrogram binning */}
                <PlotBins
                  interactive={interactive}
                  plotType={plotType}
                  binCount={binCount}
                  setBinCount={setBinCount}
                  binCounts={binCounts}
                />

                {/* Scatter plot regression */}
                <PlotRegression
                  interactive={interactive}
                  plotType={plotType}
                  showRegression={showRegression}
                  setShowRegression={setShowRegression}
                />

              </Accordion>
            </div>

            {/* Divider */}
            { (showFixedTooltip || showGroupByKey) && <hr className="mx-3 my-3 border-border" /> }

            {/* Fixed Tooltip and Grouping Key */}
            <div className="flex flex-col gap-2 px-3 pb-4">
              {/* Fixed Tooltip Container */}
              <div className={`fixedPlotTooltip relative border border-dashed rounded-md hidden text-caption transition-all duration-200 ease-in-out ${
                isTooltipMinimized 
                  ? 'h-10 overflow-hidden px-2 py-1' 
                  : 'p-3'
                }`}
              >
                {/* Content is rendered by d3 inside renderFixedTooltipContent */}
              </div>

              {/* Grouping Key Container */}
              {showGroupByKey && (
                <div
                  className={`groupingKey flex flex-col gap-1 w-full rounded-md border border-muted transition-all duration-200 ease-in-out ${
                    isGroupingKeyMinimized
                    ? "h-10 overflow-hidden px-2 py-1"
                    : "max-h-[150px] p-3"
                  }`}
                >
                  {/* Content is rendered by d3 */}
                </div>
              )}
            </div>

          </ScrollArea>
        )}
      </div>

      {/* Folded State Icons */}
      {!isOpen && (
         <div className="flex flex-col items-center p-2 gap-2">
            {showGroupByKey && (
              <ColorSchemePicker
                placeholder="Select a grouping color scheme"
                value={plotTileState?.plotGroupByColors ?? undefined}
                onChange={(scheme) => plotTileActions?.setPlotGroupByColors(scheme)}
                useDialog={true}
              />
            )}
            {!isEditMode && !focusPaneOpen && (
              <ActionButton
                tooltip="Open in focus pane"
                side="left"
                icon={<Maximize2 className="h-4 w-4" />}
                variant={focusPaneOpen && (tabUIState?.focusedTileNames || [undefined, undefined]).includes(tileName) ? "primary" : undefined}
                disabled={false}
                onClick={() => {
                  const focused = tabUIState?.focusedTileNames || [undefined, undefined];
                  if (tileName && !focused.includes(tileName)) {
                    tabUIActions?.setFocusedTileNames([
                      tileName,
                      focused[0] || focused[1],
                    ] as [string | undefined, string | undefined]);
                  }
                  setFocusPaneOpen(true);
                }}
              />
            )}
            <PlotZoom
              interactive={interactive}
              plotType={plotType}
              zoomEnabled={zoomEnabled}
              setZoomEnabled={setZoomEnabled}
            />
            <PlotRefresh
              tileId={tileId}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              pending={pending}
              tileActions={serverTileActions}
              logsActions={logsActions}
              projectsActions={projectsActions}
              contextActions={contextActions} 
              fieldsActions={fieldsActions}
            />
         </div>
      )}

      {/* Toggle Button - moved to bottom */}
      <div className={`flex ${isOpen ? 'justify-between' : 'justify-center'} px-2 py-1.5 border-t`}>
        {/* Clear plot button */}
        {isOpen && 
          <PlotReset
            settingsRef={settingsRef}
            svgRef={svgRef}
            containerRef={containerRef}
            setXAxis={setXAxis}
            setYAxis={setYAxis}
            setGroupBy={setGroupBy}
            setAggregateProperty={setAggregateProperty}
            setIsTooltipMinimized={setIsTooltipMinimized}
            setZoomEnabled={setZoomEnabled}
          />
        }
        <Tooltip content={isOpen ? "Hide settings" : "Show settings"} side="left">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={isOpen ? 'Collapse settings' : 'Expand settings'}
            className="h-8 w-8"
          >
            {isOpen ? <LuPanelLeftOpen size={18} /> : <LuPanelRightOpen size={18} />}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default PlotSettings;