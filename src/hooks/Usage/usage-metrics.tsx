import { useQuery } from '@tanstack/react-query';
import { CallsDataProps, TokensDataProps, LatencyDataProps, ThroughputDataProps } from '@/types/usage';

interface UseUsageMetricsQueryParams {
  start: string;
  end: string;
  models?: string[];
  providers?: string[];
}

interface UsageMetrics {
  calls: CallsDataProps[];
  tokens: TokensDataProps[];
  latency: LatencyDataProps[];
  throughput: ThroughputDataProps[];
}

export const useUsageMetricsQuery = ({
  start,
  end,
  models,
  providers,

}: UseUsageMetricsQueryParams) => {
  return useQuery<UsageMetrics>({
    queryKey: ['usageMetrics', { start, end, models, providers }],
    queryFn: async () => {
      const modelsParam = models?.join(',') || '';
      const providersParam = providers?.join(',') || '';
      
      const response = await fetch(
        `/api/logging/getMetrics?start_time=${start}&end_time=${end}&models=${modelsParam}&providers=${providersParam}`
      );
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      return await response.json();
    },
    staleTime: 300 * 1000, // 5 minutes
    retry: false,
  });
};