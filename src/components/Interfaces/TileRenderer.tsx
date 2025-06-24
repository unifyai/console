"use client";

import React, { lazy, Suspense, useMemo } from "react";
import { useEnsureTileDataBeforeRender } from "@/utils/tileDependencies";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/evals/grid";
import { useTileMeta } from "@/contexts/hooks/tile/useTileMeta";

const Tile = lazy(() => import("@/components/Interfaces/Tile"));

export interface TileRendererProps {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    fileActions: FileActions;
  };
}

/**
 * Dependency-aware tile renderer that manages suspense boundaries
 * and ensures proper rendering order based on tile dependencies
 */
const TileRenderer: React.FC<TileRendererProps> = ({
  tileId,
  tabId,
  interfaceId,
  projectId,
  actions
}) => {

  // Get tile data from Zustand store using the hook
  const { meta, tileExists } = useTileMeta(tileId, tabId);

  // UNIFIED: Use single hook for both building and rendering state
  const { renderState, canRender } = useEnsureTileDataBeforeRender(
    tileId,
    tabId,
    interfaceId,
    projectId,
    actions
  );

  // Check if we should show skeleton based on render readiness
  const shouldShowSkeleton = useMemo(() => {
    // Show skeleton if the tile cannot render (external dependencies or internal data not ready)
    return !canRender;
  }, [canRender]);

  // If tile doesn't exist, render nothing
  if (!tileExists || !meta) {
    return null;
  }
        
  // Render skeleton if data isn't ready
  if (shouldShowSkeleton) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <SkeletonLoader />
        {renderState?.missingDependencies?.length && renderState?.missingDependencies?.length > 0 && (
          <div className="absolute bottom-2 left-2 text-xs text-gray-500">
            <div>Waiting for:</div>
            {renderState?.missingDependencies.map((missing, index) => (
              <div key={index} className="ml-2">• {missing}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Only render the actual tile content when all data is ready
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center">
        <SkeletonLoader />
      </div>
    }>
      <Tile
        tileId={tileId}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        actions={actions}
      />
    </Suspense>
  );
};

export default TileRenderer; 