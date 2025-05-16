import { PrismaClient } from "@prisma/client";

// Pick a connection URL.
// - In production (e.g. Vercel) we prefer the pooled connection string
//   to avoid exceeding the free-tier limit on Supabase (20 connections).
// - Locally we just use DATABASE_URL (non-pooled) for convenience.
const rawUrl =
  process.env.NODE_ENV === "production"
    ? process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

// Ensure PgBouncer params are present so Prisma disables prepared statements
const databaseUrl = (() => {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;
    if (!params.has("pgbouncer")) params.append("pgbouncer", "true");
    if (!params.has("connection_limit")) params.append("connection_limit", "1");
    return url.toString();
  } catch {
    return rawUrl; // fallback if parsing fails
  }
})();

// Prevent multiple instances of Prisma Client in development / hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
} 