import { Trash } from "lucide-react";

import { Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { Input } from "../UI/input";
import { SetStateAction, useEffect, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { TableDataProps, TileProps } from "@/types/evals/grid";
import { InterfaceActions } from "@/types/evals/grid";
import { defaultItems, defaultNewCounter } from "@/constants/logs";


const InterfaceTabs = ({
    interface_,
    interfaces,
    project,
    context,
    items,
    newCounter,
    tableData,
    pending,
    dataPending,
    interfaceActions,
    setInterface,
    setInterfaces,
    setPending,
    setTilePending,
}: {
    interface_: string | null,
    interfaces: string[],
    project: string,
    context: string | undefined,
    items: TileProps[],
    newCounter: number,
    tableData: TableDataProps,
    pending: boolean,
    dataPending: boolean,
    interfaceActions: InterfaceActions,
    setInterface: (value: string | null) => void,
    setInterfaces: (value: SetStateAction<string[]>) => void,
    setPending: (value: SetStateAction<boolean>) => void,
    setTilePending: (value: SetStateAction<{ [key: string]: boolean }>) => void
}) => {
    const [interface_2, setInterface_2] = useState(interface_ || "");

    useEffect(() => {
        setInterface_2(interface_ || "");
    }, [interface_]);

    return (
        <div className="flex gap-4 px-4">
            {interfaces.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {interfaces.map((int_, idx) => <TabsTrigger
                        key={idx}
                        value={int_}
                        className="flex flex-row gap-2 data-[state=active]:text-accent"
                    >
                        {interface_ == int_ ? <Input
                            value={interface_2}
                            disabled={pending || dataPending}
                            onInput={(event: React.ChangeEvent<HTMLInputElement>) => setInterface_2(event.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && int_ != interface_2 && !interfaces.includes(interface_2)) {
                                    interfaceActions.update(
                                        int_, project, context, items, newCounter, interface_2, true
                                    ).then(() => {
                                        interfaceActions.update(
                                            int_, project, context, items, newCounter, interface_2, false
                                        ).then(() => {
                                            setPending(true);
                                            setInterface(interface_2);
                                        });
                                    });
                                }
                            }}
                            className="px-0 h-5 w-20 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                        /> : <div className="h-5 w-20 text-center">{int_}</div>}
                    </TabsTrigger>)}
                </div>
            </TabsList>}
            <div className="flex gap-2">
                <ActionButton
                    variant="outline"
                    icon={<Plus />}
                    tooltip={"Add new interface"}
                    disabled={pending}
                    onClick={() => {
                        let initialIndex = interfaces.length + 1;
                        while (interfaces.includes(`interface_${initialIndex}`))
                            initialIndex++;
                        const newInterfaceName = `interface_${initialIndex}`;
                        interfaceActions.create(
                            newInterfaceName, project, context, defaultItems, defaultNewCounter, true
                        ).then(() => {
                            interfaceActions.create(
                                newInterfaceName, project, context, defaultItems, defaultNewCounter, false
                            ).then(() => {
                                setInterfaces([...interfaces, newInterfaceName]);
                                setTilePending(Object.fromEntries(Object.keys(tableData).map(k => [k, true])));
                                setInterface(newInterfaceName);
                                setInterface_2(newInterfaceName);
                            });
                        })
                    }}
                />
                <ActionButton
                    variant="outline"
                    icon={<Trash />}
                    tooltip={interfaces.length <= 1 ? "Projects need to have at least one interface" : "Delete current active interface"}
                    disabled={pending || interfaces.length <= 1}
                    onClick={() => {
                        interfaceActions.delete(interface_ as string, project, true).then(() => {
                            setPending(true);
                            interfaceActions.delete(interface_ as string, project, true).then(() => {
                                setInterfaces(interfaces.filter(i => i != interface_));
                                setInterface(null);
                                setInterface_2("");
                            })
                        })
                    }}
                />
            </div>
        </div>
    )
};

export default InterfaceTabs;