"use client";

import ColorPicker from "../Common/Misc/ColorPicker";
import ActionButton from "../Common/Buttons/Action";
import { useInterfaceUI, useTabUI, useTileUI } from "@/contexts/hooks";
import { useTabData } from "@/contexts/hooks";
import { Maximize2, EyeOff, Copy, Grip, X, Braces, Grid2x2, Palette } from "lucide-react";
import { Badge } from "../UI/badge";
import Tooltip from "../Common/Misc/Tooltip";
import ContextSelector from "./Table/Content/ContextSelector";
import TutorialButton from "./TutorialButton";
import { TileProps } from "@/types/evals/grid";
import { LogsActions, ContextActions, CodeActions } from "@/types/evals/grid";
import { ResponseProps } from "@/types/common";
import { Context } from "@/types/evals/grid";

const TileButtons = ({item, tileId, tabId, interfaceId, projectId, contexts, logsActions, contextActions, updateTab, setFocusDialog, setEditTile, setNewCounter, tileCount, buttonsRef}: {
    item: TileProps;
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId:string;
    contexts: Context[],
    setNewCounter: (newCounter: number) => void;
    setFocusDialog: (focusDialog: boolean) => void;
    setEditTile: (editTile: string | undefined) => void;
    updateTab: (savedTab?: any, updatedItem?: any) => Promise<ResponseProps>;
    logsActions: LogsActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    tileCount: number;
    buttonsRef: React.RefObject<HTMLDivElement>
}) => {
    const {ui: tileUIState, uiActions: tileUIActions} = useTileUI(tileId, tabId, interfaceId);
    const {ui: tabUIState, uiActions: tabUIActions} = useTabUI(tabId, interfaceId)
    const {data: tabDataState, dataActions: tabDataActions} = useTabData(tabId, interfaceId);
    const {uiActions: interfaceUIActions} = useInterfaceUI(interfaceId);
    return (
        <div ref={buttonsRef} className={"w-full px-2 transition-all absolute -top-2 flex justify-between " + (tabUIState?.edit ? "h-16" : "h-10")}>
            <div className="mb-auto flex gap-2 ml-1 items-center">
                {tabUIState?.help && 
                    <TutorialButton 
                        url={
                            item.tab === "Plot" ? "https://docs.unify.ai/interfaces/plots" :
                            item.tab === "View" ? "https://docs.unify.ai/interfaces/views" :
                            item.tab === "Editor" ? "https://docs.unify.ai/interfaces/views" :
                            "https://docs.unify.ai/interfaces/tables"
                        }
                    />
                }
                <Tooltip content="Rename Tile">
                    <Badge
                        className="cursor-pointer text-sm font-normal mb-1"
                        variant="primary"
                        onClick={() => tabUIState?.edit ? setEditTile(item.i) : undefined}
                    >
                        {item.i}
                    </Badge>
                </Tooltip>
                {item.context && item.tab == "Table" && <ContextSelector
                    tileId={item.i}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    contexts={contexts}
                    context={tabDataState?.globalContext}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    button={
                        <Tooltip content="Context">
                            <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                <Braces size={18} />
                                {item.context}
                            </Badge>
                        </Tooltip>
                    }
                    refresh={() => updateTab()}
                    setPending={interfaceUIActions.setPending}
                />}
                {(item.column_context) && item.tab == "Table" && <ContextSelector
                    tileId={item.i}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    contexts={contexts}
                    context={tabDataState?.globalContext}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    button={<Tooltip content="Column Context">
                        <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                            <Grid2x2 size={18} />
                            {item.column_context}
                        </Badge>
                    </Tooltip>}
                    refresh={() => updateTab()}
                    setPending={interfaceUIActions.setPending}
                />}
            </div>
            <div className="flex-1 flex justify-end gap-2 mb-auto opacity-0 hover:opacity-100">
                <ActionButton
                    className="cursor-pointer hover:z-10"
                    onClick={() => {
                        const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
                        if (!focusedTileNames.includes(item.i)) {
                            tabUIActions?.setFocusedTileNames([item.i, focusedTileNames[0] || focusedTileNames[1]] as [string | undefined, string | undefined]);
                        }
                        setFocusDialog(true);
                    }}
                    icon={<Maximize2 />}
                    tooltip="Open in Focus Pane"
                    variant={(tabUIState?.focusedTileNames || [undefined, undefined]).includes(item.i) ? "primary" : "outline"}
                />
                {tabUIState?.edit && (
                    <>
                        <ActionButton
                            className="cursor-pointer hover:z-10"
                            onClick={() => tabDataActions?.updateTile(item.i, { visible: false })}
                            icon={<EyeOff />}
                            tooltip={"Hide"}
                            variant="outline"
                        />
                        <ActionButton
                            className="cursor-pointer hover:z-10"
                            onClick={() => tabUIActions?.setCopied(item.i)}
                            icon={<Copy />}
                            tooltip={"Copy"}
                            variant="outline"
                        />
                        <ColorPicker
                            value={tileUIState?.color ?? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()}
                            onChange={(color) => tileUIActions?.setColor(color)}
                        >
                            <ActionButton 
                                className="cursor-pointer hover:z-10"
                                icon={<Palette/>} 
                                variant="outline" 
                                tooltip="Change tile primary color"
                            />
                        </ColorPicker>
                        <ActionButton
                            className="drag cursor-grab hover:z-10"
                            icon={<Grip />}
                            tooltip="Drag"
                            variant="outline"
                        />
                        <ActionButton
                            className="remove cursor-pointer hover:z-10"
                            onClick={() => {
                                tabDataActions?.removeTile(item.i);
                                if (tileCount <= 1) {
                                    setNewCounter(0);
                                }
                                }}
                            icon={<X />}
                            tooltip="Remove"
                            variant="outline"
                        />
                    </>
                )}
            </div>
        </div>
    )
}
export default TileButtons;