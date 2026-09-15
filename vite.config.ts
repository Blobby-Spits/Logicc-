import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { logiccApiPlugin } from "./server/vite-plugin.ts";
import { DEFAULT_REALTIME_MODEL, DEFAULT_REASONING_EFFORT } from "./server/session.ts";
import type { ReasoningEffort } from "./server/types.ts";
import { REASONING_EFFORTS } from "./server/types.ts";

function parseEffort(value: string | undefined): ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const model = env.OPENAI_REALTIME_MODEL ?? process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL;
  const reasoningEffort = parseEffort(env.OPENAI_REASONING_EFFORT ?? process.env.OPENAI_REASONING_EFFORT);

  return {
    plugins: [logiccApiPlugin({ apiKey, model, reasoningEffort })],
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
