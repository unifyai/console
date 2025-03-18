"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { Snowflake, LoaderCircle } from "lucide-react";
import { ItemType, TileProps } from "@/types/evals/grid";
import { useEffect, useState } from "react";

const FreezeLogs = ({ item, updateItem, data }: {
    item: TileProps,
    data: any[],
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setLoading(false);
    },[data])
    
    const onClick = () => {
        setLoading(true)
        if (item.freeze) {
            setSpinnerColor("primary")
            updateItem(item, "freeze")("")
        } else {
            setSpinnerColor("white")
            const cutoff = new Date().toISOString().replace("T", " ").replace("Z", "")
            updateItem(item, "freeze")(cutoff)
        }
    }
    const variant = item.freeze ? "primary" : "outline"
    const tooltip = item.freeze ? `Get latest logs. (Current freeze: ${item.freeze})` : "Only get logs before freeze"
    const icon = loading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Snowflake/>
    return (
        <ActionButton variant={variant} tooltip={tooltip} icon={icon} onClick={onClick}/>
    );
}

export default FreezeLogs;