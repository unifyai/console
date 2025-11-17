import { describe, it, expect, beforeAll } from 'vitest';
import { faker } from '@faker-js/faker';

import { listAssistants, createAssistant, updateAssistant, deleteAssistant, getAssistantStatus } from '@/lib/assistants/assistant';
import { Assistant } from '@/types/assistants/assistant';

describe('Assistant Server Actions', () => {
  let VITE_TEST_API_KEY: string;

  beforeAll(() => {
    VITE_TEST_API_KEY = process.env.VITE_TEST_API_KEY as string;
    if (!VITE_TEST_API_KEY) {
      throw new Error(
        'VITE_TEST_API_KEY not set. Please add it to your .env or testing environment to run live API tests.'
      );
    }
  });

  it(
    'should fetch a list of assistants with the correct shape when calling listAssistants() ',
    {
      meta: { mock: false },
      timeout: 30000,
    },
    async () => {
      const listAction = await listAssistants(VITE_TEST_API_KEY);
      const result = await listAction();

      expect(Array.isArray(result)).toBe(true);

      if ((result as Assistant[]).length > 0) {
        const firstAssistant = (result as Assistant[])[0];
        expect(firstAssistant).toHaveProperty('agent_id');
        expect(firstAssistant).toHaveProperty('first_name');
        expect(firstAssistant).toHaveProperty('created_at');
      }
    }
  );

  it(
    'should perform a full CRUD cycle: create, get status, update, and delete an assistant',
    {
      meta: { mock: false },
      timeout: 120000, // Allow 2 minutes for the full cycle, including potential infra spin-up
    },
    async () => {
      const createAction = await createAssistant(VITE_TEST_API_KEY);
      const updateAction = await updateAssistant(VITE_TEST_API_KEY);
      const deleteAction = await deleteAssistant(VITE_TEST_API_KEY);
      const getStatusAction = await getAssistantStatus(process.env.ORCHESTRA_ADMIN_KEY!);
      const listAction = await listAssistants(VITE_TEST_API_KEY);

      const testFirstName = 'Test';
      const testLastName = `Assistant-${faker.string.uuid()}`;

      // 1. CREATE
      const createResult = await createAction(
        testFirstName,
        testLastName,
        30,
        'United States',
        'UTC',
        null, null, 'A test assistant for CRUD operations.',
        null,
        null,
        null,
        null, null, null, null, null
      );

      expect(createResult).not.toHaveProperty('detail');
      expect(createResult.assistant).toBeDefined();
      const newAssistant = createResult.assistant!;
      expect(newAssistant.first_name).toBe(testFirstName);
      expect(newAssistant.surname).toBe(testLastName);

      // 2. READ (and get status)
      const statusResult = await getStatusAction(newAssistant.agent_id);
      expect(statusResult).not.toHaveProperty('detail');
      expect(statusResult).toHaveProperty('running');
      expect(statusResult).toHaveProperty('assistant_id', newAssistant.agent_id);
      
      // 3. UPDATE
      const newAboutText = 'This assistant has been updated.';
      const updateResult = await updateAction(newAssistant.agent_id, { about: newAboutText });
      expect(updateResult).not.toHaveProperty('detail');

      // Verify update by re-fetching
      const allAssistants = await listAction();
      const updatedAssistant = (allAssistants as Assistant[]).find(a => a.agent_id === newAssistant.agent_id);
      expect(updatedAssistant).toBeDefined();
      expect(updatedAssistant?.about).toBe(newAboutText);

      // 4. DELETE
      const deleteResult = await deleteAction(newAssistant.agent_id);
      expect(deleteResult).not.toHaveProperty('detail');

      // Verify deletion by re-fetching
      const finalList = await listAction();
      const deletedAssistant = (finalList as Assistant[]).find(a => a.agent_id === newAssistant.agent_id);
      expect(deletedAssistant).toBeUndefined();
    }
  );

});