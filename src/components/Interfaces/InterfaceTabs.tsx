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
import { useTile } from "@/contexts/hooks/useTile";

const InterfaceTabs = ({
    interfaceId,
    tabQueryParam,
    newCounter,
    setTabQueryParam,
    tabActions,
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

    // Interface states and actions
    const { interface: interfaceData, actions: interfaceStateActions, exists: interfaceExists } = useInterface(interfaceId);

    if (!interfaceExists) return null;

    const tabIds = Object.keys(interfaceData?.tabs || {});
    const setTabs = interfaceStateActions?.setTabs!;

    // Tab states and actions
    const { tab: tabData, actions: tabStateActions } = useTab(tabQueryParam || "");
    const context = tabData?.context!;
    const tiles = tabData?.tiles!;

    // Convert the tiles to TileProps format for backward compatibility
    const items = !tiles ? defaultItems : Object.values(tiles).map(tile => {
        // Get the tile using the useTile hook to access the asTileItem method
            const { actions } = useTile(tile.id, tabQueryParam || null);
            if (!actions) return null;

        // Convert the tile to a TileProps object
        return actions.asTileItem();
    }).filter(Boolean) as TileProps[];

    useEffect(() => {
        setTabQueryParamState(tabQueryParam || "");
    }, [tabQueryParam]);

    return (
        <div className="flex gap-4 px-4">
            {tabIds.length > 0 && <TabsList className="rounded-md justify-between">
                <div className="flex flex-row gap-3">
                    {tabIds.map((tab_, idx) => <TabsTrigger
                        key={idx}
                        value={tab_}
                        className="relative flex flex-row gap-2 data-[state=active]:text-accent"
                        onMouseEnter={() => setHoveredTab(tab_)}
                        onMouseLeave={() => setHoveredTab(undefined)}
                    >
                        {tabQueryParam == tab_ ? <Input
                            value={tabQueryParamState}
                            disabled={tabData?.pending || tabData?.dataPending}
                            onInput={(event: React.ChangeEvent<HTMLInputElement>) => setTabQueryParamState(event.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && tab_ != tabQueryParamState && !tabIds.includes(tabQueryParamState)) {
                                    tabActions.update(
                                        tab_, project as string, context, items, newCounter, tabQueryParamState, true
                                    ).then(() => {
                                        tabActions.update(
                                            tab_, project as string, context, items, newCounter, tabQueryParamState, false
                                        ).then(() => {
                                            tabStateActions?.setPending(true);
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
                            onMouseEnter={() => tabQueryParam != tab_ && tabStateActions?.setDeleting(true)}
                            onMouseLeave={() => tabQueryParam != tab_ && tabStateActions?.setDeleting(false)}
                            onClick={() => {
                                tabActions.delete(tab_, project as string, true).then(() => {
                                    if (tabQueryParam == tab_)
                                        tabStateActions?.setPending(true);
                                    tabActions.delete(tab_, project as string, true).then(() => {
                                        setTabs(tabIds.filter(i => i != tab_));
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
                    disabled={tabData?.pending}
                    onClick={() => {
                        let initialIndex = tabIds.length + 1;
                        while (tabIds.includes(`tab${initialIndex}`))
                            initialIndex++;
                        const newTabName = `tab${initialIndex}`;
                        tabActions.create(
                            newTabName, project as string, context, defaultItems, defaultNewCounter, true
                        ).then(() => {
                            tabActions.create(
                                newTabName, project as string, context, defaultItems, defaultNewCounter, false
                            ).then(() => {
                                setTabs([...tabIds, newTabName]);
                                tabStateActions?.setPending(true);
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
