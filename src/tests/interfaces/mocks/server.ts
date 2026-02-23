import { setupServer } from 'msw/node';
import { interfaceHandlers } from './handlers';

export const server = setupServer(...interfaceHandlers);
