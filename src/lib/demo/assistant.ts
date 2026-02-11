/**
 * Server Actions for Demo Assistants
 *
 * Factory functions that return server actions for creating and listing
 * demo assistants.
 */

import { ResponseProps } from '@/types/common';
import {
  DemoAssistant,
  DemoAssistantCreatePayload,
  DemoAssistantMeta,
  DemoContact,
} from '@/types/demo';
import { AssistantSpend } from '@/types/assistants/spending';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { buildAssistantIdFilter } from '@/utils/assistants/filterExpressions';

/**
 * Factory for listDemoAssistants server action.
 *
 * Lists all demo assistants created by the current user.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to list demo assistants
 */
export const listDemoAssistants = async (apiKey: string) => {
  return async (): Promise<DemoAssistant[] | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/demo/assistant`, {
        method: 'GET',
        headers: { apiKey: apiKey },
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts listDemoAssistants] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts listDemoAssistants] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail || `Failed to list demo assistants: ${response.statusText}`;
        return { detail: errorMessage };
      }

      if ('info' in data) {
        return data.info as DemoAssistant[];
      }
      return data as DemoAssistant[];
    } catch (error) {
      console.error(`[demo/assistant.ts listDemoAssistants] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for createDemoAssistant server action.
 *
 * Creates a new demo assistant by cloning from a source assistant.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to create a demo assistant
 */
export const createDemoAssistant = async (apiKey: string) => {
  return async (payload: DemoAssistantCreatePayload): Promise<DemoAssistant | ResponseProps> => {
    'use server';

    try {
      const snakePayload = camelToSnakeObject(payload);

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/demo/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apiKey: apiKey,
        },
        body: JSON.stringify(snakePayload),
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts createDemoAssistant] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts createDemoAssistant] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail || `Failed to create demo assistant: ${response.statusText}`;
        return { detail: errorMessage };
      }

      if ('info' in data) {
        return data.info as DemoAssistant;
      }
      return data as DemoAssistant;
    } catch (error) {
      console.error(`[demo/assistant.ts createDemoAssistant] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for getDemoMeta server action.
 *
 * Gets metadata for a demo assistant.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to get demo metadata
 */
export const getDemoMeta = async (apiKey: string) => {
  return async (demoId: number): Promise<DemoAssistantMeta | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/demo/assistant/${demoId}/meta`,
        {
          method: 'GET',
          headers: { apiKey: apiKey },
        }
      );

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts getDemoMeta] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts getDemoMeta] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to get demo metadata: ${response.statusText}`;
        return { detail: errorMessage };
      }

      if ('info' in data) {
        return data.info as DemoAssistantMeta;
      }
      return data as DemoAssistantMeta;
    } catch (error) {
      console.error(`[demo/assistant.ts getDemoMeta] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for listDemoMeta server action.
 *
 * Lists all demo metadata for the current user.
 * Used to get labels for the demo list sidebar.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to list demo metadata
 */
export const listDemoMeta = async (apiKey: string) => {
  return async (): Promise<DemoAssistantMeta[] | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/demo/assistant/meta`, {
        method: 'GET',
        headers: { apiKey: apiKey },
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts listDemoMeta] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts listDemoMeta] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to list demo metadata: ${response.statusText}`;
        return { detail: errorMessage };
      }

      if ('info' in data) {
        return data.info as DemoAssistantMeta[];
      }
      return data as DemoAssistantMeta[];
    } catch (error) {
      console.error(`[demo/assistant.ts listDemoMeta] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Map a log entry to a DemoContact object.
 */
const mapLogToContact = (log: LogProps): DemoContact | null => {
  const { id, entries } = log;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId) || !entries || typeof entries.contactId !== 'number') {
    console.warn('[mapLogToContact] Skipping log with invalid data:', log);
    return null;
  }

  return {
    logId: numericId,
    contactId: entries.contactId,
    firstName: typeof entries.firstName === 'string' ? entries.firstName : undefined,
    surname: typeof entries.surname === 'string' ? entries.surname : undefined,
    emailAddress: typeof entries.emailAddress === 'string' ? entries.emailAddress : undefined,
    phoneNumber: typeof entries.phoneNumber === 'string' ? entries.phoneNumber : undefined,
    whatsappNumber: typeof entries.whatsappNumber === 'string' ? entries.whatsappNumber : undefined,
    description: typeof entries.description === 'string' ? entries.description : undefined,
    isSystem: entries.isSystem === true,
  };
};

/**
 * Factory for getDemoContacts server action.
 *
 * Gets contacts for a demo assistant from the All/Contacts log context.
 * Uses _assistant_id filtering to scope to the specific assistant.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to get demo contacts
 */
export const getDemoContacts = async (apiKey: string) => {
  return async (assistantId: string): Promise<DemoContact[] | ResponseProps> => {
    'use server';

    try {
      const project = 'Assistants';
      // Use All/Contacts context with _assistant_id filter
      const context = 'All/Contacts';

      // Build filter for this specific assistant
      const filter = buildAssistantIdFilter(assistantId);

      const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${project}&context=${context}&filterExpr=${encodeURIComponent(filter)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { apiKey: apiKey },
      });

      if (response.status === 404) {
        // No contacts found is not an error
        return [];
      }

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts getDemoContacts] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts getDemoContacts] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to get contacts: ${response.statusText}`;
        return { detail: errorMessage };
      }

      const logsResponse = data as LogsResponseProps;
      const contacts = (logsResponse.logs as LogProps[])
        .map(mapLogToContact)
        .filter((contact): contact is DemoContact => contact !== null)
        .sort((a, b) => a.contactId - b.contactId);

      return contacts;
    } catch (error) {
      console.error(`[demo/assistant.ts getDemoContacts] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for getDemoSpending server action.
 *
 * Gets spending data for a demo assistant.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to get demo spending
 */
export const getDemoSpending = async (apiKey: string) => {
  return async (assistantId: string): Promise<AssistantSpend | ResponseProps> => {
    'use server';

    // Get current month in YYYY-MM format
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/spending?month=${month}`,
        {
          method: 'GET',
          headers: { apiKey: apiKey },
        }
      );

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts getDemoSpending] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts getDemoSpending] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        // 404 means no spending data yet
        if (response.status === 404) {
          return {
            agentId: assistantId,
            month,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          };
        }
        const errorMessage = data.detail || `Failed to get spending: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return snakeToCamelObject<AssistantSpend>(data);
    } catch (error) {
      console.error(`[demo/assistant.ts getDemoSpending] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for deleteDemoAssistant server action.
 *
 * Deletes a demo assistant by its agent ID.
 * Uses the same endpoint as regular assistants since Orchestra handles both the same way.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to delete a demo assistant
 */
export const deleteDemoAssistant = async (apiKey: string) => {
  return async (assistantId: string): Promise<{ success: boolean } | ResponseProps> => {
    'use server';

    try {
      // Use the existing assistant delete endpoint - works for both demo and regular assistants
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`, {
        method: 'DELETE',
        headers: { apiKey: apiKey },
      });

      if (response.status === 204 || response.status === 200) {
        return { success: true };
      }

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[demo/assistant.ts deleteDemoAssistant] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[demo/assistant.ts deleteDemoAssistant] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail || `Failed to delete demo assistant: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return { success: true };
    } catch (error) {
      console.error(`[demo/assistant.ts deleteDemoAssistant] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};
