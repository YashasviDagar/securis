import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Securis - Vitest configuration
 *
 * Tests run in a Node environment with the `@/` path alias resolved to the
 * project root, matching tsconfig.json.
 *
 * Important: the local development database (Prisma Postgres / PGlite) accepts a
 * single connection, so DB-backed tests must not run in parallel. The config
 * therefore disables file parallelism and pins the pool to a single fork.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The embedded database allows one connection at a time.
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
