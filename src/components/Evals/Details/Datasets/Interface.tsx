"use client";

import SinglePaneBody from "@/components/Common/Body/SinglePaneBody";
import FileDirectory from "@/components/Directory/FileDirectory";
import { FileProps, ResponseProps } from "@/types/common";
import { DatasetProps } from "@/types/evals/datasets";
import { useEffect, useState } from "react";
import DatasetsTable from "./Table";
import { useQueryState } from "nuqs";
import RenameDialog from "@/components/Common/Dialogs/Rename";
import path from "path";
import DeleteDialog from "@/components/Common/Dialogs/Delete";

const Interface = ({ project, filteredDatasets, datasetEntries, renameDataset, deleteDataset }: {
    project: string | undefined,
    filteredDatasets: FileProps[],
    datasetEntries: { [key: string]: DatasetProps[] },
    renameDataset: (oldName: string, newName: string) => Promise<ResponseProps>,
    deleteDataset: (name: string) => Promise<ResponseProps>
}) => {
    // get selected dataset from the url
    const [selectedDatasetStr, setSelectedDatasetStr] = useQueryState("dataset");
    const selectedDataset = filteredDatasets.find((dataset) => dataset.path === selectedDatasetStr);
    const setSelectedDataset = (dataset: FileProps | undefined) => {
        if (dataset)
            setSelectedDatasetStr(dataset.path);
        else
            setSelectedDatasetStr(null);
    }

    const [projectQuery,] = useQueryState("project");
    const [pending, setPending] = useState(false);

    // set pending when project changes
    useEffect(() => {
        if (project == projectQuery)
            setPending(false);
        else
            setPending(true);
    }, [project, projectQuery]);

    // check for validity of dataset and get dataset items
    const validDataset = selectedDataset && selectedDataset.path in datasetEntries;
    const datasetItems: { [key: string]: string }[] = (
        validDataset
            ? datasetEntries[selectedDataset.path]?.map(data => data.entry)
            : [{ "Entries": "Select a dataset to display the contents." }]
    );

    return (
        <SinglePaneBody
            isPending={pending}
            body={
                <>
                    <div className="flex flex-row justify-between">
                        <div className="flex flex-row gap-2 items-center w-full mb-4">
                            <FileDirectory
                                type="Datasets"
                                data={filteredDatasets}
                                setterFunction={setSelectedDataset}
                                renamingFunction={renameDataset}
                                defaultValue={selectedDatasetStr || undefined}
                            />
                            {validDataset && <>
                                <RenameDialog
                                    type="dataset"
                                    renamingFunction={renameDataset}
                                    fileDir={path.dirname(selectedDataset.path)}
                                    fileName={path.basename(selectedDataset.path)}
                                    path={selectedDataset.path}
                                    paths={filteredDatasets.map((entry) => entry.path)}
                                />
                                <DeleteDialog resource={selectedDataset.path} type="dataset" deletingFunction={deleteDataset} />
                            </>}
                        </div>
                    </div>
                    <DatasetsTable items={datasetItems} />
                </>
            }
        />
    );
};

export default Interface;
