"use client";

import { useState } from "react";
import React from "react";
import { Pen } from "lucide-react";
import { ResponseProps } from "@/types/common";
import BaseDialog from "./Base";
import SubmitButton from "../Buttons/Submit";
import ActionButton from "../Buttons/Action";
import RetryButton from "../Buttons/Retry";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Form } from "@/components/UI/form"
import { Input } from "@/components/UI/input"
import FormEntry from "../Forms/Entry";
import { useKey } from "react-use";

export default function RenameDialog ({ path, paths, fileDir, fileName, type, renamingFunction }: {
    path: string;
    paths: string[];
    fileDir: string;
    fileName: string;
    type: string;
    renamingFunction: (name: string, new_name: string) => Promise<ResponseProps>
}) {
    // Define messages
    const messages = {
        "success": `Successfully renamed ${type}! Reloading the page...`,
        "error": `We encountered some issue when renaming your ${type}. Please reload try again`,
        "tooltip": `Rename ${type}`
    };    

    // Handle input validation
    const RenameSchema = z.object({
        newName: z
            .string()
            .min(1, {
                message: "Name must be at least 1 character.",
            })
            .refine((value) => !paths.includes(`${fileDir}/${value}`), {
                message: "Name already used.",
            }),
    });
    const form = useForm<z.infer<typeof RenameSchema>>({
        resolver: zodResolver(RenameSchema),
        defaultValues: {
          newName: "",
        },
    })

    // Handle submission
    const [error, setError] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const onSubmit = (data: z.infer<typeof RenameSchema>) => {
        setError(false)
        setLoading(true);
        const newPath = fileDir === "." ? data.newName : `${fileDir}/${data.newName}`;
        renamingFunction(path, newPath).then(data => {
            if ("info" in data) {
                setSuccess(true);
                window.location.reload();
            }
            else {
                setError(true);
                setLoading(false);
            }

        });
    };

    // Dialog state and content
    const [open, setOpen] = useState(false)
    const onOpen = () => {
        setOpen(!open);
    }

    const tooltip = `Rename ${type}` 
    const button =  <ActionButton icon={<Pen/>} onClick={onOpen} tooltip={tooltip} />
    
    const title =   tooltip + "?"
    const Fields =  <> 
                        <Input disabled placeholder={fileName} />
                        <FormEntry form={form} name="newName" label="New Name" description={`New ${type} name`}/>
                    </>
    const body =    success ? messages["success"] : error ? messages["error"] : Fields;
    const footer =  success 
        ? null 
        : error
            ?   <RetryButton onClick={() => setError(false)}/>
            :   <SubmitButton disabled={loading} onClick={form.handleSubmit(onSubmit)}/>

    // Hotkey to trigger form submission when pressing enter
    // useKey("Enter", () => {
    //     form.handleSubmit(onSubmit)();
    // });

    return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <BaseDialog button={button} title={title} body={body} footer={footer} open={open} setOpen={setOpen}/>
        </form>
    </Form>
    );
}
