"use client";

import CreateDialog from "@/components/Common/Dialogs/Create";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormEntry from "@/components/Common/Forms/Entry";
import { ResponseProps } from "@/types/common";

const CreateProject = ({paths, creationFunction, disabled}: {
    paths: string[],
    creationFunction: (name: string, value: string) => Promise<ResponseProps>,
    disabled?: boolean
}) => {

    // Input validation
    const CreateSchema = z.object({
        name: z
            .string()
            .min(1, { message: "Name must be at least 1 character." })
            .refine((name) => !paths.includes(name), {
                message: "Name already used.",
            }),
    });
    const form = useForm<z.infer<typeof CreateSchema>>({
        resolver: zodResolver(CreateSchema),
        defaultValues: {
        name: "",
        },
    })

    // Dialog content
    const entries = [
        { name: "name", label: "Name", description: "Name of the project."},
    ]
    const Fields =  <> {entries.map((entry, index) => 
        <FormEntry key={index} name={entry.name} label={entry.label} description={entry.description} form={form}/>
    )} </>
    
    // Select created project
    const updateProject = (data: z.infer<typeof CreateSchema>) => {
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);
        params.set("project", data.toString());
        currentUrl.search = params.toString();
        window.history.pushState({}, '', currentUrl.href);
    }
    
    return (
        <CreateDialog 
            type={"project"} 
            creationFunction={creationFunction} 
            CreateSchema={CreateSchema} 
            Fields={Fields} 
            form={form}
            extraFormActions={(data) => updateProject(data.name)}
            disabled={disabled}
        />
    )
}

export default CreateProject;
