import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PersonaFile, PersonaId, PersonaPublic, ScenarioContext } from "./types.ts";
import { PERSONA_IDS } from "./types.ts";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const personasDir = join(rootDir, "personas");

function readJson<T>(fileName: string): T {
  const raw = readFileSync(join(personasDir, fileName), "utf8");
  return JSON.parse(raw) as T;
}

export function loadContext(): ScenarioContext {
  return readJson<ScenarioContext>("context.json");
}

export function loadPersonaFile(id: PersonaId): PersonaFile {
  return readJson<PersonaFile>(`${id}.json`);
}

export function composeInstructions(persona: PersonaFile, context: ScenarioContext): string {
  const rules = context.callRules.map((rule) => `- ${rule}`).join("\n");
  return [
    persona.instructionsPlaceholder.trim(),
    "",
    "Szenario-Rahmen (v0, Platzhalter — Prompts werden noch geschärft):",
    `Trainee: ${context.userRole.title} bei ${context.userRole.company}. ${context.userRole.task}`,
    `Angebot: ${context.userRole.offeringPlaceholder}`,
    `Nutzen-Hypothese: ${context.userRole.valueHypothesis}`,
    `Prospect: ${context.prospect.company} · ${context.prospect.industry} · ${context.prospect.size}`,
    `Schmerz (nicht ungefragt auspacken): ${context.prospect.painPlaceholder}`,
    "",
    "Rahmenregeln:",
    rules,
    "",
    `Aktive Rolle: ${persona.name}, ${persona.title}. Stimme und Tempo wie ein reales Telefonat.`,
  ].join("\n");
}

export function loadPersona(id: PersonaId): PersonaPublic {
  const context = loadContext();
  const persona = loadPersonaFile(id);
  if (persona.id !== id) {
    throw new Error(`Persona-Datei ${id}.json hat id=${persona.id}`);
  }
  return {
    ...persona,
    instructions: composeInstructions(persona, context),
  };
}

export function loadAllPersonas(): { context: ScenarioContext; personas: PersonaPublic[] } {
  const context = loadContext();
  const personas = PERSONA_IDS.map((id) => loadPersona(id));
  return { context, personas };
}

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && (PERSONA_IDS as readonly string[]).includes(value);
}
