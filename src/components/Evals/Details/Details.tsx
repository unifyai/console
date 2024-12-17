import { Suspense } from "react";
import { Eye, Database, ScatterChart } from "lucide-react";
import LogsPlot from "./Plot/Plot";
import Selection from "./Selection/Selection";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs"
import { ResponseProps } from "@/types/common";

const Details = ({ params, logs}: {
    project: string | undefined,
    params: LogItemProps,
    logs: LogProps[] | undefined,
}) => {
    return (
        <Tabs defaultValue="View" className="w-full h-full tutorial-details-panel">
            <TabsList className="bg-background rounded-md w-full justify-between py-8 px-4">
                <div className="flex flex-row gap-3">
                    <TabsTrigger 
                    value="View"
                    className="flex flex-row gap-2 data-[state=active]:text-accent hover:text-primary"
                    >
                        <Eye/>
                        {"View"}
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
            <TabsContent value="View" className="w-full h-[calc(100%-50px)] tutorial-selection-pane">
                <Selection params={params} logs={logs} />
            </TabsContent>
            <TabsContent value="Plot" className="w-full h-[calc(100%-50px)] tutorial-plot-pane">
                <LogsPlot logs={logs} />
            </TabsContent>
        </Tabs>
    );
};

export default Details;
