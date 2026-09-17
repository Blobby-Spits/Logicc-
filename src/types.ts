export type CallStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "ai_speaking"
  | "switching"
  | "error";

export type PersonaId = "empfang" | "entscheider";
export type TraineeRole = "sdr" | "ae";
export type AppMode = "roleplay" | "coaching" | "demo" | "debrief";

export interface Persona {
  id: PersonaId;
  name: string;
  title: string;
  company: string;
  voice: string;
  defaultDifficulty: number;
  difficultyLabel: string;
  wants: string;
  howHard: string;
  brief: string;
  openingLineHint: string;
  transferInHint: string;
}

export interface ScenarioOption {
  id: string;
  enabled: boolean;
  title: string;
  callType: string;
  direction?: string;
  companyName?: string;
}

export interface Catalog {
  traineeRoles: Array<{ id: TraineeRole; label: string }>;
  modes: Array<{ id: AppMode; label: string }>;
  scenarios: ScenarioOption[];
  personas: Persona[];
  modules: { product?: string; industry?: string };
}

export interface ComposePayload {
  instructions: string;
  preview: string;
  cue: string;
  persona: Persona;
  scenario: { id: string; title: string; companyName: string; goal: string };
  mode: AppMode;
  traineeRole: TraineeRole;
  difficulty: number;
  handoff?: string;
}

export interface TranscriptTurn {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  live?: boolean;
}

export interface HealthResponse {
  ok: boolean;
  hasApiKey: boolean;
  model: string;
  reasoningEffort: string;
}

export interface SessionSecret extends ComposePayload {
  value: string;
  expiresAt: number | null;
  model: string;
  personaId: string;
}

export interface HistoryEntry {
  id: string;
  endedAt: string;
  scenarioTitle: string;
  traineeRole: TraineeRole;
  personaName: string;
  mode: AppMode;
  turns: Array<{ role: TranscriptTurn["role"]; text: string }>;
}
