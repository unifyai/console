"use client";

import { useState, useMemo, ReactNode } from "react";
import CustomKeysTable from "./Table";
import FileDirectory from "../../Shared/Tree/Directory/FileDirectory";
import { FileProps } from "@/types/common";
import { ResponseProps } from "@/types/common";
import SinglePaneBody from "../../Common/Body/SinglePaneBody";
import * as path from "path";
import CreateKey from "./Create";
import UnifyKey from "./UserAPIKeyPanel/APIKeyPanel";

const Main = ({ apiKey, onPrem, providers, customKeys, customKeyActions }: {
    apiKey: string,
    onPrem: string | undefined,
    providers: string[],
    customKeys: FileProps[],
    customKeyActions: {
        delete: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>,
        create: (name: string, value: string) => Promise<ResponseProps>
    },
}) => {

    // Handle endpoint selection through file directory component
    const [selectedKey, setSelectedKey] = useState<FileProps | undefined>();
    const supportedProviderKeys   = useMemo(() => customKeys.filter(key =>  providers.includes(path.basename(key.path))) ?? [], [providers, customKeys]);
    const unsupportedProviderKeys = useMemo(() => customKeys.filter(key => !providers.includes(path.basename(key.path))) ?? [], [providers, customKeys]);

    const section = (title: string, description: string, form: ReactNode, content: ReactNode) =>
        <div className={`flex flex-col gap-10 w-full tutorial-${title.split(" ").join("-").toLowerCase()}`}>
            <div className="flex flex-col gap-1 w-full">
                <div className="flex flex-row justify-between items-center gap-10">
                    <h1 className="text-xl font-semibold">{title}</h1>
                    {form}
                </div>
                <p>{description}</p>
            </div>
            <div className="flex flex-col md:flex-row gap-5 w-full pb-5">
                {content}
            </div>
        </div>

    return (
        <SinglePaneBody
            isPending={false}
            body={
                <div className="text-lg font-normal flex flex-col gap-10 p-5 w-full h-full">
                    <div className="flex flex-col gap-5 w-full">
                        <h1 className="text-4xl font-bold">API Keys</h1>
                        <p>Manage your API keys.</p>
                    </div>
                    {section(
                        "Unify Key",
                        "Your Unify API key is available below. You can generate a new key if needed to overwrite your current key.",
                        null,
                        <UnifyKey initialApiKey={apiKey} onPrem={onPrem} />
                    )}
                    {section(
                        "Provider Keys",
                        "Query supported endpoints directly with your personal provider keys.",
                        <CreateKey creationFunction={customKeyActions.create} choices={providers} paths={supportedProviderKeys.map(key => key.path)} />,
                        <CustomKeysTable customKeyActions={customKeyActions} customKeys={supportedProviderKeys} />
                    )}
                    {section(
                        "Custom Keys",
                        "Query your custom endpoints using custom API keys",
                        <CreateKey creationFunction={customKeyActions.create} choices={providers} paths={unsupportedProviderKeys.map(key => key.path)} />,
                        <div className="flex flex-col gap-5 w-full pb-5">
                            <FileDirectory
                                type="Keys"
                                data={unsupportedProviderKeys}
                                setterFunction={setSelectedKey}
                                renamingFunction={customKeyActions.rename}
                            />
                            <CustomKeysTable
                                customKeyActions={customKeyActions}
                                customKeys={selectedKey ? [selectedKey] : unsupportedProviderKeys ? unsupportedProviderKeys : []}
                            />
                        </div>
                    )}
                </div>
            }
        />
    );
};

export default Main;
