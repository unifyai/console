import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    /** Unix timestamp (seconds) when the JWT was issued. */
    iat?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Unix timestamp (seconds) when the JWT was issued (set automatically by NextAuth). */
    iat?: number;
  }
}

