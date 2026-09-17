import { readPrompt, loadIndustry, loadPersonaFile, loadProduct, loadScenario } from "./load.ts";
import type {
  AppMode,
  ComposeInput,
  ComposeResult,
  PersonaId,
  PersonaPublic,
  TraineeRole,
} from "./types.ts";
import { APP_MODES, DEFAULT_DIFFICULTY, DEFAULT_MODE, DEFAULT_SCENARIO_ID, DEFAULT_TRAINEE_ROLE, TRAINEE_ROLES } from "./types.ts";
import { isPersonaId } from "./load.ts";
import { clampHandoff } from "../shared/handoff.ts";

function clampDifficulty(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DIFFICULTY;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function parseComposeInput(body: unknown): ComposeInput {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const personaId = raw.personaId;
  if (!isPersonaId(personaId)) {
    throw new Error("personaId muss «empfang» oder «entscheider» sein.");
  }
  const traineeRole = TRAINEE_ROLES.includes(raw.traineeRole as TraineeRole)
    ? (raw.traineeRole as TraineeRole)
    : DEFAULT_TRAINEE_ROLE;
  const mode = APP_MODES.includes(raw.mode as AppMode) ? (raw.mode as AppMode) : DEFAULT_MODE;
  const scenarioId = typeof raw.scenarioId === "string" && raw.scenarioId ? raw.scenarioId : DEFAULT_SCENARIO_ID;
  const handoffRaw = typeof raw.handoff === "string" ? clampHandoff(raw.handoff) : "";
  return {
    scenarioId,
    personaId,
    traineeRole,
    mode,
    difficulty: clampDifficulty(raw.difficulty),
    handoff: personaId === "entscheider" && handoffRaw ? handoffRaw : undefined,
  };
}

function difficultyBlock(score: number, personaId: PersonaId): string {
  const lines = [
    `Stufe ${score} von 5.`,
    personaId === "empfang"
      ? [
          "1: stellt eher durch, bleibt höflich kurz",
          "2: eine Filterfrage, dann oft bereit",
          "3: klassischer Gatekeeper, Mail-Angebot zuerst",
          "4: knapprig, stellt nur bei sehr klarer Bitte durch",
          "5: fast abweisend, berechtigtes Nein ist erlaubt",
        ][score - 1]
      : [
          "1: nennt eher Status quo, wenn gefragt",
          "2: skeptisch, aber zeitlich etwas geduldig",
          "3: prüft Warum-jetzt, gibt wenig ungefragt",
          "4: ungeduldig, Floskeln kürzen das Gespräch",
          "5: hart, Mail oder Ende bei unklarer Relevanz",
        ][score - 1],
  ];
  return lines.join(" ");
}

function fillHint(template: string, company: string): string {
  return template.replaceAll("{company}", company);
}

function stripInterior(instructions: string): string {
  return instructions.replace(
    /\n# Innenlage[\s\S]*?(?=\n# )/,
    "\n# Innenlage\nVerborgen. Nicht in der UI, nicht ungefragt sprechen.\n",
  );
}

function modeCue(
  mode: AppMode,
  persona: PersonaPublic,
  options: { opening: boolean; transfer: boolean; handoff?: string },
): string {
  if (mode === "coaching") {
    return "Coaching-Pause. Kurz raus. Gib das Fünf-Punkte-Coaching zum bisherigen Gespräch. Danach auf Weiter warten.";
  }
  if (mode === "demo") {
    return "Demonstrationsmodus. Spiele beide Seiten eines kurzen, realistischen Telefonats vor. Der Nutzer hört zu.";
  }
  if (mode === "debrief") {
    return "Das Gespräch ist beendet. Starte das Debrief im vorgegebenen Format. Keine Kundenrolle mehr.";
  }
  if (options.transfer) {
    const handoffNote = options.handoff ? ` Du weißt intern nur: «${options.handoff}».` : "";
    return `${persona.transferInHint} Melde dich als ${persona.name}.${handoffNote} Nicht die vorherige Person weitersprechen. Danach zuhören.`;
  }
  if (options.opening) {
    return `${persona.openingLineHint} Das Telefon klingelt, du nimmst in der Kundenrolle ab. Danach zuhören.`;
  }
  return "Weiter im Rollenspiel an derselben Stelle. Keine neue Begrüßung, außer der Nutzer startet neu.";
}

function handoffSection(handoff: string | undefined, personaId: PersonaId): string {
  if (personaId !== "entscheider" || !handoff) return "";
  return [
    "# Interne Übergabe",
    "Das Empfangsgespräch hast du nicht gehört. Du bekommst kein Transkript und keine weiteren Details.",
    `Der Empfang hat dir nur diesen einen Satz gesagt: «${handoff}»`,
    "Keine weiteren Inhalte aus dem Vorgespräch kennen, zitieren oder erfinden. Den Satz nicht dem Anrufer vorlesen.",
  ].join("\n");
}

export function composeSession(input: ComposeInput, options: { opening?: boolean; transfer?: boolean } = {}): ComposeResult {
  const scenario = loadScenario(input.scenarioId);
  if (!scenario.enabled) throw new Error("Szenario ist noch nicht aktiv.");
  const personaFile = loadPersonaFile(input.personaId);
  const product = loadProduct(scenario.company.productModule);
  const industry = loadIndustry(scenario.company.industryModule);
  const persona: PersonaPublic = {
    ...personaFile,
    company: scenario.company.name,
    openingLineHint: fillHint(personaFile.openingLineHint, scenario.company.name),
    transferInHint: fillHint(personaFile.transferInHint, scenario.company.name),
  };

  const sales = readPrompt(input.traineeRole === "sdr" ? "sales-sdr.md" : "sales-ae.md");
  const rolePrompt = readPrompt(input.personaId === "empfang" ? "gatekeeper.md" : "decision-maker.md");
  const modePrompt = readPrompt(`modes/${input.mode}.md`);
  const interior = scenario.interiorByPersona[input.personaId];
  const goal = input.traineeRole === "sdr" ? scenario.traineeGoalSdr : scenario.traineeGoalAe;

  const interiorSection = interior
    ? [
        "# Innenlage",
        "Nur für dich. Nicht ungefragt sagen. Keine Checkliste vorlesen.",
        `Status quo: ${interior.statusQuo}`,
        interior.workflows ? `Abläufe: ${interior.workflows}` : "",
        `Bestehende Lösung: ${interior.existingSolution}`,
        `Problem: ${interior.problem}`,
        interior.businessImpact ? `Auswirkung: ${interior.businessImpact}` : "",
        `Kaufmotiv: ${interior.buyingMotive ?? "keins / nicht zuständig"}`,
        `Dringlichkeit: ${interior.urgency}`,
        `Macht: ${interior.decisionPower}`,
        `Skepsis: ${interior.skepticism}`,
        `Einwände: ${interior.objections.join(" · ")}`,
        `Nächster Schritt nur wenn: ${interior.conditionsForNextStep}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "# Innenlage\nKeine Innenlage für diese Rolle.";

  const productSection = [
    "# Produktmodul",
    `${product.name} (${product.kind}, ${product.status}).`,
    product.oneLiner,
    "Zulässig:",
    ...product.claimsAllowed.map((line) => `- ${line}`),
    "Verboten:",
    ...product.claimsForbidden.map((line) => `- ${line}`),
    product.pricingNote,
  ].join("\n");

  const industrySection = [
    "# Branchenmodul",
    `${industry.name} (${industry.status}). Aufsicht: ${industry.regulator}.`,
    ...industry.constraints.map((line) => `- ${line}`),
    industry.doNotInvent,
  ].join("\n");

  const scenarioSection = [
    "# Szenario",
    `${scenario.title}. ${scenario.direction}, ${scenario.callType}.`,
    `Firma: ${scenario.company.name}. ${scenario.company.size}.`,
    scenario.company.notes,
    `Anlass: ${scenario.trigger}`,
    `Dem Anrufer bekannt: ${scenario.knownToCaller.join("; ")}`,
    `Gesprächsziel für den Nutzer: ${goal}`,
  ].join("\n");

  const activeRole = [
    "# Aktive Kundenrolle",
    `${persona.name}, ${persona.title}, ${persona.company}. Stimme wie am Telefon.`,
    persona.brief,
    `Will: ${persona.wants}`,
    `Härte: ${persona.howHard}`,
    `Abnahme: ${persona.openingLineHint}`,
  ].join("\n");

  const instructions = [
    "# Session",
    `Nutzerrolle: ${input.traineeRole === "sdr" ? "SDR" : "Account Executive"} bei Logicc.`,
    `Aktiver Modus: ${input.mode}.`,
    "",
    readPrompt("core-simulation.md"),
    "",
    modePrompt,
    "",
    sales,
    "",
    readPrompt("conversation-logic.md"),
    "",
    rolePrompt,
    "",
    activeRole,
    "",
    handoffSection(input.handoff, input.personaId),
    "",
    scenarioSection,
    "",
    productSection,
    "",
    industrySection,
    "",
    interiorSection,
    "",
    `# Schwierigkeit\n${difficultyBlock(input.difficulty, input.personaId)}`,
    "",
    readPrompt("voice-commands.md"),
  ].join("\n");

  const cue = modeCue(input.mode, persona, {
    opening: Boolean(options.opening),
    transfer: Boolean(options.transfer),
    handoff: input.handoff,
  });

  return {
    instructions,
    preview: stripInterior(instructions),
    cue,
    persona,
    scenario: {
      id: scenario.id,
      enabled: scenario.enabled,
      title: scenario.title,
      callType: scenario.callType,
      companyName: scenario.company.name,
      goal,
    },
    productId: product.id,
    industryId: industry.id,
    mode: input.mode,
    traineeRole: input.traineeRole,
    difficulty: input.difficulty,
    handoff: input.handoff,
  };
}

export function coreMentionsProductFacts(): boolean {
  const core = readPrompt("core-simulation.md").toLowerCase();
  return core.includes("rheinsicher") || core.includes("bafin") || core.includes("kernsystem");
}
