import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/UI/button';

interface OlderMessagesBannerProps {
  onJumpToPresent: () => void;
}

export function OlderMessagesBanner({ onJumpToPresent }: OlderMessagesBannerProps) {
  return (
    <div
      className="bg-muted/80 sticky bottom-0 z-10 flex items-center justify-center py-1.5 backdrop-blur-sm"
      data-testid="older-messages-banner"
    >
      <Button
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onJumpToPresent}
        data-testid="jump-to-present-button"
      >
        <ArrowDown className="h-3 w-3" />
        Jump to Present
      </Button>
    </div>
  );
}
