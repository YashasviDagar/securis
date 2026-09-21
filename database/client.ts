import { PrismaClient } from "@prisma/client";

/**
 * Securis - Prisma Client singleton
 *
 * Next.js hot-reloads modules during development, and each reload would
 * otherwise construct a brand new PrismaClient (and a new connection pool),
 * quickly exhausting database connections.
 *
 * The global object is used as a cache that survives module reloads. In
 * production the client is created exactly once per server process.
 *
 * Connection: reads DATABASE_URL from the environment (see .env.example) and
 * talks to PostgreSQL (local Prisma Postgres in development, Neon in
 * production). Every service in server/services/** imports this instance.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Surface slow/erroneous queries in development, stay quiet in production.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
