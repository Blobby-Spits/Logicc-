export const PERSONA_IDS = ["empfang", "entscheider"] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

export interface ScenarioContext {
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
  callRules: string[];
}

export interface PersonaFile {
  id: PersonaId;
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
}

export interface PersonaPublic extends PersonaFile {
  instructions: string;
}

export interface RealtimeSessionConfig {
  type: "realtime";
  model: string;
  instructions: string;
  output_modalities: Array<"audio">;
  audio: {
    input: {
      format: { type: "audio/pcm"; rate: 24000 };
      transcription: { model: string; language: string };
      turn_detection: { type: "semantic_vad" | "server_vad" };
    };
    output: {
      format: { type: "audio/pcm" };
      voice: string;
    };
  };
}
