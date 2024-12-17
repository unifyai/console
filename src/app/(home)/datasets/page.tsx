import React, { Suspense } from "react";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { getCurrentUser } from "@/lib/user/user";
import Main from "@/components/Datasets/Main";
import {
  getDatasetEntries,
  getDatasets,
  renameDataset,
  deleteDataset
} from "./actions";

const DatasetsPage = async (
  { searchParams }: { searchParams: { dataset?: string } }
) => {
  // Get user and API key
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const apiKey = user.apiKey;

  // Get server actions
  const datasetsActions = {
    getEntries: await getDatasetEntries(apiKey),
    get: await getDatasets(apiKey),
    rename: await renameDataset(apiKey),
    delete: await deleteDataset(apiKey),
  };

  return (
    <Suspense fallback={<SkeletonLoader />}>
      <Main
        datasetsActions={datasetsActions}
      />
    </Suspense>
  );
};

export default DatasetsPage;