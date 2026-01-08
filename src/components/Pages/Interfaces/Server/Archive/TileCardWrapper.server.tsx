import { Suspense } from 'react';
import TileCard from '../../Tile/TileCard';
import TileWrapper from './TileWrapper.server';
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  CodeActions,
  FileActions,
  GranularTileActions,
  TileData,
  ProjectsActions,
  GranularTabActions,
} from '@/types/interfaces/grid';

type TileCardWrapperActions = {
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
  tileActions: GranularTileActions;
  tabActions: GranularTabActions;
  projectsActions: ProjectsActions;
};

export default async function TileCardWrapper({
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
  actions: TileCardWrapperActions;
}) {
  console.log('[TileCardWrapper] Rendering...');
  const qc = getQueryClient();

  return (
    <>
      <HydrationBoundary state={dehydrate(qc)}>
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <SkeletonLoader />
            </div>
          }
        >
          <TileCard
            tileId={tile.id || ''}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            tileActions={actions.tileActions}
            tabActions={actions.tabActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
            derivedEntryActions={actions.derivedEntryActions}
            contextActions={actions.contextActions}
            codeActions={actions.codeActions}
            fileActions={actions.fileActions}
            projectsActions={actions.projectsActions}
          >
            <Suspense fallback={<SkeletonLoader />}>
              <TileWrapper
                tile={tile}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={projectId}
                actions={actions}
              />
            </Suspense>
          </TileCard>
        </Suspense>
      </HydrationBoundary>
    </>
  );
}
