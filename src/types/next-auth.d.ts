import 'next-auth';
import 'next-auth/jwt';
import 'next-auth/adapters';

declare module 'next-auth' {
  interface User {
    /** Last name / family name, extracted from OAuth profile. */
    lastName?: string | null;
    /** Set to true by authorize() when the user has MFA enabled (email/password login). */
    mfaPending?: boolean;
  }

  interface Session {
    /** Unix timestamp (seconds) when the JWT was issued. */
    iat?: number;
    /** True when the user still needs to complete MFA verification. */
    mfaPending?: boolean;
    /** The auth provider used for the current session ('credentials', 'google', 'azure-ad'). */
    provider?: string;
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    /** Last name / family name, extracted from OAuth profile. */
    lastName?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Unix timestamp (seconds) when the JWT was issued (set automatically by NextAuth). */
    iat?: number;
    /** True when the user still needs to complete MFA verification. */
    mfaPending?: boolean;
    /** The auth provider used for the current session ('credentials', 'google', 'azure-ad'). */
    provider?: string;
  }
}

