'use server';

// write files (one or many)
export const writeFiles = async (adminKey: string, userId: string) => {
  return async (project: string, files: { [filePath: string]: string }) => {
    'use server';

    const results: any[] = [];
    for (const [filename, content] of Object.entries(files)) {
      const res = await fetch(`${process.env.NEXTAUTH_URL}/api/code/file`, {
        method: 'POST',
        headers: { apiKey: adminKey },
        body: JSON.stringify({ userId: userId, projectName: project, filename, content }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Network error');
      }
      results.push(json);
    }
    return results;
  };
};

// list files
export const listFiles = async (adminKey: string, userId: string) => {
  return async (project: string) => {
    'use server';

    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/code/file?userId=${userId}&projectName=${project}&isDirectory=true`,
      {
        method: 'GET',
        headers: { apiKey: adminKey },
      }
    );
    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson.detail || 'Network error');
    }
    return responseJson;
  };
};

// read file
export const readFile = async (adminKey: string, userId: string) => {
  return async (project: string, path: string) => {
    'use server';

    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/code/file?userId=${userId}&projectName=${project}&filename=${encodeURIComponent(path)}&isDirectory=false`,
      {
        method: 'GET',
        headers: { apiKey: adminKey },
      }
    );
    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson.detail || 'Network error');
    }
    return responseJson;
  };
};

// delete file
export const deleteFile = async (adminKey: string, userId: string) => {
  return async (project: string, path: string, isDirectory: boolean = false) => {
    'use server';

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/code/file`, {
      method: 'DELETE',
      headers: { apiKey: adminKey },
      body: JSON.stringify({ userId: userId, projectName: project, filename: path, isDirectory }),
    });
    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson.detail || 'Network error');
    }
    return responseJson;
  };
};

// rename file or directory
export const renameFile = async (adminKey: string, userId: string) => {
  return async (project: string, oldPath: string, newPath: string) => {
    'use server';

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/code/file`, {
      method: 'PUT',
      headers: { apiKey: adminKey },
      body: JSON.stringify({
        userId: userId,
        projectName: project,
        oldFilename: oldPath,
        newFilename: newPath,
      }),
    });
    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson.detail || 'Network error');
    }
    return responseJson;
  };
};
