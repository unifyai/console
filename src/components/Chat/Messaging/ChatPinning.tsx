import Image from "next/image";
import { CircleX, Pin } from "lucide-react";
import { Endpoint } from "@/types/chat/endpoints";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { providers } from "@/constants/endpoints";

const ChatPinning = ({ endpoints, side, handlePinToggle, handleUnselect }: {
    endpoints: Endpoint[],
    side: "left" | "right",
    handlePinToggle: (endpoint: Endpoint) => void,
    handleUnselect: (endpoint: Endpoint) => void
}) => {
    return (
        <div className={"w-1/2 flex gap-6" + (side === "right" ? " justify-end" : "")}>
            {endpoints.map((endpoint, index) => (
                <div key={index} className="relative my-1">
                    <Tooltip content="Toggle pin">
                        <Pin
                            size={14}
                            className={
                                "absolute -top-2 -left-2 rounded-full hover:bg-secondary hover:text-white transition-colors cursor-pointer " +
                                (side === "right" ? "text-primary" : "")
                            }
                            onClick={() => handlePinToggle(endpoint)}
                        />
                    </Tooltip>
                    <Tooltip content="Deselect endpoint">
                        <CircleX
                            size={14}
                            onClick={() => handleUnselect(endpoint)}
                            className="absolute -top-2 -right-2 rounded-full text-destructive hover:bg-destructive hover:text-white transition-colors cursor-pointer"
                        />
                    </Tooltip>
                    <Tooltip content={`${endpoint.code}@${endpoint.provider}`}>
                        <div className="p-1 border-1 rounded-lg bg-muted">
                            <Image
                                src={providers[endpoint.provider]}
                                alt={endpoint.provider}
                                width={20}
                                height={20}
                                className="min-w-4 cursor-default"
                            />
                        </div>
                    </Tooltip>
                </div>
            ))}
        </div>
    );
};

export default ChatPinning;