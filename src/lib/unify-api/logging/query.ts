import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Retrieves all query tags associated with the current user.
 *
 * @returns A list of query tags.
 */
export async function getQueryTags(apiKey: string) {
  const OrchestraUserClient = await getOrchestraUserClient(apiKey);
  const response = await OrchestraUserClient.get('/tags');
  return response.data;
}

/**
 * Get the queries history, optionally for a given set of tags for a narrowed search.
 *
 * @param apiKey - The API key for authentication.
 * @param tags - Tags to filter for queries that are marked with these tags.
 * @param endpoints - Optionally specify an endpoint, or a list of endpoints to filter for.
 * @param startTime - Timestamp of the earliest query to aggregate. Format is `YYYY-MM-DD hh:mm:ss`.
 * @param endTime - Timestamp of the latest query to aggregate. Format is `YYYY-MM-DD hh:mm:ss`.
 * @param pageNumber - The query history is returned in pages, with up to 20 prompts per page. Increase the page number to see older prompts.
 * @param failures - Indicates whether to include failures in the return (when set as true), or whether to return failures exclusively (when set as 'only').
 * @returns An object containing an array of query objects and the total number of pages.
 */
export async function getQueries(
  apiKey: string,
  tags?: string | string[],
  endpoints?: string | string[],
  startTime?: string,
  endTime?: string,
  pageNumber: number = 1,
  failures: boolean | 'only' = false
) {
  const OrchestraUserClient = await getOrchestraUserClient(apiKey);
  const params = new URLSearchParams();

  if (tags) {
    if (typeof tags === 'string') {
      params.append('tags', tags);
    } else {
      tags.forEach((tag) => params.append('tags', tag));
    }
  }

  if (endpoints) {
    if (typeof endpoints === 'string') {
      params.append('endpoints', endpoints);
    } else {
      endpoints.forEach((endpoint) => params.append('endpoints', endpoint));
    }
  }

  if (startTime) params.append('startTime', startTime);
  if (endTime) params.append('endTime', endTime);
  params.append('pageNumber', pageNumber.toString());

  if (failures === true) {
    params.append('failures', 'true');
  } else if (failures === 'only') {
    params.append('failures', 'only');
  }

  const response = await OrchestraUserClient.get('/queries', { params: params });
  return response.data;
}
