"use client";

import { useState } from "react";
import CustomEndpointsTable from "./Table";
import FileDirectory from "../../Shared/Tree/Directory/FileDirectory";
import { FileProps } from "@/types/common";
import { ResponseProps } from "@/types/common";
import SinglePaneBody from "../../Common/Body/SinglePaneBody";
import CreateEndpoint from "./Create";

const Main = ({ customEndpoints, customKeys, customEndpointActions }: { 
    customEndpoints: FileProps[],
    customKeys: FileProps[],
    customEndpointActions: {
        delete: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        create: (name: string, url: string, keyName: string, modelArg?: string) => Promise<ResponseProps>,
    },
 }) => {

    // Handle endpoint selection through file directory component
    const [selectedEndpoint, setSelectedEndpoint] = useState<FileProps | undefined>();

    return (
        <SinglePaneBody
            isPending={false}
            body={
                <div className="text-lg font-normal flex flex-col gap-5 p-3 h-full w-full">
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex flex-row justify-between items-center gap-5">
                            <h1 className="text-4xl font-bold">Custom Endpoints</h1>
                            <CreateEndpoint 
                                creationFunction={customEndpointActions.create}
                                keys={customKeys.map(key => key.path)}
                                paths={customEndpoints.map(endpoint => endpoint.path)}
                                type="custom endpoint"
                            />
                        </div>
                        <p>Deploy your custom LLM endpoints through Unify.</p>
                    </div>
                    <div className="flex flex-col gap-5 w-full pb-5">
                        <FileDirectory
                            type="Endpoints"
                            data={customEndpoints}
                            setterFunction={setSelectedEndpoint}
                            renamingFunction={customEndpointActions.rename}
                        />
                        <CustomEndpointsTable
                            customEndpoints={selectedEndpoint ? [selectedEndpoint] : customEndpoints ? customEndpoints : []}
                            customEndpointActions={customEndpointActions}
                            customKeys={customKeys}
                        />
                    </div>
                </div>
            }
        />
    );
};

export default Main;