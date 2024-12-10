import { useQuery } from '@tanstack/react-query';
import { QueryResult } from '@/types/usage';

interface UseUsageHistoryQueryParams {
  start: string; // 'YYYY-MM-DD HH:mm:ss'
  end: string;   // 'YYYY-MM-DD HH:mm:ss'
  page?: number;
  models?: string[];
  providers?: string[];
  tags?: string[];
  failures?: boolean | 'only';
}

interface Endpoint {
  model: string;
  provider: string;
}

export const useUsageHistoryQuery = ({
  start,
  end,
  page = 1,
  models,
  providers,
  tags,
  failures = false,
}: UseUsageHistoryQueryParams) => {
  return useQuery<{ queries: QueryResult[], total_pages: number }>({
    queryKey: ['usageHistory', {start, end, page, models, providers, tags, failures }],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_time: start,
        end_time: end,
        page_number: page.toString(),
      });

      const validEndpointsArray = await fetch(`/api/endpoints/list`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      });

      const validEndpoints: Endpoint[] = validEndpointsArray.map((endpointStr: string) => {
        const [model, provider] = endpointStr.split('@');
        return { model, provider };
      });

      if (models && providers) {
        const validCombinations = validEndpoints
          .filter((endpoint: Endpoint) => 
            models.includes(endpoint.model) && providers.includes(endpoint.provider)
          )
          .map((endpoint: Endpoint) => `${endpoint.model}@${endpoint.provider}`);

        if (validCombinations.length > 0) {
          params.append('endpoints', validCombinations.join(','));
        }
      }


      if (tags) params.append('tags', tags.join(','));
      if (failures === true) params.append('failures', 'true');
      else if (failures === 'only') params.append('failures', 'only');

      const response = await fetch(`/api/logging/getQueries?${params}`);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return await response.json();
    },
    staleTime: 300 * 1000, // 5 minutes
    retry: false,
  });
};