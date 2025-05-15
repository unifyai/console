"use client";

import ColorPicker from "../Common/Misc/ColorPicker";
import ActionButton from "../Common/Buttons/Action";
import { useTabUI, useTile } from "@/contexts/hooks";
import { useTabData } from "@/contexts/hooks";
import { Maximize2, EyeOff, Copy, Grip, X, Braces, Grid2x2, Palette, Loader2 } from "lucide-react";
import { Badge } from "../UI/badge";
import Tooltip from "../Common/Misc/Tooltip";
import ContextSelector from "./Table/Content/ContextSelector";
import TutorialButton from "./TutorialButton";
import { LogsActions, ContextActions, CodeActions, GranularTileActions, GranularTabActions } from "@/types/evals/grid";
import { Context } from "@/types/evals/grid";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { getTileButtonsRef } from '@/utils/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";
import { useTileSync } from "@/contexts/hooks/tile/sync/useTileSync";

const TileButtons = ({tileId, tabId, interfaceId, projectId, contexts, tabActions, tileActions, logsActions, contextActions}: {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId:string;
    contexts: Context[],
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
    logsActions: LogsActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
}) => {
    const { meta: tileMetaState, data: tileDataState, ui: tileUIState} = useTile(tileId, tabId);
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabId);
    const { data: tabDataState} = useTabData(tabId, interfaceId);
    
    // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
    const syncedTabDataActions = syncedTabActions?.data ?? null;

    // SYNCHRONISED TILE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { actions: syncedTileActions } = useTileSync(tileId, tabId, tileActions);
    const syncedTileUIActions = syncedTileActions?.ui ?? null;

    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));
    const disabled = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

    const setFocusPaneOpen = useStoreContext(state => state.setFocusPaneOpen);

    // Get the buttons ref from our registry
    const buttonsRef = getTileButtonsRef(tileId);

    const tileType = tileMetaState?.type ?? undefined;
    const tileName = tileMetaState?.name;
    const tableName = tileDataState?.table;
    const context = tileDataState?.context;
    const columnContext = tileDataState?.column_context;

    return (
        <div ref={buttonsRef} className={"w-full px-2 transition-all absolute -top-2 flex justify-between " + (tabUIState?.edit ? "h-16" : "h-10")}>
            <div className="flex gap-2 mb-auto ml-1 items-center z-10">
                {tabUIState?.help && 
                    <TutorialButton 
                        url={
                            tileType === "Plot" ? "https://docs.unify.ai/interfaces/plots" :
                            tileType === "View" ? "https://docs.unify.ai/interfaces/views" :
                            tileType === "Editor" ? "https://docs.unify.ai/interfaces/editors" :
                            "https://docs.unify.ai/interfaces/tables"
                        }
                    />
                }
                <Tooltip content="Rename tile">
                    <Badge
                        className="cursor-pointer text-sm font-normal mb-1 flex gap-2 items-center"
                        variant="primary"
                        onClick={() => tabUIState?.edit ? tabUIActions?.setEditTile(tileName) : undefined}
                    >
                        {tileName}{tileUIState?.loading && <Loader2 className="animate-spin" size={16} />}
                    </Badge>
                </Tooltip>
                {context && tileType == "Table" && <ContextSelector
                    tileId={tileId}
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
                                {context}
                            </Badge>
                        </Tooltip>
                    }
                    setPending={tabUIActions.setPending}
                    tileActions={tileActions}
                />}
                {(columnContext) && tileType == "Table" && <ContextSelector
                    tileId={tileId}
                    tabId={tabId}
                    interfaceId={interfaceId}
                    projectId={projectId}
                    contexts={contexts}
                    context={tabDataState?.globalContext}
                    logsActions={logsActions}
                    contextActions={contextActions}
                    button={<Tooltip content="Column context">
                        <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                            <Grid2x2 size={18} />
                            {columnContext}
                        </Badge>
                    </Tooltip>}
                    setPending={tabUIActions.setPending}
                    tileActions={tileActions}
                />}
            </div>
            <div className="flex-1 flex justify-end gap-2 mb-auto opacity-0 hover:opacity-100">
                <ActionButton
                    className="cursor-pointer hover:z-10"
                    onClick={() => {
                        const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
                        if (!focusedTileNames.includes(tileName)) {
                            tabUIActions?.setFocusedTileNames([tileName, focusedTileNames[0] || focusedTileNames[1]] as [string | undefined, string | undefined]);
                        }
                        setFocusPaneOpen(true);
                    }}
                    icon={<Maximize2 />}
                    tooltip="Open in focus pane"
                    variant={(tabUIState?.focusedTileNames || [undefined, undefined]).includes(tileName) ? "primary" : "outline"}
                />
                {tabUIState?.edit && (
                    <>
                        <ActionButton
                            className="cursor-pointer hover:z-10"
                            onClick={() => syncedTileUIActions?.setVisible(false)}
                            icon={<EyeOff />}
                            tooltip={"Hide"}
                            variant="outline"
                        />
                        <ActionButton
                            className="cursor-pointer hover:z-10"
                            onClick={() => tabUIActions?.setCopied(tileName)}
                            icon={<Copy />}
                            tooltip={"Copy"}
                            variant="outline"
                        />
                        <ColorPicker
                            value={tileUIState?.color ?? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()}
                            onChange={(color) => syncedTileUIActions?.setColor(color)}
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
                            disabled={disabled}
                            icon={<Grip />}
                            tooltip="Drag"
                            variant="outline"
                        />
                        <ActionButton
                            className="remove cursor-pointer hover:z-10"
                            disabled={disabled}
                            onClick={() => syncedTabDataActions?.removeTile(tileId)}
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