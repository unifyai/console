import { Badge } from "@/components/UI/badge"
import { ReactNode } from "react"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react"
const Hint = ({command, instruction}: {command: string | ReactNode, instruction: string}) => {
    return (
    <div className="grid grid-cols-2 items-start py-2">
        <Badge variant={"outline"} className="w-fit scale-120">{command}</Badge>
        <p>{instruction}</p>
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
                    <Hint command="Click" instruction="Click on a cell to select it."/>
                    <Hint command="[Ctrl + Click]"  instruction="Ctrl and click on another cell to multi-select cells."/>
                    <Hint command="[Shift + Click] / Mouse Drag" instruction="Shift and click on a cell or drag the mouse to batch-select cells."/>
                    <Hint 
                        command={
                            <div className="flex flex-row gap-1">
                                <ArrowUp/>
                                <ArrowDown/>
                                <ArrowLeft/>
                                <ArrowRight/>
                            </div>
                        } 
                        instruction="Press arrow keys on a selected cell to select an adjacent cell."
                    />
                    <Hint command="Escape / Click outside" instruction="Press escape key on a selected cell or click outside of the table to reset cell selections."/>
                </div>
            </div>

        </div>
        <div/>
    </div>
    )
}

export default SelectionHints;
