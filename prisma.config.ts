import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma.config.ts controls Prisma CLI connections (migrate, studio, introspect).
// Runtime connections are handled separately in lib/prisma.ts via @prisma/adapter-pg.
//
// For Neon (production):
//   DATABASE_URL  = pooled connection string (pgBouncer, port 5432 ending in ?sslmode=require)
//   DIRECT_URL    = direct connection string  (no pgBouncer, port 5432 with -pooler removed)
//
// Migrations must go through DIRECT_URL because pgBouncer (transaction mode) blocks
// the advisory locks that prisma migrate deploy relies on.
//
// For local dev, only DATABASE_URL is needed — DIRECT_URL falls back to it.

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
