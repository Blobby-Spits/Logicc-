import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { logiccApiPlugin } from "./server/vite-plugin.ts";
import { DEFAULT_REALTIME_MODEL } from "./server/session.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const model = env.OPENAI_REALTIME_MODEL ?? process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL;

  return {
    plugins: [logiccApiPlugin({ apiKey, model })],
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
