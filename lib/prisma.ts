import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizePostgresUrlForPg } from "@/lib/postgres-url";

// This app uses Prisma v7 driver adapters (required — datasource has no url in schema.prisma).
// @prisma/adapter-pg wraps a pg.Pool and passes it to PrismaClient.
//
// DATABASE_URL should be the pooled Neon connection string in production.
// The global cache applies in all environments so Vercel warm function instances
// reuse the existing Pool rather than creating a new one per request.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: normalizePostgresUrlForPg(process.env.DATABASE_URL),
    // Keep the pool small for serverless — Neon's pgBouncer handles connection
    // multiplexing on its side, so a large Node-side pool buys nothing and
    // exhausts Neon's connection limits faster.
    max: 1,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache in all environments — Vercel warm instances reuse the same module,
// so this prevents a new Pool + client on every request.
globalForPrisma.prisma = prisma;
