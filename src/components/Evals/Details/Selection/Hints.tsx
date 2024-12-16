import { Badge } from "@/components/UI/badge"
import { ArrowUp, ArrowDown } from "lucide-react"
import { ReactNode } from "react"

const Hint = ({command, instruction}: {command: string | ReactNode, instruction: string}) => {
    return (
    <div className="grid grid-cols-2 items-start py-2">
        <Badge variant={"outline"} className="w-fit scale-120">{command}</Badge>
        <p className="text-gray-500">{instruction}</p>
    </div>        
    )
}

const SelectionHints = () => {
    return (
    <div className="grid grid-cols-8">
        <div/>
        <div className="flex flex-col col-span-6 gap-2">

            <div className="flex flex-col gap-1 border-primary border-1 rounded-md p-4">
                <p className="font-bold">Table Actions</p>
                <div className="grid grid-rows-2">
                    <Hint command="Click" instruction="Click on a row to select it"/>
                    <Hint command="Ctrl + Click"  instruction="Ctrl and click on another row to multi-select rows."/>
                    <Hint command="Shift + Click" instruction="Shift and click on a row to batch-select rows."/>
                    <Hint command="Esc" instruction="Deselect all selected rows"/>
                    <Hint command="Backspace / Delete" instruction="Press delete or backspace to delete selected rows"/>
                </div>
            </div>

        </div>
        <div/>
    </div>
    )
}

export default SelectionHints;
