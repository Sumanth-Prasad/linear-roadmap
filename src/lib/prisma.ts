import { PrismaClient } from "@prisma/client";

// Pick a connection URL.
// - In production (e.g. Vercel) we prefer the pooled connection string
//   to avoid exceeding the free-tier limit on Supabase (20 connections).
// - Locally we just use DATABASE_URL (non-pooled) for convenience.
const databaseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

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