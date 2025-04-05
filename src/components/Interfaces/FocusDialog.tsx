"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { Badge } from "../UI/badge";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, LogsActions, FieldsActions, TileProps, ContextActions, CodeActions } from "@/types/evals/grid";
import { Plus, X } from "lucide-react";
import { icons } from "@/constants/logs";
import TileCard from "./TileCard";
import { useTab } from "@/contexts/hooks/tab";

const FocusDialog = ({
    interfaceId,
    projectId,
    tabId,
    updateTab,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    codeActions,
    setFocusDialog,
}: {
    interfaceId: string;
    projectId: string;
    tabId: string;
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    codeActions: CodeActions,
    updateTab: (savedTab?: any, updatedTileProps?: any) => Promise<ResponseProps>;
    setFocusDialog: Dispatch<SetStateAction<boolean>>,
}) => {
    const { ui: tabUIState, uiActions: tabUIActions, dataActions: tabDataActions } = useTab(tabId, interfaceId);

    // Get tile props using the getItems function from the tabActions
    const tileProps = useMemo(() => {
        return (!tabDataActions) ? [] : tabDataActions.getItems();
    }, [tabDataActions]);

    const safeFocusedTileNames = useMemo(() => 
        tabUIState?.focusedTileNames ? Array.from(tabUIState.focusedTileNames) : [undefined, undefined], 
        [tabUIState?.focusedTileNames]
    );

    const focusedTileItems: [TileProps | undefined, TileProps | undefined] = safeFocusedTileNames.map(
        focusedTileName => {
            const index = tileProps.findIndex(item => item.i === focusedTileName);
            const item = index !== -1 ? tileProps[index] : undefined;
            return index !== -1 ? item : undefined;
        }
    ) as [TileProps | undefined, TileProps | undefined];

    const tiles = focusedTileItems.map((item: TileProps | undefined, idx: number) => {
        const index = tileProps.findIndex(it => it.i === item?.i);
        return (
            item
                ? <div className="h-full relative pt-2">
                    <TileCard
                        index={index}
                        tileId={item.i}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        updateTab={updateTab}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        codeActions={codeActions}
                    />
                    <div className={"w-full px-2 transition-all absolute -top-1 flex justify-between " + (tabUIState?.edit ? "h-20" : "h-10")}>
                        <div>
                            <Badge variant="primary">{item.i}</Badge>
                        </div>
                        <div className="mb-auto">
                            <ActionButton
                                className="remove cursor-pointer hover:z-10"
                                onClick={() => {
                                    const newFocusedTileNames = [...safeFocusedTileNames];
                                    newFocusedTileNames[idx] = undefined;
                                    tabUIActions?.setFocusedTileNames(newFocusedTileNames as [string | undefined, string | undefined]);
                                    if (newFocusedTileNames[0] == undefined && newFocusedTileNames[1] == undefined)
                                        setFocusDialog(false);
                                }}
                                icon={<X />}
                                tooltip="Remove from Focus Pane"
                                variant="outline"
                            />
                        </div>
                    </div>
                </div>
                : <div className="h-full w-full flex justify-center items-center">
                    <div className="w-fit">
                        <BaseDropdown
                            button={<ActionButton
                                tooltip="Select Tile"
                                icon={<Plus />}
                                variant="outline"
                                size="default"
                            />}
                        >
                            {tileProps.filter(item => !safeFocusedTileNames.includes(item.i)).map((item, idx_) => <DropdownMenuItem
                                key={idx_}
                                onSelect={() => {
                                    const newFocusedTileNames = [...safeFocusedTileNames];
                                    newFocusedTileNames[idx] = item.i;
                                    tabUIActions?.setFocusedTileNames(newFocusedTileNames as [string | undefined, string | undefined]);
                                }}
                                className="w-64 flex justify-between items-center"
                            >
                                <span>{item.i}</span>{item.tab ? icons[item.tab as keyof typeof icons] : ""}
                            </DropdownMenuItem>)}
                        </BaseDropdown>
                    </div>
                </div>
        );
    });
    return (
        <DoublePanels
            isLoading={false}
            first={<div className="h-full overflow-auto p-2">{tiles[0]}</div>}
            second={<div className="h-full overflow-auto p-2">{tiles[1]}</div>}
        />
    );
};

export default FocusDialog;
