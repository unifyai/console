import Image from "next/image";
import { Pin } from "lucide-react";
import { Endpoint } from "@/types/chat/endpoints";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { providers } from "@/constants/endpoints";

const ChatPinning = ({ endpoints, side, pinTooltipContent, handleClick }: { endpoints: Endpoint[], side: "left" | "right", pinTooltipContent: string, handleClick: (endpoint: Endpoint) => void }) => {
    return (
        <div className={"w-1/2 flex gap-3" + (side == "right" ? " justify-end" : "")}>
            {endpoints.map((endpoint, index) => (
                <div key={index} className="relative my-1">
                    <div className="absolute -top-2 -left-2 rounded-md hover:bg-secondary transition-colors">
                        <Tooltip content={pinTooltipContent}>
                            <Pin
                                size={14}
                                className={side == "right" ? "text-primary" : ""}
                                onClick={() => handleClick(endpoint)}
                            />
                        </Tooltip>
                    </div>
                    <Tooltip content={`${endpoint.code}@${endpoint.provider}`}>
                        <div className="p-1 border-1 rounded-lg">
                            <Image
                                src={providers[endpoint.provider]}
                                alt={endpoint.provider}
                                width={20}
                                height={20}
                                className="min-w-4"
                            />
                        </div>
                    </Tooltip>
                </div>
            ))}
        </div>
    )
};

export default ChatPinning;
