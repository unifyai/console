type DroidIconProps = {
  className?: string;
};

/** Small UI glyph: cuboidal droid head with antenna. */
export function DroidIcon({ className }: DroidIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={9.5} cy={3.3} r={1.1} />
      <rect x={8.9} y={4.1} width={1.2} height={2.4} />
      <path
        clipRule="evenodd"
        d="M3.5 6.5h12v12.5h-12ZM6 10.5h2.5v2.5H6ZM10.5 10.5h2.5v2.5h-2.5Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Droid head with a plus badge for onboard / hire actions. */
export function DroidOnboardIcon({ className }: DroidIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={9.5} cy={3.3} r={1.1} />
      <rect x={8.9} y={4.1} width={1.2} height={2.4} />
      <path
        clipRule="evenodd"
        d="M3.5 6.5h12v12.5h-12ZM6 10.5h2.5v2.5H6ZM10.5 10.5h2.5v2.5h-2.5Z"
        fillRule="evenodd"
      />
      <path
        d="M20.2 1.4v4.8M22.6 3.8h-4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  );
}
