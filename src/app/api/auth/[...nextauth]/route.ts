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
  debug: true, // Enable debug mode always to see detailed logs
  adapter: PrismaAdapter(prisma),
  useSecureCookies: process.env.NODE_ENV === "production",
  // Log environment variables detection for debugging
  logger: {
    error(code, ...message) {
      console.error(code, ...message);
    },
    warn(code, ...message) {
      console.warn(code, ...message);
    },
    debug(code, ...message) {
      console.log("NEXTAUTH DEBUG:", code, 
        `NEXTAUTH_URL=${process.env.NEXTAUTH_URL}`, 
        `NODE_ENV=${process.env.NODE_ENV}`, 
        ...message);
    }
  },
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
  // Remove custom pages that don't exist
  callbacks: {
    async signIn({ user, account, profile }) {
      // Always log the sign in attempt
      console.log("Sign in attempt for:", user?.email);
      
      // Always allow sign in - you can add restrictions here if needed
      return true;
    },
    async jwt({ token, user, account }) {
      try {
        // Initial sign in
        if (user) {
          token.id = user.id;
          token.email = user.email;
        }
        
        // Keep the access token from providers like Linear
        if (account?.provider === "linear") {
          token.linearAccessToken = account.access_token;
        }
        
        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        // Simple session with minimal data to avoid issues
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
        }
        
        // Keep Linear token in session if present
        if (token.linearAccessToken) {
          session.linearAccessToken = token.linearAccessToken as string;
          session.user.role = "developer";
        } else {
          session.user.role = "customer";
        }
        
        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        return session;
      }
    },
    async redirect({ url, baseUrl }) {
      // Log current redirect attempt for debugging
      console.log("NextAuth Redirect:", { 
        url, 
        baseUrl, 
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set' 
      });
      
      try {
        // For absolute URLs, first check if it's a callback URL with proper origin
        if (url.startsWith(baseUrl)) {
          return url;
        }
        
        // For relative URLs, prepend the base URL
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }
        
        // Default to homepage for safety
        return baseUrl;
      } catch (error) {
        console.error("Redirect callback error:", error);
        return baseUrl;
      }
    },
  },
  session: {
    // Use JWT strategy for simplicity
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Simplified cookie configuration
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
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
      // For debugging session issues - enabled temporarily
      console.log("Session updated:", message);
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 