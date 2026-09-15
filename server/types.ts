export const PERSONA_IDS = ["empfang", "entscheider"] as const;
export const TRAINEE_ROLES = ["sdr", "ae"] as const;
export const APP_MODES = ["roleplay", "coaching", "demo", "debrief"] as const;
export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];
export type TraineeRole = (typeof TRAINEE_ROLES)[number];
export type AppMode = (typeof APP_MODES)[number];
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface PersonaFile {
  id: PersonaId;
  name: string;
  title: string;
  voice: string;
  defaultDifficulty: number;
  difficultyLabel: string;
  wants: string;
  howHard: string;
  brief: string;
  openingLineHint: string;
  transferInHint: string;
}

export interface PersonaPublic extends PersonaFile {
  company: string;
}

export interface InteriorState {
  statusQuo: string;
  workflows?: string;
  existingSolution: string;
  problem: string;
  businessImpact?: string;
  buyingMotive: string | null;
  urgency: string;
  decisionPower: string;
  skepticism: string;
  objections: string[];
  conditionsForNextStep: string;
}

export interface ScenarioFile {
  id: string;
  enabled: boolean;
  title: string;
  callType: string;
  direction: "outbound" | "inbound";
  traineeGoalSdr: string;
  traineeGoalAe: string;
  company: {
    name: string;
    industryModule: string;
    productModule: string;
    size: string;
    notes: string;
  };
  trigger: string;
  knownToCaller: string[];
  existingSolution: string;
  painPoints: string[];
  personas: PersonaId[];
  gatekeeperFirst: boolean;
  interiorByPersona: Partial<Record<PersonaId, InteriorState>>;
}

export interface ScenarioListItem {
  id: string;
  enabled: boolean;
  title: string;
  callType: string;
}

export interface ProductModule {
  id: string;
  name: string;
  kind: string;
  status: string;
  oneLiner: string;
  audience: string;
  claimsAllowed: string[];
  claimsForbidden: string[];
  references: unknown[];
  pricingNote: string;
}

export interface IndustryModule {
  id: string;
  name: string;
  status: string;
  regulator: string;
  constraints: string[];
  vocabulary: string[];
  doNotInvent: string;
}

export interface ComposeInput {
  scenarioId: string;
  personaId: PersonaId;
  traineeRole: TraineeRole;
  difficulty: number;
  mode: AppMode;
}

export interface ComposeResult {
  instructions: string;
  preview: string;
  cue: string;
  persona: PersonaPublic;
  scenario: ScenarioListItem & { companyName: string; goal: string };
  productId: string;
  industryId: string;
  mode: AppMode;
  traineeRole: TraineeRole;
  difficulty: number;
}

/** PCM 24 kHz — OpenAI-GA-Realtime verlangt `audio/pcm` inkl. `rate`. */
export interface RealtimePcmAudioFormat {
  type: "audio/pcm";
  rate: 24000;
}

export interface RealtimeSessionConfig {
  type: "realtime";
  model: string;
  instructions: string;
  output_modalities: Array<"audio">;
  reasoning: { effort: ReasoningEffort };
  audio: {
    input: {
      format: RealtimePcmAudioFormat;
      transcription: { model: string; language: string };
      turn_detection: { type: "semantic_vad" | "server_vad" };
    };
    output: {
      format: RealtimePcmAudioFormat;
      voice: string;
    };
  };
}

export const DEFAULT_SCENARIO_ID = "rheinsicher-outbound";
export const DEFAULT_TRAINEE_ROLE: TraineeRole = "ae";
export const DEFAULT_MODE: AppMode = "roleplay";
export const DEFAULT_DIFFICULTY = 3;
