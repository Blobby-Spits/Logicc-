import type { ApiContext } from "./http.ts";
import { DEFAULT_REALTIME_MODEL, DEFAULT_REASONING_EFFORT } from "./session.ts";
import { REASONING_EFFORTS, type ReasoningEffort } from "./types.ts";

export function parseReasoningEffort(value: string | undefined): ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

export function createApiContext(env: Record<string, string | undefined> = process.env): ApiContext {
  return {
    apiKey: env.OPENAI_API_KEY ?? "",
    model: env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL,
    reasoningEffort: parseReasoningEffort(env.OPENAI_REASONING_EFFORT),
  };
}
