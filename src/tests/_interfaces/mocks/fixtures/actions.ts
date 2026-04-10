import { vi } from 'vitest';

// Mock action creators for interface tests
export const mockProjectsActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

export const mockInterfaceActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  checkpoint: vi.fn(),
};

export const mockTabActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  checkpoint: vi.fn(),
};

export const mockTileActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  bulkPatch: vi.fn(),
  checkpoint: vi.fn(),
};

export const mockLogsActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

export const mockFieldsActions = {
  list: vi.fn(),
  get: vi.fn(),
};

export const mockDerivedEntryActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

export const mockContextActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

export const mockCodeActions = {
  get: vi.fn(),
  save: vi.fn(),
};

export const mockFileActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  rename: vi.fn(),
};

export const mockFavouritesActions = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

export const mockResourcesActions = {
  list: vi.fn(),
  get: vi.fn(),
  grant: vi.fn(),
  revoke: vi.fn(),
};
