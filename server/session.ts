import type { PersonaPublic, ReasoningEffort, RealtimeSessionConfig } from "./types.ts";

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";
export const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export function buildRealtimeSessionConfig(options: {
  instructions: string;
  voice: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}): RealtimeSessionConfig {
  return {
    type: "realtime",
    model: options.model,
    instructions: options.instructions,
    output_modalities: ["audio"],
    reasoning: { effort: options.reasoningEffort },
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
        transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
        turn_detection: { type: "semantic_vad" },
      },
      output: {
        format: { type: "audio/pcm" },
        voice: options.voice,
      },
    },
  };
}

export interface ClientSecretResult {
  value: string;
  expiresAt: number | null;
  model: string;
  personaId: string;
  reasoningEffort: ReasoningEffort;
}

function extractSecret(payload: Record<string, unknown>): { value: string; expiresAt: number | null } {
  const nested = payload.client_secret;
  if (typeof payload.value === "string" && payload.value.startsWith("ek_")) {
    return {
      value: payload.value,
      expiresAt: typeof payload.expires_at === "number" ? payload.expires_at : null,
    };
  }
  if (nested && typeof nested === "object") {
    const secret = nested as Record<string, unknown>;
    if (typeof secret.value === "string") {
      return {
        value: secret.value,
        expiresAt: typeof secret.expires_at === "number" ? secret.expires_at : null,
      };
    }
  }
  throw new Error("OpenAI lieferte kein Ephemeral-Token (ek_…).");
}

export async function mintClientSecret(options: {
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  persona: PersonaPublic;
  instructions: string;
  safetyIdentifier: string;
}): Promise<ClientSecretResult> {
  const session = buildRealtimeSessionConfig({
    instructions: options.instructions,
    voice: options.persona.voice,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
  });
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": options.safetyIdentifier,
    },
    body: JSON.stringify({ session }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = payload.error;
    const message =
      err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : `OpenAI client_secrets: HTTP ${response.status}`;
    throw new Error(message);
  }

  const secret = extractSecret(payload);
  return {
    ...secret,
    model: options.model,
    personaId: options.persona.id,
    reasoningEffort: options.reasoningEffort,
  };
}
