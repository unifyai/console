import Image from "next/image";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { providers } from "@/constants/endpoints";

const MessageHeader = ({ model, provider, content, cost }: {
    model: string, provider?: string, content: string, cost?: number
}) => {
    return (<div className="flex justify-between items-center mb-2">
        <div className="flex gap-2 items-center">
            {provider && <Tooltip content={provider}>
                <Image
                    src={providers[provider]}
                    alt={provider}
                    width={20}
                    height={20}
                    className="min-w-6 p-1 rounded-md bg-muted"
                />
            </Tooltip>}
            <div className="flex-col gap-2">
                <div className="font-semibold">{model}</div>
                {cost && <div className="text-tiny text-muted-foreground">$ {cost.toExponential(2)}</div>}
            </div>
        </div>
        <div className="flex gap-2">
            <CopyButton
                content={content}
                copyMessage="Copied!"
                tooltipContent="Copy message"
                className="h-5 w-5"
            />
        </div>
    </div>);
};

export default MessageHeader;
