import { interfaceHandlers } from './_interfaces/mocks/handlers';

// This central handlers file imports and aggregates handlers from all feature-specific mock folders.
// Add new handler arrays to the spread operator below as you create them.
export const handlers = [...interfaceHandlers];
