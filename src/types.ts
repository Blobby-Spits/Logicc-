export type CallStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "ai_speaking"
  | "switching"
  | "error";

export interface ScenarioContextView {
  id: string;
  locale: string;
  userRole: {
    company: string;
    title: string;
    task: string;
    offeringPlaceholder: string;
    valueHypothesis: string;
  };
  prospect: {
    company: string;
    industry: string;
    size: string;
    painPlaceholder: string;
  };
}

export interface Persona {
  id: "empfang" | "entscheider";
  name: string;
  title: string;
  company: string;
  voice: string;
  difficulty: number;
  difficultyLabel: string;
  wants: string;
  howHard: string;
  brief: string;
  openingLineHint: string;
  transferInHint: string;
  instructionsPlaceholder: string;
  instructions: string;
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
}

export interface SessionSecret {
  value: string;
  expiresAt: number | null;
  model: string;
  personaId: string;
}
