import { X } from "lucide-react";
import { Plus } from "lucide-react";
import { TabsList, TabsTrigger } from "../UI/tabs";
import { Input } from "../UI/input";
import { useEffect, useState, useMemo } from "react";
import ActionButton from "../Common/Buttons/Action";
import { TabActions, TileProps } from "@/types/evals/grid";
import { defaultItems, defaultNewCounter } from "@/constants/logs";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useInterface } from "@/contexts/hooks/useInterface";
import { useTab } from "@/contexts/hooks/useTab";

const InterfaceTabs = ({
    interfaceId,
    tabQueryParam,
    newCounter,
    setTabQueryParam,
    tabActions: serverTabActions,
}: {
    interfaceId: string,
    tabQueryParam: string | null,
    newCounter: number,
    setTabQueryParam: (tab: string | null) => void;
    tabActions: TabActions,
}) => {
    const [tabQueryParamState, setTabQueryParamState] = useState(tabQueryParam || "");
    const [hoveredTab, setHoveredTab] = useState<string | undefined>();

    // Global states
    const project = useStoreContext((s) => s.activeProjectId);

    // Interface states and actions with granular access
    const { dataActions: interfaceDataActions } = useInterface(interfaceId);

    const tabNames = interfaceDataActions?.getTabNames() || [];

    // Tab states and actions with granular access
    const { data: tabDataState, ui: tabUIState, uiActions: tabUIActions } = useTab(tabQueryParam || "");
    
    const context = tabDataState?.globalContext!;
    
    // Get tileIds from tab data properly
    const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);

    // Convert the tiles to TileProps format for backward compatibility
    const items = useMemo(() => {
        return !tileIds.length ? defaultItems : tabUIActions?.getItems().filter(Boolean) as TileProps[];
    }, [tileIds.length, tabUIActions]);

    useEffect(() => {
        setTabQueryParamState(tabQueryParam || "");
    }, [tabQueryParam]);

    return (
        <div className="flex gap-4 px-4">
            {tabNames.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {tabNames.map((tab_, idx) => <TabsTrigger
                        key={idx}
                        value={tab_}
                        className="relative flex flex-row gap-2 data-[state=active]:text-accent"
                        onMouseEnter={() => setHoveredTab(tab_)}
                        onMouseLeave={() => setHoveredTab(undefined)}
                    >
                        {tabQueryParam == tab_ ? <Input
                            value={tabQueryParamState}
                            disabled={tabUIState?.pending || tabUIState?.dataPending}
                            onInput={(event: React.ChangeEvent<HTMLInputElement>) => setTabQueryParamState(event.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && tab_ != tabQueryParamState && !tabNames.includes(tabQueryParamState)) {
                                    serverTabActions.update(
                                        tab_, project as string, context, items, newCounter, tabQueryParamState, true
                                    ).then(() => {
                                        serverTabActions.update(
                                            tab_, project as string, context, items, newCounter, tabQueryParamState, false
                                        ).then(() => {
                                            interfaceDataActions?.renameTab(tab_, tabQueryParamState);
                                            tabUIActions?.setPending(true);
                                            setTabQueryParam(tabQueryParamState);
                                        });
                                    });
                                }
                                else if (e.key == "Enter" && tab_ == tabQueryParamState)
                                    setTabQueryParamState(tab_);
                            }}
                            className="px-0 h-5 w-16 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                        /> : <div className="h-5 w-16 text-center">{tab_}</div>}
                        <div
                            className={`z-10 absolute -top-1 -right-1 cursor-pointer mb-auto hover:text-white hover:bg-primary rounded-sm ${hoveredTab == tab_ ? "opacity-100" : "opacity-0"}`}
                            onMouseEnter={() => tabQueryParam != tab_ && tabUIActions?.setDeleting(true)}
                            onMouseLeave={() => tabQueryParam != tab_ && tabUIActions?.setDeleting(false)}
                            onClick={() => {
                                serverTabActions.delete(tab_, project as string, true).then(() => {
                                    if (tabQueryParam == tab_)
                                        tabUIActions?.setPending(true);
                                    serverTabActions.delete(tab_, project as string, true).then(() => {
                                        interfaceDataActions?.removeTab(tab_);
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
                    disabled={tabUIState?.pending}
                    onClick={() => {
                        let initialIndex = tabNames.length + 1;
                        while (tabNames.includes(`tab${initialIndex}`))
                            initialIndex++;
                        const newTabName = `tab${initialIndex}`;
                        serverTabActions.create(
                            newTabName, project as string, context, defaultItems, defaultNewCounter, true
                        ).then(() => {
                            serverTabActions.create(
                                newTabName, project as string, context, defaultItems, defaultNewCounter, false
                            ).then(() => {
                                interfaceDataActions?.addTab(tabQueryParam || "", newTabName);
                                tabUIActions?.setTilesPending(true);
                                setTabQueryParam(newTabName);
                                setTabQueryParamState(newTabName);
                            });
                        })
                    }}
                />
            </div>
        </div>
    )
};

export default InterfaceTabs;
