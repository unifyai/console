import React from "react";
import { DatasetProps } from "@/types/datasets";
import Interface from "./Interface";
import { ResponseProps } from "@/types/common";

const Main = async ({ datasetsActions }: {
  datasetsActions: {
    getEntries: (dataset: string) => Promise<DatasetProps[]>;
    get: () => Promise<{ name: string }[]>;
    rename: (name: string, newName: string) => Promise<ResponseProps>;
    delete: (name: string) => Promise<ResponseProps>;
  };
}) => {
  // Fetch the datasets
  const datasets: string[] = await datasetsActions.get().then(
    datasets => datasets.map((dataset: { name: string }) => dataset.name)
  );

  // Get the dataset entries
  const datasetEntries = Object.fromEntries((await Promise.all(
    datasets.map(dataset => datasetsActions.getEntries(dataset))
  )).map((entries, idx) => [datasets[idx], entries]));

  return (
    <div className="text-lg font-normal w-full py-4 px-5">
        <div className="flex flex-col gap-4 mb-5">
          <h1 className="text-4xl font-bold">Datasets</h1>
          <p className="text-lg">View and Inspect Datasets</p>
        </div>
        <Interface
        datasets={datasets.map(dataset => ({ type: "file", path: dataset }))}
        datasetEntries={datasetEntries}
        renameDataset={datasetsActions.rename}
        deleteDataset={datasetsActions.delete}
        />
    </div>
  );
};

export default Main;