import { FormItem, FormLabel, FormDescription, FormControl, FormMessage, FormField } from "@/components/UI/form";
import { Input } from "@/components/UI/input";
import { UseFormReturn, ControllerRenderProps } from "react-hook-form";
import AutoComplete from "../Misc/AutoComplete";

export default function FormEntry ({form, name, label, description, choices}: {
    form: UseFormReturn<any, any, undefined>
    name: string,
    label: string,
    description?: string,
    choices?: string[]
}) {
    let input;
    if (choices)
        input = (field: ControllerRenderProps<any, string>) => 
            <AutoComplete 
                items={choices.map(choice => ({label: choice, value: choice}))}
                type={label}
                onSelect={field.onChange}
                className={"w-full"}
            />
    else
        input = (field: ControllerRenderProps<any, string>) => 
            <Input {...field} />
    return (
        <FormField 
            control={form.control} 
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    {description && <FormDescription>{description}</FormDescription>}
                    <FormControl>
                        {input(field)}
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
