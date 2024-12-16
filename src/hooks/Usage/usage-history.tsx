import { useInfiniteQuery } from '@tanstack/react-query';
import { QueryResult } from '@/types/usage';
import { QueryKey } from '@tanstack/react-query';

interface UsageHistoryResponse {
  queries: QueryResult[];
  total_pages: number;
}

//Required due to TS constraints
interface UseUsageHistoryQueryData {
  queries: QueryResult[];
  pages: UsageHistoryResponse[];
  total_pages: number;
}

interface UseUsageHistoryQueryParams {
  start: string;
  end: string;
  models?: string[];
  providers?: string[];
  tags?: string[];
  failures?: boolean | 'only';
}

interface Endpoint {
  model: string;
  provider: string;
}

export function useUsageHistoryQuery({
  start,
  end,
  models,
  providers,
  tags,
  failures = false,
}: UseUsageHistoryQueryParams) {
  return useInfiniteQuery<
    UseUsageHistoryQueryData,
    Error,
    UseUsageHistoryQueryData,
    QueryKey,
    number
  >({
    queryKey: ['usageHistory', { start, end, models, providers, tags, failures }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        start_time: start,
        end_time: end,
        page_number: pageParam.toString(),
      });

      const validEndpointsArray: string[] = await fetch('/api/endpoints/list')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        });

      const validEndpoints: Endpoint[] = validEndpointsArray.map(
        (endpointStr: string) => {
          const [model, provider] = endpointStr.split('@');
          return { model, provider };
        }
      );

      if ((models && models.length > 0) || (providers && providers.length > 0)) {
        let validCombinations = validEndpoints;

        if (models && models.length > 0) {
          validCombinations = validCombinations.filter((endpoint) =>
            models.includes(endpoint.model)
          );
        }

        if (providers && providers.length > 0) {
          validCombinations = validCombinations.filter((endpoint) =>
            providers.includes(endpoint.provider)
          );
        }

        const endpointStrings = validCombinations.map(
          (endpoint) => `${endpoint.model}@${endpoint.provider}`
        );

        if (endpointStrings.length > 0) {
          params.append('endpoints', endpointStrings.join(','));
          console.log('validCombinations', endpointStrings);
        }
      }

      if (tags && tags.length > 0) {
        params.append('tags', tags.join(','));
      }
      if (failures === true) {
        params.append('failures', 'true');
      } else if (failures === 'only') {
        params.append('failures', 'only');
      }

      console.log('params', params);
      const response = await fetch(`/api/logging/getQueries?${params}`);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      return{
        queries: data.queries,
        total_pages: data.total_pages,
        pages: [data],
      } as UseUsageHistoryQueryData;
    },

    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      // If lastPage.queries is empty, no more data
      if (lastPage.queries.length === 0) {
        return undefined;
      }
      
      const nextPage = pages.length + 1;

      console.log('next page', nextPage);
      console.log('last page total pages', lastPage.total_pages);
      return nextPage <= lastPage.total_pages ? nextPage : undefined;
    },
    staleTime: 300000,
    retry: false,
  });
}
