import { cn } from '@/lib/utils';

interface CoordinatorLogoAvatarProps {
  className?: string;
  logoClassName?: string;
}

export function CoordinatorLogoAvatar({ className, logoClassName }: CoordinatorLogoAvatarProps) {
  return (
    <span
      data-testid="coordinator-logo-avatar"
      className={cn(
        'flex items-center justify-center rounded-md border bg-background text-primary shadow-sm',
        className
      )}
      aria-label="Unity"
      role="img"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('h-4 w-4', logoClassName)}
      >
        <path
          d="M11.6156 0C8.03794 0 5.12676 2.87899 5.12676 6.41831C5.12676 9.2584 7.46249 11.5687 10.3338 11.5687C12.4982 11.5687 14.259 9.82706 14.259 7.6862C14.259 6.24457 13.0731 5.07155 11.6156 5.07155C10.5111 5.07155 9.61288 5.95998 9.61288 7.05252C9.61288 7.79652 10.2228 8.39982 10.975 8.39982C11.0973 8.39982 11.2153 8.38383 11.3279 8.35398C11.1113 8.66843 10.7465 8.87521 10.3338 8.87521C8.96469 8.87521 7.85044 7.77307 7.85044 6.41885C7.85044 4.36539 9.5396 2.69459 11.6156 2.69459C14.3986 2.69459 16.6626 4.93405 16.6626 7.68673C16.6626 11.1386 13.8237 13.9468 10.3338 13.9468C6.13757 13.9468 2.72368 10.57 2.72368 6.41938C2.72368 5.90988 2.76894 5.40358 2.85676 4.9058H0.101296C0.0344837 5.40624 0 5.91148 0 6.41938C0 12.0559 4.63591 16.6414 10.3343 16.6414C15.3259 16.6414 19.3869 12.6245 19.3869 7.68727C19.3863 3.44818 15.9008 0 11.6156 0Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
