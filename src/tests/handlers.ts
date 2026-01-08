import { assistantHandlers } from './assistants/mocks/handlers';
import { interfaceHandlers } from './interfaces/mocks/handlers';

// This central handlers file imports and aggregates handlers from all feature-specific mock folders.
// Add new handler arrays to the spread operator below as you create them.
export const handlers = [...assistantHandlers, ...interfaceHandlers];
