"use client";

import { useState } from "react";
import { ResponseProps } from "@/types/common";
import BaseDialog from "../../../../Common/Dialogs/Base";
import DeleteButton from "../../../../Common/Buttons/Delete";
import { RadioGroup, RadioGroupItem } from "@/components/UI/radio-group";
import { Label } from "@/components/UI/label";
import ActionButton from "@/components/Common/Buttons/Action";
import { Trash } from "lucide-react";

export type DeleteOption = "project" | "logs" | "logs_and_contexts";

const DeleteProjectDialog = ({
    project,
    deletingFunctions,
    showDialog,
    setShowDialog,
    onDelete,
    text,
    className,
}: {
    project: string;
    deletingFunctions: {
        project: (projectName: string) => Promise<ResponseProps | string>;
        logs: (projectName: string) => Promise<ResponseProps | string>;
        logsAndContexts: (projectName: string) => Promise<ResponseProps | string>;
    };
    showDialog: boolean;
    setShowDialog: (open: boolean) => void;
    onDelete: (option: DeleteOption) => void;
    text?: string;
    className?: string;
}) => {
    const [selectedOption, setSelectedOption] = useState<DeleteOption>("project");
    const [error, setError] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const typeLabels = {
        "project": "project",
        "logs": "all logs in this project",
        "logs_and_contexts": "all logs and contexts in this project"
    };

    const messages = {
        "success": `Successfully deleted ${typeLabels[selectedOption]}!`,
        "warning": `You are about to perform a project deletion. This is an irreversible action. Please select what you want to delete:`,
        "error": `We encountered some issue when deleting. Please try again or contact us if the issue persists.`,
        "tooltip": `Delete Project`
    };

    const onSubmit = () => {
        setError(false);
        setLoading(true);

        let deleteFn;
        switch (selectedOption) {
            case "logs":
                deleteFn = deletingFunctions.logs;
                break;
            case "logs_and_contexts":
                deleteFn = deletingFunctions.logsAndContexts;
                break;
            case "project":
            default:
                deleteFn = deletingFunctions.project;
                break;
        }

        deleteFn(project).then(data => {
            if (typeof data === 'string' || "info" in (data as ResponseProps)) {
                setSuccess(true);
                onDelete(selectedOption);
                setTimeout(() => {
                    setShowDialog(false);
                }, 2000);
            } else {
                setError(true);
                setLoading(false);
            }
        });
    };

    const onOpenChange = (open: boolean) => {
        if (!open) {
            // Reset state when dialog is closed
            setTimeout(() => {
                setError(false);
                setSuccess(false);
                setLoading(false);
                setSelectedOption("project");
            }, 300);
        }
        setShowDialog(open);
    }

    const title = messages["tooltip"] + " ?";
    const body = (
        <div>
            <p>{success ? messages["success"] : error ? messages["error"] : messages["warning"]}</p>
            {!success && !error && (
                <RadioGroup defaultValue="project" value={selectedOption} onValueChange={(value: DeleteOption) => setSelectedOption(value)} className="mt-4 space-y-2">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="project" id="delete-project" className="p-0.5 pr-0.5"/>
                        <Label htmlFor="delete-project" className="pt-0.5">Delete the entire project</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="logs" id="delete-logs" className="p-0.5 pr-0.5"/>
                        <Label htmlFor="delete-logs" className="pt-0.5">Delete all logs in the project</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="logs_and_contexts" id="delete-logs-contexts" className="p-0.5 pr-0.5"/>
                        <Label htmlFor="delete-logs-contexts" className="pt-0.5">Delete all logs and contexts in the project</Label>
                    </div>
                </RadioGroup>
            )}
        </div>
    );
    
    const footer = success ? null : (
        <div className="flex items-center gap-2">
            <DeleteButton disabled={loading} onClick={onSubmit} loading={loading} deleteText={"Delete"}/>
        </div>
    );
    
    const button =  
    <ActionButton
        tooltip="Delete Project"
        variant="ghost"
        text={text || "Delete Project"}
        onClick={() => setShowDialog(true)}
        className={className || "w-full justify-start"}
        icon={<Trash className="h-4 w-4 mr-2" />}
    />
    
    return (
        <BaseDialog
            button={button}
            title={title}
            body={body}
            footer={footer}
            open={showDialog}
            setOpen={onOpenChange}
        />
    );
}

export default DeleteProjectDialog;