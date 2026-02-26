import 'next-auth';
import 'next-auth/jwt';
import 'next-auth/adapters';

declare module 'next-auth' {
  interface User {
    /** Last name / family name, extracted from OAuth profile. */
    lastName?: string | null;
  }

  interface Session {
    /** Unix timestamp (seconds) when the JWT was issued. */
    iat?: number;
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
  }
}

