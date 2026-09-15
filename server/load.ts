import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndustryModule, PersonaFile, PersonaId, ProductModule, ScenarioFile, ScenarioListItem } from "./types.ts";
import { PERSONA_IDS } from "./types.ts";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readPrompt(relativePath: string): string {
  return readFileSync(join(rootDir, "prompts", relativePath), "utf8").trim();
}

function readJson<T>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, "utf8")) as T;
}

export function loadPersonaFile(id: PersonaId): PersonaFile {
  const persona = readJson<PersonaFile>(join(rootDir, "personas", `${id}.json`));
  if (persona.id !== id) throw new Error(`Persona-Datei ${id}.json hat id=${persona.id}`);
  return persona;
}

export function loadScenario(id: string): ScenarioFile {
  return readJson<ScenarioFile>(join(rootDir, "scenarios", `${id}.json`));
}

export function loadProduct(id: string): ProductModule {
  return readJson<ProductModule>(join(rootDir, "modules", "product", `${id}.json`));
}

export function loadIndustry(id: string): IndustryModule {
  return readJson<IndustryModule>(join(rootDir, "modules", "industry", `${id}.json`));
}

export function listComingSoon(): ScenarioListItem[] {
  return readJson<ScenarioListItem[]>(join(rootDir, "scenarios", "coming-soon.json"));
}

export function listEnabledScenarios(): ScenarioFile[] {
  return [loadScenario("rheinsicher-outbound")];
}

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && (PERSONA_IDS as readonly string[]).includes(value);
}

export { PERSONA_IDS };
