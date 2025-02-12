"use client";

import { useState, Dispatch, SetStateAction } from "react";
import { Trash } from "lucide-react";
import { ResponseProps } from "@/types/common";
import BaseDialog from "./Base";
import ActionButton from "../Buttons/Action"
import DeleteButton from "../Buttons/Delete";
import { useKey } from "react-use";

const DeleteDialog = ({ resource, type, deletingFunction, showDialog, variant, setShowDialog, onDelete }: {
    resource: any,
    type: string
    deletingFunction: (resource: any) => Promise<ResponseProps>,
    variant?: "secondary" | "destructive" | "outline" | "ghost" | "link",
    showDialog?: boolean,
    setShowDialog?: Dispatch<SetStateAction<boolean>>
    onDelete?: () => void
}) => {
    // Define messages
    const messages = {
        "success": `Successfully deleted ${type}! Reloading the page...`,
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
        deletingFunction(resource).then(data => {
            if ("info" in data) {
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
    const [open, setOpen] = useState(false)
    const onOpen = () => showDialog && setShowDialog ? setShowDialog(!showDialog) : setOpen(!open);
    
    const tooltip = `Delete ${type}`
    const button =   setShowDialog ? null : <ActionButton tooltip={tooltip} icon={<Trash/>} variant={variant} onClick={onOpen}/>

    const title =   tooltip + "?"
    const body =    success ? messages["success"] : error ? messages["error"] : messages["warning"];
    const footer =  success ? null : <DeleteButton disabled={loading} onClick={onSubmit} loading={loading}/>
    
    // Hotkey to trigger form submission when pressing enter
    // useKey("Enter", () => {
    //     onSubmit();
    // });


    return (
        <BaseDialog button={button} title={title} body={body} footer={footer} open={showDialog ? showDialog : open} setOpen={setShowDialog ? setShowDialog : setOpen}/>
  );
}

export default DeleteDialog;
