"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";
import { Checkbox } from "@/components/UI/checkbox";
import { Endpoint } from "@/types/chat/endpoints";
import { CheckedState } from "@radix-ui/react-checkbox";

const SelectEndpoint = ({ selectedEndpoints, setSelectedEndpoints, endpoint, maxSelectable }: {
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: React.Dispatch<React.SetStateAction<Endpoint[]>>,
    endpoint: Endpoint,
    maxSelectable: number
}) => {
    const id = `${endpoint.code}@${endpoint.provider}`;
    const isSelected = selectedEndpoints.some(ep => ep.code === endpoint.code && ep.provider === endpoint.provider);
    const disabled = !isSelected && selectedEndpoints.length >= maxSelectable;

    const onCheckedChange = (value: CheckedState) => {
        if (value) {
            setSelectedEndpoints([...selectedEndpoints, endpoint]);
        } else {
            setSelectedEndpoints(selectedEndpoints.filter(
                ep => !(ep.code === endpoint.code && ep.provider === endpoint.provider)
            ));
        }
    };

    const tooltip = disabled 
        ? `You can only select up to ${maxSelectable} endpoints` 
        : isSelected
            ? "Unselect endpoint"
            : "Select endpoint";

    return (
        <Tooltip content={tooltip}>
            <Checkbox 
                id={id} 
                checked={isSelected} 
                onCheckedChange={onCheckedChange} 
                disabled={disabled} 
                aria-label={`Select ${id}`} 
            />
        </Tooltip>
    );
};

export default SelectEndpoint;