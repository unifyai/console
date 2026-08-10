'use client';

import React from 'react';
import { Pen, Settings, Star, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CreateProject from '../../Blocks/Table/Buttons/CreateProject';
import { ResponseProps } from '@/types/common';
import {
  ProjectsActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  LogsActions,
  ContextActions,
  Favourite,
  FavouritesActions,
} from '@/types/interfaces/grid';
import ActionButton from '../../../../Common/Buttons/Action';
import { useEffect, useState, useMemo } from 'react';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import BaseDropdown from '../../../../Common/Dropdowns/Base';
import { useCommand } from '@/contexts/hooks/commands/useCommand';
import DeleteProjectDialog from './DeleteProject';
import { useListProjectsQuery } from '@/hooks/Interfaces/Query/useProjectsQuery';
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery';
import { FileUpload } from './FileUpload';
import BaseDialog from '../../../../Common/Dialogs/Base';
import { Input } from '../../../../UI/input';
import { Label } from '../../../../UI/label';
import SubmitButton from '../../../../Common/Buttons/Submit';
import SelectionCommand from '@/components/Common/Commands/SelectionCommand';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';
import { isImeComposing } from '@/utils/keyboard';

const ProjectButtons = ({
  tabIdOrName,
  interfaceId,
  projectQueryParam,
  defaultProject,
  setProjectQueryParam,
  setInterfaceQueryParam,
  setTabQueryParam,
  projectActions,
  interfaceActions,
  tabActions,
  tileActions,
  logsActions,
  contextActions,
  favouritesActions,
  initialFavourites,
}: {
  tabIdOrName: string | null;
  interfaceId: string;
  projectQueryParam: string | null;
  defaultProject: boolean;
  setProjectQueryParam: (project: string | null) => void;
  setInterfaceQueryParam: (builtInterface: string | null) => void;
  setTabQueryParam: (tab: string | null) => void;
  projectActions: ProjectsActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  contextActions: ContextActions;
  favouritesActions: FavouritesActions;
  initialFavourites: Favourite[];
}) => {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // State for dialog controls from store
  const createProjectOpen = useStoreContext((s) => s.createProjectOpen);
  const setCreateProjectOpen = useStoreContext((s) => s.setCreateProjectOpen);
  const deleteProjectOpen = useStoreContext((s) => s.deleteProjectOpen);
  const setDeleteProjectOpen = useStoreContext((s) => s.setDeleteProjectOpen);
  const fileUploadOpen = useStoreContext((s) => s.fileUploadOpen);
  const setFileUploadOpen = useStoreContext((s) => s.setFileUploadOpen);

  // Local state for rename dialog
  const [renameProjectOpen, setRenameProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameError, setRenameError] = useState('');

  // Global states
  const project = projectQueryParam;
  const projects = useStoreContext((s) => s.projects);
  const setProjects = useStoreContext((s) => s.setProjects);

  // Use React Query to load projects and contexts
  const listProjectsQuery = useListProjectsQuery(projectActions);
  const listContextsQuery = useListContextsQuery(project || null, contextActions);
  const contexts = useMemo(
    () => (Array.isArray(listContextsQuery.data) ? listContextsQuery.data : []),
    [listContextsQuery.data]
  );

  // Favourites state
  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites);
  const [isFavouriting, setIsFavouriting] = useState(false);

  useEffect(() => {
    setFavourites(initialFavourites);
  }, [initialFavourites]);

  const currentFavourite = useMemo(() => {
    if (!project || !favourites) return null;
    return favourites.find((fav) => fav.projectName === project) || null;
  }, [project, favourites]);

  const handleToggleFavourite = async () => {
    if (!project || isFavouriting) return;

    setIsFavouriting(true);
    try {
      if (currentFavourite) {
        const success = await favouritesActions.delete(currentFavourite.id);
        if (success) {
          setFavourites((prev) => prev.filter((f) => f.id !== currentFavourite.id));
          showSuccessToast('Removed from Favourites');
        } else {
          showErrorToast('Failed to remove from Favourites');
        }
      } else {
        const newPosition = favourites.length;
        const newFavourite = await favouritesActions.create(
          project,
          'layout-dashboard',
          newPosition
        );
        if (newFavourite) {
          setFavourites((prev) => [...prev, newFavourite]);
          showSuccessToast('Added to Favourites');
        } else {
          showErrorToast('Failed to add to Favourites');
        }
      }
    } catch (error) {
      console.error('Error toggling favourite:', error);
      showErrorToast('An error occurred while managing Favourites.');
    } finally {
      setIsFavouriting(false);
    }
  };

  // Initialize command hooks with minimal parameters
  const commandHooks = useCommand({
    projectId: project,
    interfaceId,
    tabId: tabIdOrName,
    setProjectQueryParam,
    setTabQueryParam,
    setInterfaceQueryParam,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    logsActions,
    contextActions,
  });

  const {
    selectProject: selectProjectCommand,
    createProject: createProjectCommand,
    deleteProject: deleteProjectCommand,
    deleteProjectLogs: deleteProjectLogsCommand,
    deleteProjectLogsAndContexts: deleteProjectLogsAndContextsCommand,
  } = commandHooks;

  // Use React Query to load projects
  useEffect(() => {
    if (listProjectsQuery.data) {
      setProjects(listProjectsQuery.data);
    }
  }, [listProjectsQuery.data, setProjects]);

  // Refetch projects when dropdown opens
  const onOpen = () => {
    listProjectsQuery.refetch();
  };

  // Sync dropdown open state with various dialogs
  useEffect(() => {
    if (createProjectOpen || deleteProjectOpen || renameProjectOpen || fileUploadOpen)
      setDropdownOpen(true);
    else setDropdownOpen(false);
  }, [createProjectOpen, deleteProjectOpen, renameProjectOpen, fileUploadOpen]);

  // Handler for renaming project
  const handleRenameProject = async () => {
    if (!project || !newProjectName.trim()) {
      setRenameError('Project name cannot be empty.');
      return;
    }
    if (projects.includes(newProjectName.trim())) {
      setRenameError('A project with this name already exists.');
      return;
    }

    const oldProjectName = project;
    const trimmedNewName = newProjectName.trim();

    try {
      await projectActions.rename(oldProjectName, trimmedNewName);
      // After successful rename, refetch project list and navigate to new project URL
      await listProjectsQuery.refetch();
      setProjectQueryParam(trimmedNewName);
      setRenameProjectOpen(false);
      setNewProjectName('');
      setRenameError('');
    } catch (e) {
      setRenameError('Failed to rename project.');
      console.error(e);
    }
  };

  // Effect to reset rename dialog state
  useEffect(() => {
    if (renameProjectOpen) {
      setNewProjectName(project || '');
      setRenameError('');
    }
  }, [renameProjectOpen, project]);

  return (
    <div className="flex w-fit flex-row items-center gap-2">
      <SelectionCommand
        type="Projects"
        items={projects}
        value={project}
        onSelect={(selectedProject) => {
          if (selectProjectCommand) {
            selectProjectCommand({ path: selectedProject });
          }
        }}
        loading={listProjectsQuery.isLoading}
        onOpenChange={onOpen}
        defaultOpen={defaultProject}
      />
      {project && (
        <ActionButton
          className="bg-background/90 border-border/50 border shadow-md backdrop-blur-sm"
          variant="outline"
          icon={
            isFavouriting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star
                className={`h-4 w-4 ${currentFavourite ? 'fill-[color:var(--favourite)] text-[color:var(--favourite)]' : ''}`}
              />
            )
          }
          tooltip={currentFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
          disabled={isFavouriting}
          onClick={handleToggleFavourite}
        />
      )}
      <BaseDropdown
        context="project"
        button={
          <ActionButton
            className="bg-background/90 border-border/50 border shadow-md backdrop-blur-sm"
            tooltip="Project Settings"
            icon={<Settings />}
            variant="outline"
          />
        }
        className="w-fit min-w-0"
        open={dropdownOpen}
        setOpen={setDropdownOpen}
      >
        <div className="flex w-56 flex-col items-center p-2">
          <div className="w-full border-b pb-1">
            <CreateProject
              creationFunction={async (name: string) => {
                if (!createProjectCommand) {
                  return { detail: 'Create project command not found' };
                }
                const response = await createProjectCommand(name);
                if ('info' in response) return response;
                throw new Error(response.detail);
              }}
              createProjectOpen={createProjectOpen}
              setCreateProjectOpen={setCreateProjectOpen}
              paths={projects}
              text="Create new project"
              variant="ghost"
            />
          </div>
          {project && (
            <>
              <div className="w-full border-b py-1">
                <BaseDialog
                  open={renameProjectOpen}
                  setOpen={setRenameProjectOpen}
                  button={
                    <ActionButton
                      tooltip="Rename current project"
                      text="Rename project"
                      variant="ghost"
                      icon={<Pen className="mr-2 h-4 w-4" />}
                      onClick={() => setRenameProjectOpen(true)}
                      className="w-full justify-start"
                    />
                  }
                  title="Rename Project"
                  body={
                    <div className="space-y-2">
                      <Label htmlFor="project-name">New Project Name</Label>
                      <Input
                        id="project-name"
                        value={newProjectName}
                        onChange={(e) => {
                          setNewProjectName(e.target.value);
                          if (renameError) setRenameError('');
                        }}
                        onKeyDown={(e) =>
                          !isImeComposing(e) && e.key === 'Enter' && handleRenameProject()
                        }
                        placeholder="Enter new project name"
                      />
                      {renameError && (
                        <p className="text-caption text-destructive">{renameError}</p>
                      )}
                    </div>
                  }
                  footer={<SubmitButton onClick={handleRenameProject} text="Rename" />}
                />
              </div>
              <div className="w-full border-b py-1">
                <DeleteProjectDialog
                  project={project}
                  deletingFunctions={{
                    project: deleteProjectCommand,
                    logs: deleteProjectLogsCommand,
                    logsAndContexts: deleteProjectLogsAndContextsCommand,
                  }}
                  showDialog={deleteProjectOpen}
                  setShowDialog={setDeleteProjectOpen}
                  onDelete={(option) => {
                    if (option === 'logs' || option === 'logsAndContexts') {
                      window.location.reload();
                    }
                  }}
                  text="Delete project"
                  className="w-full justify-start"
                />
              </div>
              <div className="w-full pt-1">
                <FileUpload
                  project={project}
                  contexts={contexts}
                  logsActions={logsActions}
                  customOpen={fileUploadOpen}
                  setCustomOpen={setFileUploadOpen}
                  text="Upload logs to project"
                  className="w-full justify-start"
                />
              </div>
            </>
          )}
        </div>
      </BaseDropdown>
    </div>
  );
};

export default ProjectButtons;
