export const AUTH_POPUP_SUCCESS_MESSAGE = 'unify.auth.popup.success';
export const AUTH_POPUP_ERROR_MESSAGE = 'unify.auth.popup.error';

export const AUTH_POPUP_PROVIDER_IDS = ['google', 'azure-ad'] as const;
export type AuthPopupProvider = (typeof AUTH_POPUP_PROVIDER_IDS)[number];

const STATIC_ALLOWED_OPENER_ORIGINS = [
  'https://usedroids.ai',
  'https://www.usedroids.ai',
  'https://unify.ai',
  'https://www.unify.ai',
  'https://staging.unify.ai',
  'https://internal.example.com',
  'http://localhost:3007',
];

export function isAuthPopupProvider(provider: string | null): provider is AuthPopupProvider {
  return AUTH_POPUP_PROVIDER_IDS.some((allowedProvider) => allowedProvider === provider);
}

export function allowedAuthPopupOpenerOrigin(
  rawOrigin: string | null,
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
): string | null {
  if (!rawOrigin) return null;

  try {
    const origin = new URL(rawOrigin).origin;
    const allowed = new Set(
      [...STATIC_ALLOWED_OPENER_ORIGINS, configuredSiteUrl].filter((value): value is string =>
        Boolean(value)
      )
    );

    return allowed.has(origin) ? origin : null;
  } catch {
    return null;
  }
}

export function safeAuthPopupCallbackUrl(
  rawCallbackUrl: string | null,
  currentOrigin: string
): string | null {
  try {
    const callbackUrl = new URL(rawCallbackUrl ?? '/auth/popup-complete', currentOrigin);

    if (callbackUrl.origin !== currentOrigin || callbackUrl.pathname !== '/auth/popup-complete') {
      return null;
    }

    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  } catch {
    return null;
  }
}

export function safeAuthPopupRedirectUrl(
  rawRedirectTo: string | null,
  currentOrigin: string
): string {
  try {
    const redirectUrl = new URL(rawRedirectTo ?? '/assistants', currentOrigin);

    if (redirectUrl.origin === currentOrigin) {
      return redirectUrl.toString();
    }
  } catch {
    // Fall through to the default console destination.
  }

  return new URL('/assistants', currentOrigin).toString();
}

export function authPopupErrorMessage(error: string | null): string {
  switch (error) {
    case 'AccessDenied':
      return 'Access was denied. Please try another account.';
    case 'OAuthAccountNotLinked':
      return 'This email is already registered with another sign-in method.';
    case 'StagingRestricted':
      return 'This staging environment is restricted to Unify members only.';
    default:
      return 'Sign in could not be completed. Please try again.';
  }
}
