'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ModelSelector, ProviderSelector, TagSelector } from './Filters';
import { DateRangeSelector } from './Filters';
import QueryHistoryTable from './QueryHistoryTable';
import { CallsPlot } from './Plots/Calls';
import { TokensBreakdownPlot } from './Plots/TokensBreakdown';
import { LatencyPlot } from './Plots/Latency';
import { ThroughputPlot } from './Plots/Throughput';
import { useUsageMetricsQuery } from '@/hooks/Usage';
import { formatDateForPicker } from '@/utils/dateUtils';
import { Skeleton } from '../../UI/skeleton';
import { ScrollArea } from '../../UI/scroll-area';
import { useUsageHistoryQuery } from '@/hooks/Usage/usage-history'; // Use the new infinite query hook
import { Loader2 } from 'lucide-react';

export default function Usage() {
  // State for endpoints
  const [allEndpoints, setAllEndpoints] = useState<string[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState<boolean>(true);

  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const res = await fetch('/api/endpoints/list');
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

  const {
    data: queryData,
    isLoading: isQueryLoading,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useUsageHistoryQuery({
    start: formattedStartDate || '',
    end: formattedEndDate || '',
    models: selectedModels || undefined,
    providers: selectedProviders || undefined,
    tags: selectedTags || undefined,
  });

  const allQueries = useMemo(() => {
    //ts.ignore
    if (!queryData?.pages) return [];
    //ts.ignore
    return queryData?.pages.flatMap((page) => page.queries);
  }, [queryData]);

  // Extract tags from history data
  const tags = useMemo(() => {
    const uniqueTags = new Set<string>();
    //ts.ignore
    allQueries.forEach((entry: any) => {
      entry.tags?.forEach((tag: string) => uniqueTags.add(tag));
    });
    return Array.from(uniqueTags);
  }, [allQueries]);

  // Fetch usage metrics
  const { data: metricsData, isLoading: isMetricsLoading } = useUsageMetricsQuery({
    start: formattedStartDate || '',
    end: formattedEndDate || '',
    models: selectedModels || undefined,
    providers: selectedProviders || undefined,
  });

  // Intersection Observer to trigger fetchNextPage
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    observer.observe(loadMoreRef.current);
    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="w-full">
      <div className="w-full p-10">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4">
          <h1 className="text-4xl font-bold">Usage</h1>
          <p className="text-lg">Track your API activity including metrics and prompt history.</p>
        </div>

        {/* Filter Bar */}
        <div className="tutorial-usage-filters mb-10 flex w-full flex-wrap items-start gap-6 md:flex-nowrap">
          <ModelSelector
            models={models}
            selectedModels={selectedModels}
            onModelChange={setSelectedModels}
            className="min-w-[200px] flex-1"
          />
          <ProviderSelector
            providers={providers}
            selectedProviders={selectedProviders}
            onProviderChange={setSelectedProviders}
            className="min-w-[200px] flex-1"
          />
          <TagSelector
            tags={tags}
            selectedTags={selectedTags}
            onTagChange={setSelectedTags}
            className="min-w-[200px] flex-1"
          />
          <DateRangeSelector
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start: string, end: string) => {
              setStartDateState(start);
              setEndDateState(end);
            }}
            className="min-w-[200px] flex-1"
          />
        </div>

        {/* Graphs Grid */}
        <div className="mb-10 grid w-full grid-cols-1 gap-5 md:grid-cols-2">
          {/* Number of calls */}
          <div className="flex w-full flex-col gap-4">
            <p className="text-2xl font-semibold">Number of calls</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[450px] w-full rounded-md bg-background p-4 shadow-md" />
            ) : (
              <div className="tutorial-calls-plot h-fit w-full items-center rounded-md bg-background p-4 shadow-md">
                {metricsData && <CallsPlot data={metricsData.calls} />}
              </div>
            )}
          </div>
          {/* Tokens breakdown */}
          <div className="flex w-full flex-col gap-4">
            <p className="text-2xl font-semibold">Tokens breakdown</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[450px] w-full rounded-md bg-background p-4 shadow-md" />
            ) : (
              <div className="tutorial-tokens-plot h-fit w-full rounded-md bg-background p-4 shadow-md">
                {metricsData && <TokensBreakdownPlot data={metricsData.tokens} />}
              </div>
            )}
          </div>
          {/* Latency */}
          <div className="flex w-full flex-col gap-4">
            <p className="text-2xl font-semibold">Latency</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[450px] w-full rounded-md bg-background p-4 shadow-md" />
            ) : (
              <div className="tutorial-latency-plot h-fit w-full rounded-md bg-background p-4 shadow-md">
                {metricsData && <LatencyPlot data={metricsData.latency} />}
              </div>
            )}
          </div>
          {/* Throughput */}
          <div className="flex w-full flex-col gap-4">
            <p className="text-2xl font-semibold">Throughput</p>
            {isMetricsLoading ? (
              <Skeleton className="h-[450px] w-full rounded-md bg-background p-4 shadow-md" />
            ) : (
              <div className="tutorial-throughput-plot h-fit w-full rounded-md bg-background p-4 shadow-md">
                {metricsData && <ThroughputPlot data={metricsData.throughput} />}
              </div>
            )}
          </div>
        </div>

        {/* Query History Table */}
        <div className="mb-10 w-full">
          <h2 className="mb-4 text-2xl font-semibold">Query History</h2>
          {isQueryLoading && !allQueries.length ? (
            <Skeleton className="h-[600px] w-full rounded-md bg-background p-4 shadow-md" />
          ) : (
            <ScrollArea className="h-[600px] w-full overflow-auto rounded-md bg-background p-4 shadow-md">
              <QueryHistoryTable queries={allQueries} />
              {/* Sentinel element: loads more when visible */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="flex h-10 items-center justify-center">
                  {isFetchingNextPage ? (
                    <Loader2 className="animate-spin text-primary" />
                  ) : (
                    'Load more'
                  )}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
