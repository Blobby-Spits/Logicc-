/**
 * Domain types for the planned Jev Sales Copilot overlay.
 * Runtime UI / `/api/coach` / TypeSafe HTTP are intentionally absent — see
 * `docs/plans/jev-sales-copilot.md`.
 */

/** Demo chips, remapped for Logicc AE (RheinSicher: Termin, kein Close). */
export const CALL_STAGES = [
  "opening",
  "discovery",
  "qualification",
  "value",
  "objection",
  "next_step",
] as const;
export type CallStage = (typeof CALL_STAGES)[number];

/** Gatekeeper-only stages — used when `personaId === "empfang"`. */
export const GATEKEEPER_STAGES = ["opening", "filter", "relevance", "transfer_or_mail"] as const;
export type GatekeeperStage = (typeof GATEKEEPER_STAGES)[number];

export const NEXT_MOVES = [
  "introduce_crisply",
  "state_reason_for_call",
  "ask_to_transfer",
  "handle_mail_brush_off",
  "ask_discovery",
  "quantify_pain",
  "validate_motive",
  "map_decision_process",
  "handle_objection",
  "contrast_status_quo",
  "propose_next_step",
  "confirm_agenda",
  "listen_hold",
] as const;
export type NextMoveId = (typeof NEXT_MOVES)[number];

export const SIGNAL_IDS = [
  "pain_identified",
  "buying_motive_validated",
  "decision_maker_identified",
  "timeline_known",
  "budget_discussed",
  "competitor_mentioned",
  "objection_open",
  "prospect_committed",
  "next_step_agreed",
  "buying_signal",
  "buyer_engagement",
  "rapport",
  "urgency",
  "prospect_disengaged",
  "buyer_confused",
  "ae_pitching_too_early",
  "ae_talking_too_much",
  "ae_asked_discovery_question",
  "status_quo_understood",
  "business_impact_quantified",
] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];

export type CoachProvider = "mock" | "jev";

export interface CoachUtterance {
  i: number;
  role: "ae" | "prospect" | "system";
  text: string;
  at?: number;
}

export interface CoachStatePayload {
  personaId: "empfang" | "entscheider";
  traineeRole: "sdr" | "ae";
  scenarioId: string;
  mode: "roleplay" | "coaching" | "demo" | "debrief";
  goal: string;
  handoff?: string;
  utterances: CoachUtterance[];
  wordCounts: { ae: number; prospect: number };
  talkShareAe: number;
}

export interface LiveSignal {
  id: SignalId;
  /** 0–1 from Noul, or Score normalized by (levels - 1). */
  value: number;
  label: "low" | "mid" | "high" | "flag";
  source: "jev" | "code";
}

export interface NextBestMove {
  id: NextMoveId;
  titleDe: string;
  rationaleDe: string;
  sayDe: string;
  alternativesDe: string[];
  confidence: number;
}

export interface CloseAttribution {
  id: SignalId | "talk_share";
  labelDe: string;
  deltaPts: number;
}

export interface CoachSnapshot {
  provider: CoachProvider;
  model: string;
  utteranceIndex: number;
  stage: CallStage | GatekeeperStage;
  stageConfidence: number;
  nextMove: NextBestMove;
  signals: LiveSignal[];
  /** 0–100, composite in code — never a single Jev question. */
  nextStepProbability: number;
  deltaPts: number;
  sparkline: number[];
  moved: CloseAttribution[];
  talkShareAe: number;
  latencyMs?: number;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Weights for AE-Entscheider “Terminwahrscheinlichkeit” (not a purchase close).
 * Change a coefficient here, not a prompt. Sum of abs() is not required to be 1;
 * the reducer clamps to 0–1 after applying signed terms.
 */
export const DEFAULT_NEXT_STEP_WEIGHTS = {
  pain_identified: 0.22,
  urgency: 0.18,
  buyer_engagement: 0.15,
  decision_maker_identified: 0.12,
  buying_motive_validated: 0.1,
  business_impact_quantified: 0.08,
  rapport: 0.08,
  next_step_agreed: 0.07,
  objection_open: -0.15,
  ae_pitching_too_early: -0.1,
  ae_talking_too_much: -0.08,
} as const satisfies Partial<Record<SignalId, number>>;

export const COACH_CONFIDENCE = {
  /** Below this, keep the previous next-move / stage (no jump). */
  holdPrevious: 0.45,
  /** Above this, allow stage to move forward. */
  advanceStage: 0.55,
  /** German transcripts: treat mid-confidence as “show, don’t insist”. */
  showCaution: 0.62,
} as const;

export type JevQuestionType = "choice" | "score" | "noul";

export interface JevChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
}

export interface JevScoreQuestion {
  type: "score";
  instructions: string;
  criteria: string[];
}

export interface JevNoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type JevScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type JevNoulAnswer = {
  type: "noul";
  noul: number;
};

export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;

export interface JevSystemOneResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
}
