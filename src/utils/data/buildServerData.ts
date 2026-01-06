import { Context, ContextActions, FieldsActions, ProjectsActions, TileData } from "@/types/interfaces/grid";
import { LogFieldsResponseProps } from "@/types/interfaces/logs";
import { QueryClient } from "@tanstack/react-query";
import { dedupedJson } from "@/lib/requestDeduper";

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

/*
* Builds the projects and contexts for a tab
* either from the cache or from the server based
* on the fetchProjects and fetchContexts flags
*/
export async function fetchOrBuildProjectsAndContexts(
  queryClient: QueryClient,
  projectId: string,
  refetchProjects: boolean,
  refetchContexts: boolean,
  signal?: AbortSignal,
) {
    let projects: string[] = [];
    let contexts: Context[] = [];

    if (refetchProjects) {
        const tProjects = performance.now();
        await queryClient.fetchQuery({
            queryKey: ["projects"],
            queryFn: async ({ signal }) => {
              // Call API route directly instead of server action
              const res = await fetch('/api/projects', {
                method: 'GET',
                signal: signal as AbortSignal,
                cache: 'no-store',
              });
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: `Projects ${res.status}` }));
                throw new Error(errorData.detail || `Failed to fetch projects: ${res.status}`);
              }
              return res.json();
            },
        });
        perfLog(
          `[perf] fetchOrBuildProjectsAndContexts – fetchProjects: ${(
            performance.now() - tProjects
          ).toFixed(2)} ms`
        );
    } 

    if (refetchContexts) {
        const tContexts = performance.now();
        await queryClient.fetchQuery({
            queryKey: ["contexts", projectId],
            queryFn: async ({ signal: querySignal }) => {
              // Call API route directly instead of server action
              const res = await fetch(`/api/context/${encodeURIComponent(projectId)}`, {
                method: 'GET',
                signal: signal || querySignal as AbortSignal,
                cache: 'no-store',
              });
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: `Contexts ${res.status}` }));
                throw new Error(errorData.detail || `Failed to fetch contexts: ${res.status}`);
              }
              return res.json();
            },
        });
        perfLog(
          `[perf] fetchOrBuildProjectsAndContexts – fetchContexts: ${(
            performance.now() - tContexts
          ).toFixed(2)} ms`
        );
    }

    const tProjects = performance.now();
    projects = queryClient.getQueryData<string[]>(["projects"]) || [];
    perfLog(
      `[perf] fetchOrBuildProjectsAndContexts – getProjects: ${(
        performance.now() - tProjects
      ).toFixed(2)} ms`
    );
    const tContexts = performance.now();
    contexts = queryClient.getQueryData<Context[]>(["contexts", projectId]) || [];
    perfLog(
      `[perf] fetchOrBuildProjectsAndContexts – getContexts: ${(
        performance.now() - tContexts
      ).toFixed(2)} ms`
    );
    return {
        projects: projects,
        contexts: contexts,
    };
}

/*
* Builds the fields for all table tiles in a tab
* either from the cache or from the server based
* on the fetchFields flag
*/
export async function fetchOrBuildFields(
  queryClient: QueryClient,
  tiles: TileData[],
  projectId: string,
  refetchFields: boolean,
  signal?: AbortSignal,
) {
  if (refetchFields) {
    const tFields = performance.now();
    
    // Deduplicate contexts - multiple tiles may use the same context
    // This prevents multiple parallel fetches for the same context
    const uniqueContexts = Array.from(new Set(tiles.map(tile => tile.context ?? null)));
    
    await Promise.all(
      uniqueContexts.map(async context => {
        const tField = performance.now();
        await queryClient.ensureQueryData({
          queryKey: ["fields", projectId, context],
          queryFn: async () => {
            // Use dedupedJson for request coalescing - if multiple tiles/tabs request 
            // the same context's fields simultaneously, only one fetch is made
            const url = `/api/logs/fields?project_name=${encodeURIComponent(projectId)}${context ? `&context=${encodeURIComponent(context)}` : ''}`;
            const result = await dedupedJson(url, {
              method: 'GET',
              cache: 'no-store',
            });
            
            // Handle 404 gracefully - context doesn't exist, return empty fields
            // This prevents endless retries for deleted contexts
            if (result.status === 404) {
              console.warn(`[fetchOrBuildFields] Context not found: ${context} (404)`);
              return { __contextNotFound: true }; // Return marker for missing context
            }
            
            if (!result.ok) {
              const errorData = result.json || { detail: `Fields ${result.status}` };
              throw new Error(errorData.detail || `Failed to fetch fields: ${result.status}`);
            }
            return result.json;
          },
          staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent re-fetching
        });
        perfLog(
          `[perf] fetchOrBuildFields – fetchField (context: ${context}): ${(
            performance.now() - tField
          ).toFixed(2)} ms`
        );
      })
    );
    perfLog(
      `[perf] fetchOrBuildFields – fetchFields: ${(
        performance.now() - tFields
      ).toFixed(2)} ms`
    );
  }

  return tiles.map(tile =>
    queryClient.getQueryData(["fields", projectId, tile.context ?? null]) as LogFieldsResponseProps
  );
}

/*
* Builds the projects, contexts, and fields for all table tiles in a tab
* either from the cache or from the server based
* on the fetchProjects, fetchContexts, and fetchFields flags
*/
export async function fetchOrBuildProjectsContextsFields(
  queryClient: QueryClient,
  tiles: TileData[],
  projectId: string,
  refetchProjects: boolean,
  refetchContexts: boolean,
  refetchFields: boolean,
  signal?: AbortSignal,
) {
  const tStart = performance.now();
  const { projects, contexts } = await fetchOrBuildProjectsAndContexts(
    queryClient,
    projectId,
    refetchProjects,
    refetchContexts,
    signal
  );
  perfLog(
    `[perf] fetchOrBuildProjectsContextsFields – fetchOrBuildProjectsAndContexts: ${(
      performance.now() - tStart
    ).toFixed(2)} ms`
  );
  const tFields = performance.now();
  const fieldsArray: LogFieldsResponseProps[] = await fetchOrBuildFields(
    queryClient,
    tiles,
    projectId,
    refetchFields,
    signal
  );
  perfLog(
    `[perf] fetchOrBuildProjectsContextsFields – fetchOrBuildFields: ${(
      performance.now() - tFields
    ).toFixed(2)} ms`
  );
  perfLog(
    `[perf] fetchOrBuildProjectsContextsFields – total: ${(
      performance.now() - tStart
    ).toFixed(2)} ms`
  );

  return { projects, contexts, fields: fieldsArray };
}