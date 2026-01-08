import Image from 'next/image';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { providers } from '@/constants/endpoints';
import { Separator } from '@/components/UI/separator';

const MessageHeader = ({
  model,
  provider,
  content,
  cost,
}: {
  model: string;
  provider?: string;
  content: string;
  cost?: number;
}) => {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {provider && (
            <Tooltip content={`${model}@${provider}`}>
              <Image
                src={providers[provider]}
                alt={provider}
                width={20}
                height={20}
                className="min-w-6 cursor-default rounded-md bg-muted p-1"
              />
            </Tooltip>
          )}
          <div className="flex-col gap-2">
            <div className="font-semibold">{model}</div>
            {cost && (
              <div className="text-tiny text-muted-foreground">$ {cost.toExponential(2)}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2 pl-2">
          <CopyButton
            content={content}
            copyMessage="Copied!"
            tooltipContent="Copy message"
            className="h-5 w-5 p-1"
          />
        </div>
      </div>
      <Separator orientation="horizontal" className="mb-4" />
    </div>
  );
};

export default MessageHeader;
