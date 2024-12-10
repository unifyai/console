"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { Checkbox } from "@/components/UI/checkbox";
import { Endpoint } from "@/types/chat/endpoints";
import { Options } from "nuqs";
import { CheckedState } from "@radix-ui/react-checkbox";
import { useQueryState } from "nuqs";

const SelectEndpoint = ({selectedEndpoints, setSelectedEndpointsParam, endpoint, maxSelectable}: {
    selectedEndpoints: string[], 
    setSelectedEndpointsParam: (value: string | ((old: string | null) => string | null) | null, options?: Options) => Promise<URLSearchParams>
    endpoint: Endpoint,
    maxSelectable: number
}) => {

    const [, setLastSelectedEndpointParam] = useQueryState("lastSelected");
    const id = `${endpoint.code}@${endpoint.provider}`
    const disabled = selectedEndpoints.length === 8 && !selectedEndpoints.includes(id)
    const checked = selectedEndpoints.includes(id)
    const onCheckedChange = (value: CheckedState) => {
        if (value) {
            setSelectedEndpointsParam([...selectedEndpoints, id].join(","));
            setLastSelectedEndpointParam(id)
        }
        else {
            const newSelectedEndpoints = selectedEndpoints.filter( endpoint => endpoint != id );
            setSelectedEndpointsParam(newSelectedEndpoints.length ? newSelectedEndpoints.join(",") : null);
        }
    }
    
    const tooltip = disabled 
        ? `You can only select up to ${maxSelectable} endpoints` 
        :  checked
            ? "Unselect endpoint"
            : "Select endpoint"

    return (
        <Tooltip content={tooltip}>
            <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}aria-label={`Select ${id}`}/>
        </Tooltip>
    )
}

export default SelectEndpoint;
