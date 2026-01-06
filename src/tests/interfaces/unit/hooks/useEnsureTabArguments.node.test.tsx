import React, { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/tests/interfaces/utils/render-with-providers';
import { useEnsureTabArguments } from '@/utils/interfaces/tileDependencies';
import { useQueryClient } from '@tanstack/react-query';
import type {
  GranularTileActions,
  ProjectsActions,
  ContextActions,
  FieldsActions,
  LogsActions,
} from '@/types/interfaces/grid';
import type { TableArguments, PlotArguments } from '@/types/interfaces/logs';
import * as optimisticModule from '@/utils/data/buildServerDataOptimistic';

type EnsureActions = {
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
};

const tabId = 'tab-1';
const projectId = 'project-1';

function CachedArgsTest({ actions, onResult }: { actions: EnsureActions; onResult: (data: any) => void }) {
  const queryClient = useQueryClient();

  // Seed cached arguments before the query runs
  useEffect(() => {
    const tableArgs: TableArguments = { [tabId]: {} as any };
    const plotArgs: PlotArguments = { [tabId]: {} as any };
    queryClient.setQueryData(['tableArguments', tabId], tableArgs);
    queryClient.setQueryData(['plotArguments', tabId], plotArgs);
  }, [queryClient]);

  const query = useEnsureTabArguments(tabId, projectId, actions);

  useEffect(() => {
    if (query.data) {
      onResult(query.data);
    }
  }, [query.data, onResult]);

  return null;
}

function BuildArgsTest({ actions, onResult }: { actions: EnsureActions; onResult: (data: any) => void }) {
  const query = useEnsureTabArguments(tabId, projectId, actions);

  useEffect(() => {
    if (query.data) {
      onResult(query.data);
    }
  }, [query.data, onResult]);

  return null;
}

function BuildArgsErrorTest({ actions, onError }: { actions: EnsureActions; onError: (err: unknown) => void }) {
  const query = useEnsureTabArguments(tabId, projectId, actions);

  useEffect(() => {
    if (query.isError && query.error) {
      onError(query.error);
    }
  }, [query.isError, query.error, onError]);

  return null;
}

describe('useEnsureTabArguments', () => {
  it('returns cached arguments and skips tileActions.list and builders when arguments already exist', async () => {
    const tileActions = {
      list: vi.fn(),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({ projects: [], contexts: [], fieldsArray: [] });

    const updateTabArgumentsSpy = vi
      .spyOn(optimisticModule, 'updateTabArguments')
      .mockResolvedValue({
        tableArguments: {},
        plotArguments: {},
      });

    const onResult = vi.fn();

    render(<CachedArgsTest actions={actions} onResult={onResult} />);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    // When both tableArguments and plotArguments are cached, we should not hit tileActions.list
    expect(tileActions.list).not.toHaveBeenCalled();
    expect(fetchProjectsContextsFieldsSpy).not.toHaveBeenCalled();
    expect(updateTabArgumentsSpy).not.toHaveBeenCalled();
  });

  it('fetches tiles and builds arguments when cache is empty', async () => {
    const tableTile: any = {
      id: 'tile-1',
      name: 'TableTile',
      type: 'Table',
    };

    const tileActions = {
      list: vi.fn(async () => [tableTile]),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const mockFieldsArray: any[] = [{}];
    const tableArgs: TableArguments = { [tabId]: {} as any };
    const plotArgs: PlotArguments = { [tabId]: {} as any };

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: mockFieldsArray,
      });

    const updateTabArgumentsSpy = vi
      .spyOn(optimisticModule, 'updateTabArguments')
      .mockResolvedValue({
        tableArguments: tableArgs,
        plotArguments: plotArgs,
      });

    const onResult = vi.fn();

    render(<BuildArgsTest actions={actions} onResult={onResult} />);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    const result = onResult.mock.calls[0][0] as { tableArguments: TableArguments; plotArguments: PlotArguments };

    // Tiles were fetched and builders were invoked
    expect(tileActions.list).toHaveBeenCalledTimes(1);
    expect(fetchProjectsContextsFieldsSpy).toHaveBeenCalledTimes(1);
    expect(updateTabArgumentsSpy).toHaveBeenCalledTimes(1);

    // Returned arguments match what builders produced
    expect(result.tableArguments).toBe(tableArgs);
    expect(result.plotArguments).toBe(plotArgs);
  });

  it('surfaces errors when updateTabArguments fails', async () => {
    const tableTile: any = {
      id: 'tile-1',
      name: 'TableTile',
      type: 'Table',
    };

    const tileActions = {
      list: vi.fn(async () => [tableTile]),
    } as unknown as GranularTileActions;

    const actions: EnsureActions = {
      tileActions,
      projectsActions: {} as ProjectsActions,
      contextActions: {} as ContextActions,
      fieldsActions: {} as FieldsActions,
      logsActions: {} as LogsActions,
    };

    const mockFieldsArray: any[] = [{}];

    const fetchProjectsContextsFieldsSpy = vi
      .spyOn(optimisticModule, 'fetchProjectsContextsFields')
      .mockResolvedValue({
        projects: [projectId],
        contexts: [],
        fieldsArray: mockFieldsArray,
      });

    const updateError = new Error('updateTabArguments failed');
    const updateTabArgumentsSpy = vi
      .spyOn(optimisticModule, 'updateTabArguments')
      .mockRejectedValue(updateError);

    const onError = vi.fn();

    render(<BuildArgsErrorTest actions={actions} onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const error = onError.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('updateTabArguments failed');

    fetchProjectsContextsFieldsSpy.mockRestore();
    updateTabArgumentsSpy.mockRestore();
  });
});


