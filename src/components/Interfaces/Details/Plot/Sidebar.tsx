"use client";

import React, { useState, useMemo, Dispatch, SetStateAction } from 'react';
import { LuPanelLeftOpen, LuPanelRightOpen } from 'react-icons/lu';

import { Button } from "@/components/UI/button";
import { Accordion } from "@/components/UI/accordion";
import Tooltip from "@/components/Common/Misc/Tooltip";

import { LogFieldsResponseProps, LogProps, PlotArguments } from '@/types/evals/logs';
import { FieldsActions, LogsActions, PlotDataItem } from '@/types/evals/grid';

import { PlotActions } from '@/contexts/hooks/tile/usePlotTile';
import { TileDataActions } from '@/contexts/hooks';

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
  tileId,
  tabId,
  interfaceId,
  projectId,
  args,
  setPlotDataItem,
  logsActions,
  fieldsActions,
  plotTileActions,
  tileDataActions,
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

  /* Refreshing and streaming */
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  args: PlotArguments;
  setPlotDataItem: Dispatch<SetStateAction<PlotDataItem>>,
  
  /* Server actions */
  plotTileActions: PlotActions | null;
  tileDataActions: TileDataActions | null;
  logsActions: LogsActions ;
  fieldsActions: FieldsActions;
}) => {
  const [isOpen, setIsOpen] = useState(true);

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

  // Show fixed tooltip / grouping key
  const showFixedTooltip = true;
  const showGroupByKey = groupByProperty != undefined && groupByProperty != "None";

  return (
    <div 
      ref={settingsRef}
      style={{
        height: containerRef.current?.clientHeight,
        maxHeight: containerRef.current?.clientHeight
      }}
      className={`relative flex flex-col bg-background border-l border-border transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-12'} rounded-r-md`}
    >

      {/* Toggle Button */}
      <div className={`flex ${isOpen ? 'justify-end' : 'justify-center'} p-2 border-t border-border`}>
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

      {/* Settings Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 delay-100`}>
        {isOpen && (
          <>
            {/* Scrollable Accordion Section */}
            <div className="flex-1 overflow-y-auto px-1">
              <Accordion type="multiple" defaultValue={defaultAccordionValue} className="w-full px-2">

                {/* Plot Type Selection */}
                <PlotType
                  interactive={interactive}
                  plotType={plotType}
                  svgRef={svgRef}
                  containerRef={containerRef}
                  fields={fields}
                  selectedXAxisProperty={selectedXAxisProperty}
                  selectedYAxisProperty={selectedYAxisProperty}
                  setPlotType={setPlotType}
                  setXAxis={setXAxis}
                  setYAxis={setYAxis}
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
            <div className="flex flex-col gap-2 px-3 pb-4 space-y-3">
              {showFixedTooltip && (
                <div className="fixedPlotTooltip relative p-3 border border-muted rounded-md hidden text-sm"></div>
              )}
              {showGroupByKey && (
                <div
                  style={{"scrollbar-width": "none"} as React.CSSProperties} 
                  className="groupingKey py-2 px-3 flex flex-col gap-1 overflow-auto w-full h-full max-h-[150px] rounded-md border-2 border border-dashed rounded"
                ></div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Folded State Icons */}
      {!isOpen && (
         <div className="flex flex-col items-center p-2">
            <PlotRefresh
              tileId={tileId}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              pending={pending}
              args={args}
              setPlotDataItem={setPlotDataItem}
              logsActions={logsActions}
              fieldsActions={fieldsActions}
              logs={logs}
            />
            <PlotReset
              svgRef={svgRef}
              containerRef={containerRef}
              setXAxis={setXAxis}
              setYAxis={setYAxis}
              setGroupBy={setGroupBy}
              setAggregateProperty={setAggregateProperty}
            />
         </div>
      )}
    </div>
  );
};

export default PlotSettings;