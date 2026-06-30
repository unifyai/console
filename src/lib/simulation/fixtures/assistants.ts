/**
 * Assistant fixtures for the `/assistants` shell and default views.
 */

import type { MockAssistant } from '../types';
import { MOCK_ORG_ID, MOCK_USER_ID } from './users';

export const personalCoordinator: MockAssistant = {
  agentId: 1001,
  firstName: 'T-W1N',
  surname: '',
  userId: MOCK_USER_ID,
  organizationId: null,
  isCoordinator: true,
  jobTitle: '',
  bio: 'Routes your work to the right assistant.',
  photoUrl: null,
  status: 'active',
};

export const orgCoordinator: MockAssistant = {
  agentId: 2001,
  firstName: 'T-W1N',
  surname: '',
  userId: MOCK_USER_ID,
  organizationId: MOCK_ORG_ID,
  isCoordinator: true,
  jobTitle: '',
  bio: 'Supports the Acme Labs workspace.',
  photoUrl: null,
  status: 'active',
};

export const personalAssistants: MockAssistant[] = [
  personalCoordinator,
  {
    agentId: 1002,
    firstName: 'Maya',
    surname: 'Rivera',
    userId: MOCK_USER_ID,
    organizationId: null,
    isCoordinator: false,
    jobTitle: 'Research Assistant',
    bio: 'Summarises papers and tracks sources.',
    photoUrl: null,
    status: 'idle',
  },
];

export const orgAssistants: MockAssistant[] = [
  orgCoordinator,
  {
    agentId: 2002,
    firstName: 'Leo',
    surname: 'Park',
    userId: MOCK_USER_ID,
    organizationId: MOCK_ORG_ID,
    isCoordinator: false,
    jobTitle: 'Sales Development Rep',
    bio: 'Qualifies inbound leads over email and SMS.',
    photoUrl: null,
    status: 'active',
  },
  {
    agentId: 2003,
    firstName: 'Nora',
    surname: 'Singh',
    userId: MOCK_USER_ID,
    organizationId: MOCK_ORG_ID,
    isCoordinator: false,
    jobTitle: 'Support Engineer',
    bio: 'Triages tickets and drafts replies.',
    photoUrl: null,
    status: 'idle',
  },
];
