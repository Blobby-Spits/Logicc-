import type { AppMode, Catalog, ComposePayload, HealthResponse, PersonaId, SessionSecret, TraineeRole } from "./types.ts";

export interface SessionRequest {
  personaId: PersonaId;
  scenarioId: string;
  traineeRole: TraineeRole;
  difficulty: number;
  mode: AppMode;
  opening?: boolean;
  transfer?: boolean;
}

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

export async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch("/api/catalog");
  return readJson<Catalog>(response);
}

export async function composePrompt(body: SessionRequest): Promise<ComposePayload> {
  const response = await fetch("/api/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<ComposePayload>(response);
}

export async function createSession(body: SessionRequest): Promise<SessionSecret> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<SessionSecret>(response);
}
