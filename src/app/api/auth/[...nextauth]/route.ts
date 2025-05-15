import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
      // Fetch the current viewer using GraphQL
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ query: "{ viewer { id name email } }" }),
      });

      const { data } = (await res.json()) as {
        data: { viewer: { id: string; name: string; email: string } };
      };

      return data.viewer;
    },
  },
  profile(profile: { id: string; name: string; email: string }) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: null,
    };
  },
};

export const authOptions: AuthOptions = {
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
    async jwt({ token, account }) {
      // Preserve the Linear access token so we can use it later
      if (account?.provider === "linear") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).linearAccessToken = (account as any).access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linearAccessToken = (token as any).linearAccessToken as string | undefined;
      // Add a role helper to session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).user.role = linearAccessToken ? "developer" : "customer";
      // Expose token for API calls (optional)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).linearAccessToken = linearAccessToken ?? null;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 