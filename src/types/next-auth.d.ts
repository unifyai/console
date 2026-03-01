import 'next-auth';
import 'next-auth/jwt';
import 'next-auth/adapters';

declare module 'next-auth' {
  interface User {
    /** Last name / family name, extracted from OAuth profile. */
    lastName?: string | null;
    /** Set to true by authorize() when the user has MFA enabled (email/password login). */
    mfaPending?: boolean;
    /** Current onboarding step from backend. 'completed' means fully onboarded. */
    onboardingStep?: string;
  }

  interface Session {
    /** Unix timestamp (seconds) when the JWT was issued. */
    iat?: number;
    /** True when the user still needs to complete MFA verification. */
    mfaPending?: boolean;
    /**
     * Current onboarding step. Present only when the user hasn't finished
     * onboarding (i.e. step !== 'completed'). The middleware redirects to
     * /login/onboarding when this is set.
     */
    onboardingStep?: string;
    /** The auth provider used for the current session ('credentials', 'google', 'azure-ad'). */
    provider?: string;
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    /** Last name / family name, extracted from OAuth profile. */
    lastName?: string | null;
    /** Current onboarding step from backend. 'completed' means fully onboarded. */
    onboardingStep?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Unix timestamp (seconds) when the JWT was issued (set automatically by NextAuth). */
    iat?: number;
    /** True when the user still needs to complete MFA verification. */
    mfaPending?: boolean;
    /**
     * Current onboarding step. Present only when the user hasn't finished
     * onboarding (i.e. step !== 'completed'). The middleware redirects to
     * /login/onboarding when this is set.
     */
    onboardingStep?: string;
    /** The auth provider used for the current session ('credentials', 'google', 'azure-ad'). */
    provider?: string;
  }
}
