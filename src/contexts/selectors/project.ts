import { IStoreState } from '../store';

/**
 * Select all projects from the store
 */
export const selectAllProjects = (state: IStoreState) => {
  return Object.values(state.projectsById || {});
};

/**
 * Select a project by its ID
 */
export const selectProjectById = (state: IStoreState, id: string) => {
  return state.projectsById?.[id] || null;
};

/**
 * Select a project by its name
 */
export const selectProjectByName = (state: IStoreState, name: string) => {
  return Object.values(state.projectsById || {}).find(project => project.name === name) || null;
};
