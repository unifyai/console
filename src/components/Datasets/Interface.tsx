"use client";

import React, { Suspense, useState } from "react";
import FileDirectory from "@/components/Tree/Directory/FileDirectory";
import { FileProps, ResponseProps } from "@/types/common";
import { DatasetProps } from "@/types/datasets";
import DatasetsTable from "./Table";
import { useQueryState } from "nuqs";
import path from "path";
import RenameDialog from "@/components/Common/Dialogs/Rename";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { Input } from "@/components/UI/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Button } from "@/components/UI/button";

const Interface = ({
  datasets,
  datasetEntries,
  renameDataset,
  deleteDataset,
}: {
  datasets: FileProps[];
  datasetEntries: { [key: string]: DatasetProps[] };
  renameDataset: (oldName: string, newName: string) => Promise<ResponseProps>;
  deleteDataset: (name: string) => Promise<ResponseProps>;
}) => {
  // Get selected dataset from the URL
  const [selectedDatasetStr, setSelectedDatasetStr] = useQueryState("dataset");
  const selectedDataset = datasets.find(
    (dataset) => dataset.path === selectedDatasetStr
  );
  const setSelectedDataset = (dataset: FileProps | undefined) => {
    if (dataset) setSelectedDatasetStr(dataset.path);
    else setSelectedDatasetStr(null);
  };

  const [pending, setPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check for validity of dataset and get dataset items
  const validDataset =
    selectedDataset && selectedDataset.path in datasetEntries;
  const datasetItems: { [key: string]: string }[] = validDataset
    ? datasetEntries[selectedDataset.path]?.map((data) => data.entry)
    : [
        {
          Entries: "Select a dataset to display the contents.",
        },
      ];

  return (
    <>
      <div className="flex flex-row justify-between items-center mb-4">
        <div className="flex flex-row gap-2 items-center w-full">
          <FileDirectory
            type="Datasets"
            data={datasets}
            setterFunction={setSelectedDataset}
            renamingFunction={renameDataset}
            defaultValue={selectedDatasetStr || undefined}
          />
          {validDataset && (
            <>
              <RenameDialog
                type="dataset"
                renamingFunction={renameDataset}
                fileDir={path.dirname(selectedDataset.path)}
                fileName={path.basename(selectedDataset.path)}
                path={selectedDataset.path}
                paths={datasets.map((entry) => entry.path)}
              />
              <DeleteDialog
                resource={selectedDataset.path}
                type="dataset"
                deletingFunction={deleteDataset}
              />
              {/* Search Bar */}
              <div className="ml-auto flex items-center">
                <Button variant="ghost" size="icon">
                  <Search className="w-4 h-4" />
                </Button>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="max-w-xs"
                />
              </div>
            </>
          )}
        </div>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <DatasetsTable items={datasetItems} searchQuery={searchQuery} />
      </Suspense>
    </>
  );
};

export default Interface;