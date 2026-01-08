import { Suspense } from 'react';
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import Editor from '../../Blocks/Editor/Editor';

import type {
  CodeActions,
  TileData,
  ProjectsActions,
  ContextActions,
  LogsActions,
  FieldsActions,
  GranularTileActions,
  FileActions,
} from '@/types/interfaces/grid';

type EditorWrapperProps = {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    codeActions: CodeActions;
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    fileActions: FileActions;
  };
};

export default async function EditorWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions,
}: EditorWrapperProps) {
  console.log('[EditorWrapper] Rendering...');
  const qc = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <div className="h-full w-full overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <SkeletonLoader />
            </div>
          }
        >
          <Editor
            tileId={tile.id || ''}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            codeActions={actions.codeActions}
            tileActions={actions.tileActions}
            fileActions={actions.fileActions}
            projectsActions={actions.projectsActions}
            contextActions={actions.contextActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
