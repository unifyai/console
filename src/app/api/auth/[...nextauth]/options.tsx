import pagesOptions from './pages';
import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { OrchestraAdapter } from '@/lib/orchestra/orchestra-adapter';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const hostName = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').hostname;

const authOptions: AuthOptions = {
  ...pagesOptions,
  // @ts-ignore
  adapter: OrchestraAdapter(),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: hostName == 'localhost' ? hostName : '.' + hostName.split('.').splice(1).join('.'),
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          accessType: 'offline',
          responseType: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/userinfo.profile',
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.given_name ?? profile.name ?? null,
          lastName: profile.family_name ?? null,
          image: profile.picture ?? null,
        };
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      profile(profile) {
        // GitHub provides a single "name" field (display name).
        // Split on the first space to approximate first / last name.
        const fullName = profile.name ?? profile.login ?? '';
        const spaceIdx = fullName.indexOf(' ');
        const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName;
        const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : null;

        return {
          id: profile.id.toString(),
          email: profile.email,
          name: firstName || null,
          lastName: lastName,
          image: profile.avatar_url ?? null,
        };
      },
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await OrchestraAdminClient.post('/auth/authenticate', {
            email: credentials.email,
            password: credentials.password,
          });

          if (res.data?.id) {
            return {
              id: res.data.id,
              email: res.data.email,
              name: res.data.name,
              image: res.data.image ?? null,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  secret: process.env.JWT_SECRET,
  theme: {
    colorScheme: 'light',
    brandColor: '#36a836',
    logo: '@/console/static/ivy_logo_only.png',
  },
  callbacks: {
    /**
     * The `redirect` callback is called when a redirect is required, either
     * due to an OAuth callback or a redirect from a login form. The
     * callback is passed the `url` and `baseUrl` of the request, and should
     * return the URL to redirect to. The `baseUrl` is the base URL of the
     * NextAuth.js API, and can be used to construct a new URL.
     *
     * This callback allows relative callback URLs to be used. If the `url`
     * starts with a `/`, it is treated as a relative URL and the `baseUrl`
     * is prepended to it.
     *
     * }
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // Malformed URL — fall through to baseUrl
      }
      return baseUrl;
    },

    /**
     * The `jwt` callback is called after a user is authenticated. The
     * callback is passed the `token` and `profile` of the user, and should
     * return a new JWT. The `token` is the user's JWT, and the `profile` is
     * the user's profile information from the OAuth provider.
     *
     * This callback allows the JWT to be modified or extended with
     * additional information. The `token` is the base JWT, and any
     * additional information should be added to it.
     *
     */
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && !token.picture) {
        try {
          const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { Authorization: `Bearer ${account.accessToken}` },
          });
          const data = await response.json();
          if (data.picture) {
            token.picture = data.picture;
          } else {
            console.log('Google profile picture not found');
            token.picture = null;
          }
        } catch (error) {
          console.error('Error fetching Google profile picture:', error);
          token.picture = null;
        }
      } else if (account?.provider === 'github') {
        if (profile && typeof profile === 'object' && 'avatar_url' in profile) {
          if (typeof profile.avatar_url === 'string') {
            token.picture = profile.avatar_url;
          } else {
            token.picture = null;
          }
        } else {
          token.picture = null;
        }
      }
      return token;
    },

    /**
     * The `session` callback is called when a session is created or updated.
     * The callback is passed the `session` and `token` of the user, and should
     * return the updated session.
     *
     * This callback allows the session to be modified or extended with
     * additional information. The `session` is the base session, and any
     * additional information should be added to it.
     *
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture || null;
      }
      // Expose the JWT issued-at timestamp so getCurrentUser() can compare it
      // against password_changed_at for session invalidation.
      if (token.iat) {
        session.iat = token.iat;
      }
      return session;
    },
  },
};

export default authOptions;
