"use client";

import { useState, Dispatch, SetStateAction, ReactNode } from "react";
import { Check, Trash } from "lucide-react";
import { ResponseProps } from "@/types/common";
import BaseDialog from "./Base";
import ActionButton from "../Buttons/Action"
import DeleteButton from "../Buttons/Delete";

const DeleteDialog = ({ args, type, deletingFunction, variant, showDialog, setShowDialog, customOpen, setCustomOpen, onDelete, removeLabel, icon = <Trash/>, text, expectedResponseType, className }: {
    args: any[],
    type: string
    deletingFunction: (...args: any[]) => Promise<ResponseProps | string>,
    variant?: "secondary" | "destructive" | "outline" | "ghost" | "link" | "warning",
    showDialog?: boolean,
    setShowDialog?: (open: boolean) => any,
    customOpen?: boolean,
    setCustomOpen?: (open: boolean) => any,
    onDelete?: () => void,
    removeLabel?: string,
    icon?: ReactNode,
    text?: string,
    expectedResponseType?: ResponseProps | "string",
    className?: string
}) => {
    // Define messages
    const messages = {
        "success": `Successfully deleted ${type}! Reloading...`,
        "warning": `You are about to delete the selected ${type}. This is an irreversible action.`,
        "error": `We encountered some issue when deleting your ${type}. Please try again or contact us if the issue persists.`,
        "tooltip": `Delete ${type}`
    };

    // Handle submission
    const [error, setError] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const onSubmit = () => {
        setError(false);
        setLoading(true);
        deletingFunction(...args).then(data => {
            if (expectedResponseType === "string" || "info" in (data as ResponseProps)) {
                setSuccess(true);
                if (onDelete) {onDelete()}
                else {window.location.reload()};
                setTimeout(() => setOpen(false), 2000)
            }
            else {
                setError(true);
                setLoading(false);
            }
        });
    };

    // Dialog state and content
    const [open_, setOpen_] = useState(false);
    const open = customOpen == undefined ? open_ : customOpen;
    const setOpen = setCustomOpen == undefined ? setOpen_ : setCustomOpen;
    const onOpen = () => showDialog && setShowDialog ? setShowDialog(!showDialog) : setOpen(!open);
    const tooltip = `Delete ${type}`
    const onClick = (e:any) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen()
    }
    const button =   setShowDialog ? null : <ActionButton tooltip={tooltip} icon={icon} text={text} variant={variant} className={className} onClick={onClick}/>

    let deleteText = "Delete";
    if (removeLabel) {
        deleteText = "Delete from all contexts";
    }

    const title =   tooltip + " ?"
    const body =    success ? messages["success"] : error ? messages["error"] : messages["warning"];
    const footer = success ? null : (
        <div className="flex items-center gap-2">
          {removeLabel && (
            <ActionButton
              tooltip={removeLabel}
              text={removeLabel}
              variant="warning"
              disabled={loading}
              onClick={() => {
                setError(false);
                setLoading(true);
                // Build removeArgs: unique list of [id, null] pairs
                const [projectArg, contextArg, idsAndFieldsArg, sourceType] = args;
                const uniqueIds = Array.from(new Set((idsAndFieldsArg as [number, any][]).map(([id]) => id)));
                const removeFields = uniqueIds.map(id => [id, null]);
                const removeArgs = [projectArg, contextArg, removeFields, sourceType];
                deletingFunction(...removeArgs).then(data => {
                    if (expectedResponseType === "string" || "info" in (data as ResponseProps)) {
                        setSuccess(true);
                        if (onDelete) {onDelete()} else {window.location.reload()};
                        setTimeout(() => setOpen(false), 2000);
                    } else {
                        setError(true);
                        setLoading(false);
                    }
                });
              }}
            />
          )}
          <DeleteButton disabled={loading} onClick={onSubmit} loading={loading} deleteText={deleteText}/>
        </div>
    )

    return (
        <BaseDialog button={button} title={title} body={body} footer={footer} open={showDialog ? showDialog : open} triggerClassName={className} setOpen={setShowDialog ? setShowDialog : setOpen}/>
  );
}

export default DeleteDialog;
