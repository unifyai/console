import { Textarea } from '../../UI/textarea';
import { Label } from '../../UI/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Info } from 'lucide-react';
import * as React from 'react';

interface UserInfoProps {
  bio: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onPrem: string | undefined;
}

const BIO_MAX_ROWS = 3;
const BIO_LINE_HEIGHT = 20;
const BIO_PADDING = 16;
const BIO_MAX_HEIGHT = BIO_MAX_ROWS * BIO_LINE_HEIGHT + BIO_PADDING;

const UserInfo = React.memo(function UserInfo({
  bio,
  handleInputChange,
  onPrem,
}: UserInfoProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';

    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > BIO_MAX_HEIGHT) {
      textarea.style.height = `${BIO_MAX_HEIGHT}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [bio]);

  return (
    <div className="profile-form tutorial-user-information">
      <div className="text-body flex flex-col gap-4">
        <div>
          <div className="flex flex-row items-center gap-2 pb-1">
            <Label>About</Label>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-caption max-w-xs">
                  <p>
                    You can edit this field anytime. Your assistant(s) will also update it as they
                    learn more about you.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            ref={textareaRef}
            name="bio"
            rows={1}
            value={bio}
            className="styled-scrollbar w-full min-h-0 resize-none"
            onChange={handleInputChange}
            readOnly={Boolean(onPrem)}
          />
        </div>
      </div>
    </div>
  );
});

export default UserInfo;
