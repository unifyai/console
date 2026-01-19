// https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr#alternative-use-a-single-queryclient-for-prefetching
import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

// cache() is scoped per request, so we don't leak data between requests
const getQueryClient = cache(() => new QueryClient());
export default getQueryClient;
