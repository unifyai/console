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
import { signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const DatasetsPage = async (
  { searchParams }: { searchParams: { dataset?: string } }
) => {
  // Get user and API key
  const user = await getCurrentUser();
  if (!user) {
    signOut();
    redirect('/login');
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
    <div className="w-full h-full p-1 overflow-auto">
      <Suspense fallback={<SkeletonLoader />}>
        <Main
          datasetsActions={datasetsActions}
        />
      </Suspense>
    </div>
  );
};

export default DatasetsPage;