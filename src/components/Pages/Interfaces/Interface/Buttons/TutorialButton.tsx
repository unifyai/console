"use client";

import { Info } from "lucide-react";
import { Badge } from "../../../../UI/badge";
import Tooltip from "../../../../Common/Misc/Tooltip";

const TutorialButton = ({url}:{ url: string }) => {
    
    /* Info Button */
    const icon = <Info size={12}/>
    const tooltip = "Learn how to use this component"
    const onClick = () => {
        window.open(url, "_blank")
    }
    
    return <Tooltip content={tooltip}>
                <Badge onClick={onClick} variant={"primary"} className="mb-1 p-1.5">
                    {icon}
                </Badge>
            </Tooltip>
}

export default TutorialButton