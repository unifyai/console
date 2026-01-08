'use server';

// get contexts
export const getContexts = async (apiKey: string) => {
  return async (project: string, signal?: AbortSignal) => {
    'use server';

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}`, {
      method: 'GET',
      headers: { apiKey: apiKey },
      signal,
    });
    return await response.json();
  };
};

// create context
export const createContext = async (apiKey: string) => {
  return async (name: string, project: string) => {
    'use server';

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}`, {
      method: 'POST',
      headers: { apiKey: apiKey },
      body: JSON.stringify({ name }),
    });
    return await response.json();
  };
};

// delete context (supports nested names)
export const deleteContext = async (apiKey: string) => {
  return async (project: string, context: string) => {
    'use server';

    const encoded = encodeURIComponent(context);
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}/${encoded}`, {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    });
    return await response.json();
  };
};

// rename context (supports nested names)
export const renameContext = async (apiKey: string) => {
  return async (project: string, currentName: string, newName: string) => {
    'use server';

    const encoded = encodeURIComponent(currentName);
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}/${encoded}`, {
      method: 'PATCH',
      headers: { apiKey: apiKey },
      body: JSON.stringify({ name: newName }),
    });
    return await response.json();
  };
};
