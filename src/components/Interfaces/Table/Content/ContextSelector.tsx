"use client";

import ActionButton from "../../../Common/Buttons/Action";
import BaseDropdown from "../../../Common/Dropdowns/Base";
import BaseDialog from "../../../Common/Dialogs/Base";
import { Context, ContextActions, LogsActions } from "@/types/evals/grid";
import { FolderTree } from "lucide-react";
import { ResponseProps } from "@/types/common";
import { useMemo, useState } from "react";

import { useTileItem } from "@/contexts/hooks/tile";
import { useTableTile } from "@/contexts/hooks/tile/useTableTile";
import { useProjectData } from "@/contexts/hooks/project";
import ContextContent from "./ContextContent";

const ContextSelector = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    contexts,
    context,
    setContext,
    customOpen,
    setCustomOpen,
    button,
    logsActions,
    contextActions,
    refresh,
    setPending
}: {
    tileId?: string,
    tabId?: string,
    interfaceId?: string,
    projectId?: string,
    contexts: Context[],
    context?: string,
    setContext?: (context: string) => void,
    customOpen?: boolean,
    setCustomOpen?: (customOpen: boolean) => void,
    button?: React.ReactNode,
    logsActions: LogsActions,
    contextActions: ContextActions,
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void
}) => {
    const [open_, setOpen_] = useState(false);
    const [start, setStart] = useState(true);

    const open = customOpen == undefined ? open_ : customOpen;
    const setOpen = setCustomOpen == undefined ? setOpen_ : setCustomOpen;

    const { dataActions: projectDataActions } = useProjectData(projectId || null);
    const { itemActions: tileItemActions } = useTileItem(tileId || null, tabId || null, interfaceId || null);

    const { tableTile: tableTileState } = useTableTile(tileId || null, tabId || null, interfaceId || null, projectId || null);

    const emptyLogs = useMemo(() => {
        return tableTileState?.tableDataItem?.logs?.length == 0;
    }, [tableTileState?.tableDataItem?.logs]);

    const item = useMemo(() => tileItemActions?.asTileItem(), [tileItemActions]);

    const commonSetOpenHandler = (value: boolean | ((prevState: boolean) => boolean)) => {
        // Handle both direct boolean values and state updater functions
        const isOpen = typeof value === 'function' ? value(open) : value;
        
        if (isOpen && projectId && contextActions) {
            contextActions.get(projectId).then(ctxs => projectDataActions?.setContexts(ctxs));
        }
        if (start && isOpen && !open) {
            setOpen(true);
            setStart(false);
        }
        else setOpen(false);
    };

    return (
        <div className="w-fit">
            {item === undefined ? (
                <BaseDialog
                    context="tile"
                    button={button || <ActionButton
                        text="Edit Global Context"
                        tooltip="Edit Global Context"
                        icon={<FolderTree />}
                        variant={context ? "primary" : "ghost"}
                        size="sm"
                        disabled={!projectId}
                    />}
                    open={!projectId ? false : open ? true : undefined}
                    setOpen={commonSetOpenHandler}
                    body={<ContextContent
                        projectId={projectId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        tileId={tileId}
                        contexts={contexts}
                        context={context}
                        setContext={setContext}
                        refresh={refresh}
                        setPending={setPending}
                        contextActions={contextActions}
                        logsActions={logsActions}
                    />}
                />
            ) : (
                <BaseDropdown
                    context="tile"
                    button={button || <ActionButton
                        tooltip="Edit Context and Column Context"
                        icon={<FolderTree />}
                        variant={context ? "primary" : "outline"}
                        size="sm"
                        disabled={!projectId}
                    />}
                    open={!projectId ? false : open ? true : undefined}
                    defaultOpen={context == undefined && emptyLogs}
                    setOpen={commonSetOpenHandler}
                >
                    <ContextContent
                        projectId={projectId}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        tileId={tileId}
                        contexts={contexts}
                        context={context}
                        setContext={setContext}
                        refresh={refresh}
                        setPending={setPending}
                        contextActions={contextActions}
                        logsActions={logsActions}
                    />
                </BaseDropdown>
            )}
        </div>
    )
}

export default ContextSelector;
