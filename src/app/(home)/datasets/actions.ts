"use server";

// Fetch all datasets
export const getDatasets = async (apiKey: string) => {
  return async () => {
    "use server";
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/datasets`,
      { method: "GET", headers: { apiKey: apiKey } }
    );
    return await response.json();
  };
};

// Fetch entries of a specific dataset
export const getDatasetEntries = async (apiKey: string) => {
  return async (dataset: string) => {
    "use server";
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/datasets/${dataset}`,
      { method: "GET", headers: { apiKey: apiKey } }
    );
    return await response.json();
  };
};

// Rename a dataset
export const renameDataset = async (apiKey: string) => {
  return async (oldName: string, newName: string) => {
    "use server";
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/datasets/${oldName}`,
      {
        method: "PATCH",
        headers: { apiKey: apiKey },
        body: JSON.stringify({ name: newName })
      }
    );
    return await response.json();
  };
};

// Delete a dataset
export const deleteDataset = async (apiKey: string) => {
  return async (name: string) => {
    "use server";
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/datasets/${name}`,
      { method: "DELETE", headers: { apiKey: apiKey } }
    );
    return await response.json();
  };
};