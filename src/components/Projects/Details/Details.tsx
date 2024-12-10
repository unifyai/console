import { Suspense } from "react";
import { Info, Database, ScatterChart } from "lucide-react";
import LogsPlot from "./Plot/Plot";
import Selection from "./Selection/Selection";
import Datasets from "./Datasets/Main";
import { LogProps, LogItemProps } from "@/types/projects/logs";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs"
import { DatasetProps } from "@/types/projects/datasets";
import { ResponseProps } from "@/types/common";

const Details = ({ project, params, logs, datasetsActions }: {
    project: string | undefined,
    params: LogItemProps,
    logs: LogProps[] | undefined,
    datasetsActions: {
		getEntries: (project: string) => Promise<DatasetProps[]>
		get: () => Promise<{ name: string }[]>,
		rename: (name: string, newName: string) => Promise<ResponseProps>,
		delete: (name: string) => Promise<ResponseProps>,
	}
}) => {
    return (
        <Tabs defaultValue="Selection" className="w-full h-full tutorial-details-panel">
            <TabsList className="bg-background rounded-md w-full justify-between py-8 px-4">
                <div className="flex flex-row gap-3">
                    <TabsTrigger 
                    value="Selection"
                    className="flex flex-row gap-2 data-[state=active]:text-accent hover:text-primary"
                    >
                        <Info/>
                        {"Selection"}
                    </TabsTrigger>
                    <TabsTrigger
                    value="Datasets" 
                    className="flex flex-row gap-2 data-[state=active]:text-accent hover:text-primary"
                    >
                        <Database/>
                        {"Datasets"}
                    </TabsTrigger>
                    <TabsTrigger 
                    value="Plot" 
                    className="flex flex-row gap-2 data-[state=active]:text-accent hover:text-primary"
                    >
                        <ScatterChart/>
                        {"Plot"}
                    </TabsTrigger>
                </div>
            </TabsList>
            <TabsContent value="Selection" className="w-full h-[calc(100%-50px)] tutorial-selection-pane">
                <Selection params={params} logs={logs} />
            </TabsContent>
            <TabsContent value="Datasets" className="w-full h-[calc(100%-50px)] tutorial-datasets-pane">
                <Suspense fallback={<SkeletonLoader />}>
                    <Datasets project={project} datasetsActions={datasetsActions} />
                </Suspense>
            </TabsContent>
            <TabsContent value="Plot" className="w-full h-[calc(100%-50px)] tutorial-plot-pane">
                <LogsPlot logs={logs} />
            </TabsContent>
        </Tabs>
    );
};

export default Details;
