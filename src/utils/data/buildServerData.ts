import { Context, ContextActions, FieldsActions, ProjectsActions, TileData } from "@/types/interfaces/grid";
import { LogFieldsResponseProps } from "@/types/interfaces/logs";
import { QueryClient } from "@tanstack/react-query";

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
  projectsActions: ProjectsActions,
  contextActions: ContextActions,
  signal?: AbortSignal,
) {
    let projects: string[] = [];
    let contexts: Context[] = [];

    if (refetchProjects) {
        const tProjects = performance.now();
        await queryClient.fetchQuery({
            queryKey: ["projects"],
            queryFn: () => projectsActions.get(),
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
            queryFn: () => (contextActions.get as any)(projectId, signal as AbortSignal),
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
  fieldsActions: FieldsActions,
) {
  if (refetchFields) {
    const tFields = performance.now();
    await Promise.all(
      tiles.map(async tile => {
        const tField = performance.now();
        await queryClient.fetchQuery({
          queryKey: ["fields", projectId, tile.context ?? null],
          queryFn: () => fieldsActions.get(projectId, tile.context ?? null),
        });
        perfLog(
          `[perf] fetchOrBuildFields – fetchField: ${(
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
  projectsActions: ProjectsActions,
  contextActions: ContextActions,
  fieldsActions: FieldsActions,
) {
  const tStart = performance.now();
  const { projects, contexts } = await fetchOrBuildProjectsAndContexts(
    queryClient,
    projectId,
    refetchProjects,
    refetchContexts,
    projectsActions,
    contextActions
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
    fieldsActions
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