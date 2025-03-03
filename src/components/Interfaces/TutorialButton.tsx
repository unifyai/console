"use client";

import { Info } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";

const TutorialButton = ({url}:{ url: string }) => {
    
    /* Info Button */
    const icon = <Info size={15}/>
    const tooltip = "Learn how to use this component"
    const onClick = () => {
        window.open(url, "_blank")
    }
    
    return <ActionButton icon={icon} tooltip={tooltip} onClick={onClick} variant="link"/>
}

export default TutorialButton