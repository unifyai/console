"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  ModelSelector,
  ProviderSelector,
  TagSelector,
  TimeRangeSelector,
} from './Filters';
import QueryHistoryTable from './QueryHistoryTable';
import { CallsPlot } from './Plots/Calls';
import { TokensBreakdownPlot } from './Plots/TokensBreakdown';
import { LatencyPlot } from './Plots/Latency';
import { ThroughputPlot } from './Plots/Throughput';
import { useUsageMetricsQuery, useUsageHistoryQuery } from '@/hooks/Usage';
import { formatDateForPicker } from '@/utils/dateUtils';
import PageController from '../Common/Tables/Data/Buttons/PageController';
import { Skeleton } from '../UI/skeleton';
import { ScrollArea } from '../UI/scroll-area';

export default function Usage() {
  // State for endpoints
  const [allEndpoints, setAllEndpoints] = useState<string[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState<boolean>(true);

  // Fetch endpoints on component mount
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const res = await fetch(`/api/endpoints/list`);
        if (!res.ok) {
          throw new Error('Failed to fetch endpoints');
        }
        const data = await res.json();
        setAllEndpoints(data);
      } catch (error) {
        console.error('Error fetching endpoints:', error);
      } finally {
        setIsLoadingEndpoints(false);
      }
    };

    fetchEndpoints();
  }, []);

  // Filter states
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startDate, setStartDateState] = useState<string | undefined>();
  const [endDate, setEndDateState] = useState<string | undefined>();

  // pagination 
  const [pageIndex, setPageIndex] = useState<string | undefined>();
  const pagination = {
    pageIndex: pageIndex ? parseInt(pageIndex) - 1 : 0,
    pageSize: 20
  };

  // Derived data
  const models = useMemo(() => {
    return Array.from(new Set(allEndpoints.map((e) => e.split('@')[0])));
  }, [allEndpoints]);

  const providers = useMemo(() => {
    return Array.from(new Set(allEndpoints.map((e) => e.split('@')[1])));
  }, [allEndpoints]);

  const formattedStartDate = useMemo(() => {
    if (!startDate) return undefined;
    return formatDateForPicker(new Date(startDate));
  }, [startDate]);

  const formattedEndDate = useMemo(() => {
    if (!endDate) return undefined;
    return formatDateForPicker(new Date(endDate));
  }, [endDate]);

  // Fetch usage history
  const { data: historyData, isLoading: historyPending, refetch: refetchHistory } = useUsageHistoryQuery({
    start: formattedStartDate || "",
    end: formattedEndDate || "",
    page: pagination.pageIndex + 1,
    models: selectedModels || undefined,
    providers: selectedProviders || undefined,
    tags: selectedTags || undefined,
  });

  // Fetch usage metrics
  const { data: metricsData, isLoading: isMetricsLoading } = useUsageMetricsQuery({
    start: formattedStartDate || "",
    end: formattedEndDate || "",
    models: selectedModels || undefined,
    providers: selectedProviders || undefined
  });

  // Extract tags from history data
  const tags = useMemo(() => {
    if (!historyData) return [];
    const uniqueTags = new Set<string>();
    historyData.queries.forEach((entry) => {
      entry.tags?.forEach((tag) => uniqueTags.add(tag));
    });
    return Array.from(uniqueTags);
  }, [historyData]);

  const handlePageChange = (newPagination: { [key: string]: number }) => {
    setPageIndex(`${newPagination.pageIndex + 1}`);
    refetchHistory();
  };


  return (
    <div className="w-full">
      <div className="w-full p-10">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-10">
          <h1 className="text-4xl font-bold">Usage</h1>
          <p className="text-lg">Track your API activity including metrics and prompt history.</p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap md:flex-nowrap items-start gap-6 mb-10 w-full tutorial-usage-filters">
          <ModelSelector
            models={models}
            selectedModels={selectedModels}
            onModelChange={setSelectedModels}
            className="flex-1 min-w-[200px]"
          />
          <ProviderSelector
            providers={providers}
            selectedProviders={selectedProviders}
            onProviderChange={setSelectedProviders}
            className="flex-1 min-w-[200px]"
          />
          <TagSelector
            tags={tags}
            selectedTags={selectedTags}
            onTagChange={setSelectedTags}
            className="flex-1 min-w-[200px]"
          />
          <TimeRangeSelector
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start: string, end: string) => {
              setStartDateState(start);
              setEndDateState(end);
            }}
            className="flex-1 min-w-[200px]"
          />
        </div>

        {/* Graphs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full mb-10">
          {/* Graph 1 */}
          <div className="flex flex-col gap-4 w-full">
            <p className="font-semibold text-2xl">Number of calls</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[300px] w-full bg-background p-4 shadow-md rounded-md" />
            ) : (
              <div className="h-[300px] w-full bg-background p-4 shadow-md rounded-md tutorial-calls-plot">
                { metricsData && <CallsPlot data={metricsData?.calls} /> }
              </div>
            )}
          </div>
          {/* Graph 2 */}
          <div className="flex flex-col gap-4 w-full">
            <p className="font-semibold text-2xl">Tokens breakdown</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[300px] w-full bg-background p-4 shadow-md rounded-md" />
            ) : (
              <div className="h-[300px] w-full bg-background p-4 shadow-md rounded-md tutorial-tokens-plot">
                { metricsData && <TokensBreakdownPlot data={metricsData.tokens} /> }
              </div>
            )}
          </div>
          {/* Graph 3 */}
          <div className="flex flex-col gap-4 w-full">
            <p className="font-semibold text-2xl">Latency</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[300px] w-full bg-background p-4 shadow-md rounded-md" />
            ) : (
              metricsData && <LatencyPlot data={metricsData.latency} />
            )}
          </div>
          {/* Graph 4 */}
          <div className="flex flex-col gap-4 w-full">
            <p className="font-semibold text-2xl">Throughput</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[300px] w-full bg-background p-4 shadow-md rounded-md" />
            ) : (
              <div className="h-[300px] w-full bg-background p-4 shadow-md rounded-md tutorial-throughput-plot">
                { metricsData && <ThroughputPlot data={metricsData.throughput} /> }
              </div>
            )}
          </div>
        </div>
        {/* Query History Table */}
        <div className="w-full mb-10">
          <h2 className="text-2xl font-semibold mb-4">Query History</h2>
          {historyPending ? (
            <Skeleton className="w-full h-[500px] bg-background p-4 shadow-md rounded-md" />
          ) : (
            <ScrollArea className="w-full h-[500px] bg-background p-4 shadow-md rounded-md">
              { historyData && <QueryHistoryTable queries={historyData.queries} /> }
            </ScrollArea>
          )}
          
          <div className="mt-4 flex justify-center">
            <PageController
              totalPages={historyData?.total_pages || 1}
              pagination={{
                pageIndex: pagination.pageIndex,
                pageSize: pagination.pageSize
              }}
              setPagination={handlePageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}