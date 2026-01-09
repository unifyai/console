"use client";

import ActionButton from "../../../../../Common/Buttons/Action";
import BaseDropdown from "../../../../../Common/Dropdowns/Base";
import BaseDialog from "../../../../../Common/Dialogs/Base";
import { ContextActions, LogsActions, GranularTabActions, GranularTileActions, ProjectsActions, FieldsActions } from "@/types/interfaces/grid";
import { FolderTree } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import { useTileItem } from "@/contexts/hooks/tile";
import { useProjectData } from "@/contexts/hooks/project";
import ContextContent from "./ContextContent";
import { useTableDataQuery } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { useListContextsQuery } from "@/hooks/Interfaces/Query/useContextsQuery";

const ContextSelector = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    context,
    setContext,
    customOpen,
    setCustomOpen,
    button,
    tabActions,
    tileActions,
    logsActions,
    contextActions,
    projectsActions,
    fieldsActions,
    setPending,
    withButtonText = false,
    text = "Select context"
}: {
    tileId?: string,
    tabId?: string,
    interfaceId?: string,
    projectId?: string,
    context?: string,
    setContext?: (context: string) => void,
    customOpen?: boolean,
    setCustomOpen?: (customOpen: boolean) => void,
    button?: React.ReactNode,
    tabActions?: GranularTabActions,
    tileActions?: GranularTileActions,
    logsActions: LogsActions,
    contextActions: ContextActions,
    projectsActions: ProjectsActions,
    fieldsActions: FieldsActions,
    setPending: (pending: boolean) => void,
    withButtonText?: boolean,
    text?: string
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [start, setStart] = useState(true);

    const open = customOpen == undefined ? internalOpen : customOpen;
    const setOpen = setCustomOpen == undefined ? setInternalOpen : setCustomOpen;

    const { dataActions: projectDataActions } = useProjectData(projectId || null);
    const { itemActions: tileItemActions } = useTileItem(tileId || null, tabId || null);

    // Use React Query to fetch contexts
    const listContextsQuery = useListContextsQuery(projectId || null, contextActions);

    // Use React Query to access tableDataItem
    const { 
        data: tableDataItem,
        isLoading: isTableDataLoading,
        isError: isTableDataError,
        error: tableDataError
    } = useTableDataQuery(tileId || null, tabId || null);

    const emptyLogs = useMemo(() => {
        return tableDataItem?.logs?.length == 0;
    }, [tableDataItem?.logs]);

    const item = useMemo(() => tileItemActions?.asTileItem(), [tileItemActions]);

    // Update contexts when React Query data changes
    useEffect(() => {
        if (listContextsQuery.data) {
            projectDataActions?.setContexts(listContextsQuery.data);
        }
    }, [listContextsQuery.data, projectDataActions]);

    const onOpen = () => {
        // Refetch contexts using React Query
        listContextsQuery.refetch();
    }

    const commonSetOpenHandler = (value: boolean | ((prevState: boolean) => boolean)) => {
        // Handle both direct boolean values and state updater functions
        const isOpen = typeof value === 'function' ? value(open) : value;
        
        if (isOpen && projectId && contextActions) {
            // Refetch contexts when opening
            onOpen();
        }
        if (start && isOpen && !open) {
            setOpen(true);
            setStart(false);
        }
        else {
            setOpen(false);
        }
    };

    return (
        <div className="w-full">
            {item === undefined ? (
                <BaseDialog
                    context="tile"
                    button={button || <ActionButton
                        text={text}
                        tooltip={text}
                        icon={<FolderTree className="h-4 w-4 mr-2"/>}
                        variant={context ? "primary" : "ghost"}
                        className="w-full justify-start"
                        disabled={!projectId}
                    />}
                    open={!projectId ? false : open ? true : undefined}
                    setOpen={commonSetOpenHandler}
                    body={
                        <ContextContent
                            projectId={projectId}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            tileId={tileId}
                            context={context}
                            setContext={setContext}
                            setPending={setPending}
                            contextActions={contextActions}
                            logsActions={logsActions}
                            tabActions={tabActions}
                            tileActions={tileActions}
                            projectsActions={projectsActions}
                            fieldsActions={fieldsActions}
                            loading={listContextsQuery.isLoading}
                        />
                    }
                />
            ) : (
                <BaseDropdown
                    context="tile"
                    button={button || <ActionButton
                        tooltip="Edit Context"
                        text={withButtonText ? text : undefined}
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
                        context={context}
                        setContext={setContext}
                        setPending={setPending}
                        contextActions={contextActions}
                        logsActions={logsActions}
                        tabActions={tabActions}
                        tileActions={tileActions}
                        projectsActions={projectsActions}
                        fieldsActions={fieldsActions}
                        loading={listContextsQuery.isLoading}
                    />
                </BaseDropdown>
            )}
        </div>
    )
}

export default ContextSelector;