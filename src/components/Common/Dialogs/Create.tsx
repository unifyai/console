"use client";

import { ReactNode, useState } from "react";
import React from "react";
import { Plus } from "lucide-react";
import { ResponseProps } from "@/types/common";
import BaseDialog from "./Base";
import SubmitButton from "../Buttons/Submit";
import RetryButton from "../Buttons/Retry";
import { UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { Form } from "@/components/UI/form"
import SettingButton from "../Buttons/Setting";
import { useKey } from "react-use";

export default function CreateDialog ({ type, creationFunction, CreateSchema, form, Fields, extraFormActions }: {
    type: string;
    creationFunction: (...args: any[]) => Promise<ResponseProps>
    CreateSchema: z.ZodObject<any>,
    form: UseFormReturn<any, any, undefined>
    Fields: ReactNode,
    extraFormActions?: (data: z.infer<typeof CreateSchema>) => void
}) {
    // Define messages
    const messages = {
        "success": `Successfully created ${type}! Reloading the page...`,
        "error": `We encountered some issue when creating your ${type}. Please try again`,
        "tooltip": `Create ${type}`
    };    

    // Handle submission
    const [error, setError] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const onSubmit = (data: z.infer<typeof CreateSchema>) => {
        setLoading(true);
        creationFunction(...Object.values(data)).then(response => {
            if ("info" in response) {
                setSuccess(true);
                if (extraFormActions) extraFormActions(data);
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
    
    const tooltip = `Create ${type}`
    const button =  <SettingButton icon={<Plus/>} onClick={onOpen} tooltip={tooltip}/>
    
    const title = tooltip
    const body =    success ? messages["success"] : error ? messages["error"] : Fields;
    const footer =  success 
        ? null 
        : error 
            ?   <RetryButton onClick={() => setError(false)}/>
            :   <SubmitButton disabled={loading} onClick={form.handleSubmit(onSubmit)}/>
    
    // Hotkey to trigger form submission when pressing enter
    // useKey("Enter", () => {
    //     form.handleSubmit(onSubmit)()
    // });
    
    return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <BaseDialog button={button} title={title} body={body} footer={footer} open={open} setOpen={setOpen}/>
        </form>
    </Form>
    );
}
