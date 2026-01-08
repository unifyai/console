import { Suspense } from 'react';
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import LogsPlot from '../../Blocks/Plot/Plot';
import { buildPlotDataItem } from '@/utils/data/buildPlotDataItem';

import type {
  LogsActions,
  FieldsActions,
  TileData,
  GranularTileActions,
  ProjectsActions,
  ContextActions,
} from '@/types/interfaces/grid';
import { PlotArguments, LogFieldsResponseProps } from '@/types/interfaces/logs';

type PlotWrapperActions = {
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
};

export default async function PlotWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions,
}: {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: PlotWrapperActions;
}) {
  console.log('[PlotWrapper] Rendering...');
  const qc = getQueryClient();
  const tileId = tile.id || '';

  // Fetch all tiles for this tab
  if (tabId) {
    await qc.prefetchQuery({
      queryKey: ['tiles', tabId],
      queryFn: () => actions.tileActions.list(tabId, undefined, false),
    });
  }

  const allTiles = qc.getQueryData<TileData[]>(['tiles', tabId]) || [];

  // Filter to get just the table tiles
  const tableTiles = allTiles.filter((t) => t.type === 'Table');

  // Get pre-built plotArguments from cache - all processing is done in TabWrapper
  const plotArguments = qc.getQueryData<PlotArguments>(['plotArguments', tabId]) || {};

  // Get fields
  const fields: LogFieldsResponseProps[] = await Promise.all(
    tableTiles.map((tile) => actions.fieldsActions.get(projectId, tile.context ?? null))
  );

  // Build plot data item
  const plotDataItem = await buildPlotDataItem(
    tile,
    tableTiles,
    plotArguments,
    fields,
    projectId,
    actions.logsActions
  );

  // Prefetch the plot data item
  await qc.prefetchQuery({
    queryKey: ['plotDataItem', tileId],
    queryFn: () => Promise.resolve(plotDataItem),
  });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <SkeletonLoader />
          </div>
        }
      >
        <LogsPlot
          tileId={tileId}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          tileActions={actions.tileActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          projectsActions={actions.projectsActions}
          contextActions={actions.contextActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
