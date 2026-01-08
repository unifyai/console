import Image from 'next/image';
import { Endpoint } from '@/types/chat/endpoints';
import { providers } from '@/constants/endpoints';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/UI/dropdown-menu';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { EyeOff } from 'lucide-react';

const ChatPinning = ({
  endpoints,
  handlePinToggle,
  handleUnselectEndpoint,
  isEndpointPinned,
}: {
  endpoints: Endpoint[];
  handlePinToggle: (endpoint: Endpoint) => void;
  handleUnselectEndpoint: (endpoint: Endpoint) => void;
  isEndpointPinned: (endpoint: Endpoint) => boolean;
}) => {
  return (
    <div className="flex gap-6">
      {endpoints.map((endpoint, index) => (
        <DropdownMenu key={index}>
          {/* Wrap the icon with Tooltip */}
          <Tooltip content={`${endpoint.code}@${endpoint.provider}`}>
            <DropdownMenuTrigger asChild>
              <div
                className={`relative cursor-pointer rounded-lg border bg-muted p-1 ${
                  !isEndpointPinned(endpoint) ? 'opacity-30' : ''
                }`}
              >
                <Image
                  src={providers[endpoint.provider]}
                  alt={endpoint.provider}
                  width={20}
                  height={20}
                  className="min-w-4"
                />
                {/* Overlay an EyeOff icon if unpinned */}
                {!isEndpointPinned(endpoint) && (
                  <EyeOff className="absolute right-1 top-1 h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuLabel>{`${endpoint.code}@${endpoint.provider}`}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handlePinToggle(endpoint)}>
              {isEndpointPinned(endpoint) ? 'Hide' : 'Show'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUnselectEndpoint(endpoint)}>
              Deselect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
};

export default ChatPinning;
