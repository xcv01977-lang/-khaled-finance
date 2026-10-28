import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Booting an in-memory Postgres takes a few seconds, more when the files run in parallel.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 },
});
