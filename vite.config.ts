import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { createApiContext } from "./server/env.ts";
import { logiccApiPlugin } from "./server/vite-plugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ctx = createApiContext({ ...process.env, ...env });

  return {
    plugins: [logiccApiPlugin(ctx)],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  };
});
