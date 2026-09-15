import { composeSession } from "./compose.ts";
import { isPersonaId, loadPersonaFile } from "./load.ts";
import { DEFAULT_DIFFICULTY, DEFAULT_MODE, DEFAULT_SCENARIO_ID, DEFAULT_TRAINEE_ROLE, type PersonaId } from "./types.ts";

/** Kompatibilität: Persona plus komponierte Instructions für das Default-Szenario. */
export function loadPersona(id: PersonaId) {
  const file = loadPersonaFile(id);
  const composed = composeSession({
    scenarioId: DEFAULT_SCENARIO_ID,
    personaId: id,
    traineeRole: DEFAULT_TRAINEE_ROLE,
    difficulty: DEFAULT_DIFFICULTY,
    mode: DEFAULT_MODE,
  });
  return { ...file, ...composed.persona, instructions: composed.instructions, preview: composed.preview };
}

export function loadAllPersonas() {
  return {
    personas: [loadPersona("empfang"), loadPersona("entscheider")],
  };
}

export { isPersonaId };
