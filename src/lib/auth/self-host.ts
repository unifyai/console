/** True when Console runs in a local self-host install (not dev seeds). */
export const IS_SELF_HOST =
  process.env.SELF_HOST === '1' || process.env.NEXT_PUBLIC_SELF_HOST === '1';
