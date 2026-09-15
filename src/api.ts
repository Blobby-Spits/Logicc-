import type { HealthResponse, Persona, ScenarioContextView, SessionSecret } from "./types.ts";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");
  return readJson<HealthResponse>(response);
}

export async function fetchPersonas(): Promise<{
  context: ScenarioContextView;
  personas: Persona[];
}> {
  const response = await fetch("/api/personas");
  return readJson(response);
}

export async function createSession(personaId: Persona["id"]): Promise<SessionSecret> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaId }),
  });
  return readJson<SessionSecret>(response);
}
