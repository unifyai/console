import { ResponseProps } from '@/types/common';
import { LogItemProps, LogsResponseProps } from '@/types/interfaces/logs';

/**
 * Factory for getTasks server action.
 *
 * @param isOrgContext - When true, skip _user_id filtering since org members should see all tasks.
 *                       The API key scopes data to the organization, preventing cross-org leaks.
 *                       In personal workspaces, _user_id filtering prevents same-name user leaks.
 */
export const getTasks = async (apiKey: string, userId: string, _isOrgContext: boolean) => {
  return async (
    assistantId: string | null,
    filterExpression: string | null,
    limit: number | null,
    offset: number | null
  ): Promise<LogsResponseProps | ResponseProps> => {
    'use server';

    try {
      if (!assistantId) {
        return { detail: 'assistantId is required to fetch tasks.' };
      }
      const context = `${userId}/${assistantId}/Tasks`;
      let url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      if (filterExpression) {
        url += `&filterExpr=${encodeURIComponent(filterExpression)}`;
      }
      if (limit !== null) {
        url += `&limit=${limit}`;
      }
      if (offset !== null) {
        url += `&offset=${offset}`;
      }
      const response = await fetch(url, { method: 'GET', headers: { apiKey: apiKey } });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[task.ts getTasks] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(`[task.ts getTasks] Failed to parse JSON response ${parseError}`);
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to get tasks: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return data as LogsResponseProps;
    } catch (error) {
      console.error(`[task.ts getTasks] Error fetching tasks:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

export const updateTask = async (apiKey: string, userId: string) => {
  return async (
    assistantId: string,
    logs: number[],
    entries: LogItemProps
  ): Promise<ResponseProps> => {
    'use server';

    try {
      const context = `${userId}/${assistantId}/Tasks`;
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
        method: 'PUT',
        headers: {
          apiKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logs,
          projectName: 'Assistants',
          context,
          params: {},
          entries: entries,
          overwrite: true,
        }),
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[task.ts updateTask] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(`[task.ts updateTask] Failed to parse JSON response ${parseError}`);
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail || `Failed to update tasks ${logs}: ${response.statusText}`;
        return { detail: errorMessage };
      }

      const successMessage = data.info || `Tasks ${logs} successfully updated.`;
      return { info: successMessage };
    } catch (error) {
      console.error(`[task.ts updateTask] Error updating task ${logs}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};
