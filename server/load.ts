import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndustryModule, PersonaFile, PersonaId, ProductModule, ScenarioFile, ScenarioListItem } from "./types.ts";
import { PERSONA_IDS } from "./types.ts";

const DATA_MARKER = join("personas", "empfang.json");

function isDataRoot(dir: string): boolean {
  return existsSync(join(dir, DATA_MARKER));
}

/** Projektroot mit personas/prompts — lokal `server/..`, auf Vercel `process.cwd()`. */
export function resolveDataRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    process.env.LAMBDA_TASK_ROOT,
    join(moduleDir, ".."),
    join(moduleDir, "../.."),
    moduleDir,
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    if (isDataRoot(dir)) return dir;
  }
  throw new Error(`Persona-/Prompt-Dateien nicht gefunden (cwd=${process.cwd()}, module=${moduleDir}).`);
}

const rootDir = resolveDataRoot();

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
