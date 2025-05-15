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

// Override the auth method for Linear provider to use fixed production URL
const createLinearProvider = () => {
  // Add debugging for Linear provider creation
  console.log("Creating Linear provider with forced production callback URL");
  
  return {
    id: "linear",
    name: "Linear",
    type: "oauth",
    clientId: process.env.LINEAR_CLIENT_ID!,
    clientSecret: process.env.LINEAR_CLIENT_SECRET!,
    authorization: {
      url: "https://linear.app/oauth/authorize",
      params: { 
        scope: "read,write",
        // Force a specific callback URL that matches what's configured in Linear
        redirect_uri: "https://linear-roadmap-next.vercel.app/api/auth/callback/linear" 
      },
    },
    checks: ["pkce", "state"],
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
  } as OAuthConfig<any>;
};

// Create the Linear provider with fixed production URL
const ModifiedLinearProvider = createLinearProvider();

// Ensure that NEXTAUTH_URL environment is explicitly referenced near the top
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || (
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
  'http://localhost:3000'
);

// Configure the proper base URL for Linear OAuth
// Linear doesn't accept localhost URLs, so for development we must use a production URL
// or implement a proxy solution like ngrok
const getProperCallbackUrl = (provider: string) => {
  // Always use the production URL for Linear
  if (provider === 'linear') {
    return 'https://linear-roadmap-next.vercel.app/api/auth/callback/linear';
  }
  
  // For other providers, follow the environment
  return `${NEXTAUTH_URL}/api/auth/callback/${provider}`;
};

console.log("NextAuth initialization with URL:", NEXTAUTH_URL);
console.log("Linear callback URL:", getProperCallbackUrl('linear'));

export const authOptions: AuthOptions = {
  debug: true, // Enable debug mode always to see detailed logs
  adapter: PrismaAdapter(prisma),
  useSecureCookies: process.env.NODE_ENV === "production",
  // Log environment variables detection for debugging
  logger: {
    error(code, ...message) {
      console.error("NEXTAUTH ERROR:", code, ...message);
    },
    warn(code, ...message) {
      console.warn("NEXTAUTH WARN:", code, ...message);
    },
    debug(code, ...message) {
      console.log("NEXTAUTH DEBUG:", code, 
        `NEXTAUTH_URL=${NEXTAUTH_URL}`, 
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
    ModifiedLinearProvider,
  ],
  // Remove custom pages that don't exist
  callbacks: {
    async signIn({ user, account, profile }) {
      // Log sign in attempts with provider info
      console.log("Sign in attempt:", { 
        provider: account?.provider, 
        email: user?.email,
        baseUrl: NEXTAUTH_URL
      });
      
      // Special handling for Linear (for debugging purposes)
      if (account?.provider === 'linear') {
        console.log("Linear account:", { 
          accessToken: account.access_token ? 'present' : 'missing',
          params: account.providerAccountId ? 'present' : 'missing'
        });
      }
      
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
      // Force the baseUrl to be the NEXTAUTH_URL value for consistent callbacks
      const forcedBaseUrl = NEXTAUTH_URL;
      
      console.log("NextAuth Redirect:", { 
        url, 
        originalBaseUrl: baseUrl,
        forcedBaseUrl,
        NEXTAUTH_URL,
        isCallbackUrl: url.includes('/api/auth/callback/')
      });
      
      // Special case for OAuth callbacks - always allow these
      if (url.includes('/api/auth/callback/')) {
        console.log("Allowing OAuth callback URL:", url);
        return url;
      }
      
      // Default strategy: allow relative URLs and same-origin absolute URLs
      if (url.startsWith("/")) {
        const fullUrl = `${forcedBaseUrl}${url}`;
        console.log("Redirecting to relative URL:", fullUrl);
        return fullUrl;
      }
      
      // Try to parse the URL (with error handling)
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(forcedBaseUrl);
        
        // If same origin, allow the redirect
        if (urlObj.origin === baseUrlObj.origin) {
          console.log("Redirecting to same-origin URL:", url);
          return url;
        }
      } catch (e) {
        console.error("Error parsing URL in redirect callback:", e);
      }
      
      // Default fallback to base URL
      console.log("Fallback redirect to base URL:", forcedBaseUrl);
      return forcedBaseUrl;
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