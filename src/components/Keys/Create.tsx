import CreateDialog from "../Common/Dialogs/Create"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormEntry from "../Common/Forms/Entry";
import { ResponseProps } from "@/types/common";

const CreateKey = ({choices, paths, creationFunction}: {
    paths: string[],
    creationFunction: (name: string, value: string) => Promise<ResponseProps>
    choices?: string[],
}) => {

    // Input validation
    const CreateSchema = z.object({
        name: z
            .string()
            .min(1, { message: "Name must be at least 1 character." })
            .refine((name) => !paths.includes(name), {
                message: "Name already used.",
            }),
        value: z
            .string()
            .min(1, { message: "Value must be at least 1 character." })
    });
    const form = useForm<z.infer<typeof CreateSchema>>({
        resolver: zodResolver(CreateSchema),
        defaultValues: {
        name: "",
        value: ""
        },
    })

    // Dialog content
    const entries = [
        { name: "name", label: "Name", description: "Name of the API key.", choices: choices ? choices : undefined},
        { name: "value", label: "Value", description: "API key value."},
    ]
    const Fields =  <> {entries.map((entry, index) => 
        <FormEntry key={index} name={entry.name} label={entry.label} description={entry.description} choices={entry.choices} form={form}/>
    )} </>
    const type = choices ? "provider key" : "custom key"
    
    return (
        <CreateDialog type={type} creationFunction={creationFunction} CreateSchema={CreateSchema} Fields={Fields} form={form}/>
    )
}

export default CreateKey;
