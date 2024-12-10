import CreateDialog from "../Common/Dialogs/Create"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ResponseProps } from "@/types/common";
import FormEntry from "../Common/Forms/Entry";

const CreateEndpoint = ({type, paths, keys, creationFunction}: {
    type: string,
    paths: string[],
    keys: string[],
    creationFunction: (name: string, url: string, key_name: string, model_arg?: string) => Promise<ResponseProps>
}) => {
    // Handle input validation
    const CreateSchema = z.object({
        name: z
            .string()
            .includes("@", { message: `Endpoint must be in the format model@provider` })
            .min(1, { message: "Name must be at least 1 character." })
            .refine((name) => !paths.includes(name), {
                message: "Name already used.",
            })
            .refine((name) => 
                ['custom', 'custom-openai', 'custom-mistral', 'custom-vertex-ai', 'custom-fireworks-ai', 'custom-together-ai'].includes(name.split("@").at(-1)!), {
                    message: "Custom provider must be one of 'custom', 'custom-openai', 'custom-mistral', 'custom-vertex-ai', 'custom-fireworks-ai', 'custom-together-ai'"
                }
        ),
        url: z
            .string()
            .url()
            .min(1, { message: "URL must be at least 1 character." }),
        key_name: z
            .string()
            .min(1, { message: "Key value must be at least 1 character."})
            .refine((key) => keys.includes(key), {
                message: "Key not found.",
            }),
        model_arg: z
            .string()
            .optional()
    });
 
    const form = useForm<z.infer<typeof CreateSchema>>({
        resolver: zodResolver(CreateSchema),
        defaultValues: { name: "", url: "", key_name: "", model_arg: "" },
    })

    const entries = [
        { name: "name", label: "Name", description: "The endpoint name for your custom endpoint, in model@provider format. If it’s a custom endpoint following the OpenAI format then the provider must be @custom, otherwise if it’s a fine-tuned model from one of the existing providers it can be specified with a prepending custom-, i.e. @custom-anthropic." },
        { name: "url", label: "URL", description: "Base URL of the endpoint being called. Must support the OpenAI format."},
        { name: "key_name", label: "API Key", choices: keys, description: "Name of the API key that will be passed as part of the query."},
        { name: "model_arg", label: "Model Argument", description: "The value passed to the model arugment of the underlying API which is being wrapped into Unify. For example, you might call your endpoint llama-3-baseten@custom to distinguish the custom endpoint within Unify, but under the hood need to pass llama-3.2-90b-chat to the Baseten endpoint."}
    ]
    const Fields =  <> {entries.map((entry, index) => 
        <FormEntry key={index} name={entry.name} label={entry.label} description={entry.description} choices={entry.choices} form={form}/>)
    } </>
            
    return (
        <div className="tutorial-add-custom-endpoint">
            <CreateDialog
                type={type}
                creationFunction={creationFunction}
                CreateSchema={CreateSchema}
                Fields={Fields}
                form={form}
            />
        </div>
    )
}

export default CreateEndpoint;
