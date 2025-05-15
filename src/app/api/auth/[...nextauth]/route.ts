import NextAuth, { type AuthOptions, type Session, type User, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Extend the built-in session types to include our custom fields
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
    linearAccessToken?: string | null;
  }
  
  interface User {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  }
}

// Extend JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    linearAccessToken?: string;
    linearTokenType?: string;
    linearProviderAccountId?: string;
  }
}

// Custom Linear OAuth provider (not included in NextAuth by default)
const LinearProvider: OAuthConfig<any> = {
  id: "linear",
  name: "Linear",
  type: "oauth",
  clientId: process.env.LINEAR_CLIENT_ID!,
  clientSecret: process.env.LINEAR_CLIENT_SECRET!,
  authorization: {
    url: "https://linear.app/oauth/authorize",
    params: { scope: "read,write" },
  },
  token: "https://api.linear.app/oauth/token",
  userinfo: {
    url: "https://api.linear.app/graphql",
    async request({ tokens }) {
      try {
        // Fetch the current viewer using GraphQL
        const res = await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokens.access_token}`,
          },
          body: JSON.stringify({ query: "{ viewer { id name email } }" }),
        });

        if (!res.ok) {
          console.error("Linear API error:", await res.text());
          throw new Error(`Linear API error: ${res.status}`);
        }

        const response = await res.json();
        if (response.errors) {
          console.error("GraphQL errors:", response.errors);
          throw new Error(`GraphQL errors: ${response.errors[0]?.message}`);
        }

        return response.data.viewer;
      } catch (error) {
        console.error("Linear userinfo error:", error);
        throw error;
      }
    },
  },
  profile(profile: { id: string; name: string; email: string }) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: undefined,
    };
  },
};

export const authOptions: AuthOptions = {
  debug: process.env.NODE_ENV === "development",
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER || "",
      from: process.env.EMAIL_FROM || "noreply@example.com",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name } as any;
      }
    }),
    LinearProvider,
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("Sign in attempt:", { 
        provider: account?.provider, 
        userId: user?.id,
        email: user?.email 
      });
      return true;
    },
    async jwt({ token, account, user }) {
      // Keep the initial token info
      if (user) {
        token.id = user.id;
      }
      
      // Preserve the Linear access token so we can use it later
      if (account?.provider === "linear") {
        token.linearAccessToken = account.access_token;
        token.linearTokenType = account.token_type;
        token.linearProviderAccountId = account.providerAccountId;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      
      // Add a role helper to session
      session.user.role = token.linearAccessToken ? "developer" : "customer";
      
      // Expose token for API calls (optional)
      session.linearAccessToken = token.linearAccessToken as string || null;
      
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    error(code, ...message) {
      console.error(code, ...message);
    },
    warn(code, ...message) {
      console.warn(code, ...message);
    },
    debug(code, ...message) {
      console.log(code, ...message);
    },
  },
  events: {
    async signIn(message) {
      console.log("User signed in:", message);
    },
    async signOut(message) {
      console.log("User signed out:", message);
    },
    async createUser(message) {
      console.log("User created:", message);
    },
    async linkAccount(message) {
      console.log("Account linked:", message);
    },
    async session(message) {
      // Uncomment for detailed session debug (can be noisy)
      // console.log("Session updated:", message);
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 