import pagesOptions from "./pages";
import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import { OrchestraAdapter } from "@/lib/orchestra/orchestra-adapter";
import { getUserByEmail } from "@/lib/user/user";

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const hostName = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000").hostname;

const authOptions: AuthOptions = {
    ...pagesOptions,
    // @ts-ignore
    adapter: OrchestraAdapter(),
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    cookies: {
        sessionToken:
        {
            name: `${cookiePrefix}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                domain: hostName == "localhost" ? hostName : "." + hostName.split(".").splice(1).join(".")
            }
        },
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_ID!,
            clientSecret: process.env.GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: true
        }),
        GithubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
            allowDangerousEmailAccountLinking: true 
        }),
    ],
    secret: process.env.JWT_SECRET,
    theme: {
        colorScheme: "light",
        brandColor: "#36a836",
        logo: "@/console/static/ivy_logo_only.png",
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
            // Allows relative callback URLs
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            return url;
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
        async jwt({ token, profile }) {
            if (profile) {
                token.email = profile.email;
                token.name = profile.name;
                token.picture = profile.image;
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
            if (session.user && token && token.email) {
                session.user.email = token.email;
                session.user.image = token.picture as string;
                session.user.name = token.name;
            }
            return session;
        },
        }
};

export default authOptions;