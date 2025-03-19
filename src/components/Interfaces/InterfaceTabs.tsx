import { X } from "lucide-react";
import { Plus } from "lucide-react";
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
    setDeleting,
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
    setDeleting: (value: boolean) => void,
    setPending: (value: SetStateAction<boolean>) => void,
    setTilePending: (value: SetStateAction<{ [key: string]: boolean }>) => void
}) => {
    const [interface_2, setInterface_2] = useState(interface_ || "");
    const [hoveredInterface, setHoveredInterface] = useState<string | undefined>();

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
                        className="relative flex flex-row gap-2 data-[state=active]:text-accent border-primary"
                        onMouseEnter={() => setHoveredInterface(int_)}
                        onMouseLeave={() => setHoveredInterface(undefined)}
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
                                else if (e.key == "Enter" && int_ == interface_2)
                                    setInterface_2(int_);
                            }}
                            className="px-0 h-5 w-16 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                        /> : <div className="h-5 w-16 text-center">{int_}</div>}
                        <div
                            className={`z-10 absolute -top-1 -right-1 cursor-pointer mb-auto hover:text-white hover:bg-primary rounded-sm ${hoveredInterface == int_ ? "opacity-100" : "opacity-0"}`}
                            onMouseEnter={() => interface_ != int_ && setDeleting(true)}
                            onMouseLeave={() => interface_ != int_ && setDeleting(false)}
                            onClick={() => {
                                interfaceActions.delete(int_, project, true).then(() => {
                                    if (interface_ == int_)
                                        setPending(true);
                                    interfaceActions.delete(int_, project, true).then(() => {
                                        setInterfaces(interfaces.filter(i => i != int_));
                                    });
                                });
                            }}
                        >
                            <X size={14} />
                        </div>
                    </TabsTrigger>)}
                </div>
            </TabsList>}
            <div className="flex gap-2">
                <ActionButton
                    variant="outline"
                    icon={<Plus />}
                    tooltip={"Add new tab"}
                    disabled={pending}
                    onClick={() => {
                        let initialIndex = interfaces.length + 1;
                        while (interfaces.includes(`tab${initialIndex}`))
                            initialIndex++;
                        const newInterfaceName = `tab${initialIndex}`;
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
            </div>
        </div>
    )
};

export default InterfaceTabs;
