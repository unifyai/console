import { DatasetProps } from "@/types/evals/datasets";
import Interface from "./Interface";
import { ResponseProps } from "@/types/common";

const Datasets = async ({ project, datasetsActions }: {
    project: string | undefined,
    datasetsActions: {
		getEntries: (project: string) => Promise<DatasetProps[]>
		get: () => Promise<{ name: string }[]>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>,
	}
}) => {
    // fetch the datasets
    const datasets: string[] = await datasetsActions.get().then(
        datasets => datasets.map((dataset: { name: string }) => dataset.name)
    );
    const filteredDatasets = (
        project
        ? datasets.filter(
            dataset => dataset.startsWith(`${project}/`)
        ) : datasets
    );

    // get the dataset entries
    const datasetEntries = Object.fromEntries((await Promise.all(
        await Promise.all(filteredDatasets.map(dataset => {
            return datasetsActions.getEntries(dataset);
        }))
    )).map((entries, idx) => [filteredDatasets[idx], entries]));

    return (
        <Interface
            project={project}
            filteredDatasets={filteredDatasets.map(dataset => ({type: "file", path: dataset}))}
            datasetEntries={datasetEntries}
            renameDataset={datasetsActions.rename}
            deleteDataset={datasetsActions.delete}
        />
    );
};

export default Datasets;
