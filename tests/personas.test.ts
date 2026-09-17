import { describe, expect, it } from "vitest";
import { coreMentionsProductFacts, composeSession, parseComposeInput } from "../server/compose.ts";
import { isPersonaId, loadPersonaFile } from "../server/load.ts";
import { loadAllPersonas, loadPersona } from "../server/personas.ts";

describe("module split", () => {
  it("hält Produkt- und Branchenfakten aus dem Core-Prompt", () => {
    expect(coreMentionsProductFacts()).toBe(false);
  });

  it("lädt Empfang und Entscheider als Karten ohne Produktpitch im Charakterfile", () => {
    const empfang = loadPersonaFile("empfang");
    expect(empfang.name).toBe("Sandra Keller");
    expect(JSON.stringify(empfang)).not.toContain("BaFin");
    expect(loadPersonaFile("entscheider").name).toBe("Dr. Markus Weber");
  });

  it("komponiert unterschiedliche Rollen und versteckt Innenlage in der Preview", () => {
    const empfang = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "empfang",
      traineeRole: "sdr",
      difficulty: 3,
      mode: "roleplay",
    });
    const entscheider = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "entscheider",
      traineeRole: "ae",
      difficulty: 4,
      mode: "roleplay",
    });
    expect(empfang.instructions).toContain("Sandra Keller");
    expect(empfang.instructions).toContain("transfer_to_entscheider");
    expect(empfang.instructions).toContain("Vertriebslogik SDR");
    expect(empfang.instructions).not.toContain("Vertriebslogik Account Executive");
    expect(entscheider.instructions).toContain("Markus Weber");
    expect(entscheider.instructions).toContain("Interne Übergabe");
    expect(entscheider.instructions).toContain("Kontrolle und Risiko reduzieren");
    expect(entscheider.preview).not.toContain("Kontrolle und Risiko reduzieren");
    expect(entscheider.instructions).toContain("Produktmodul");
    expect(entscheider.instructions).toContain("Branchenmodul");
    expect(loadAllPersonas().personas).toHaveLength(2);
    expect(loadPersona("empfang").instructions).toContain("# Modus Rollenspiel");
  });

  it("wechselt Modus-Abschnitte", () => {
    const coaching = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "empfang",
      traineeRole: "ae",
      difficulty: 3,
      mode: "coaching",
    });
    expect(coaching.instructions).toContain("Modus Coaching-Pause");
    expect(coaching.cue.toLowerCase()).toContain("coaching");
    const demo = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "empfang",
      traineeRole: "ae",
      difficulty: 3,
      mode: "demo",
    });
    expect(demo.instructions).toContain("Modus Demonstration");
  });

  it("parst Compose-Input und Persona-IDs", () => {
    expect(parseComposeInput({ personaId: "entscheider", traineeRole: "sdr", difficulty: 9 }).difficulty).toBe(5);
    expect(parseComposeInput({ personaId: "empfang" }).traineeRole).toBe("ae");
    expect(parseComposeInput({ personaId: "empfang", handoff: "Hey, nicht für Empfang." }).handoff).toBeUndefined();
    expect(
      parseComposeInput({
        personaId: "entscheider",
        handoff: "Hey, hier ist jemand zu KI, Name Strauss. Zweiter Satz.",
      }).handoff,
    ).toBe("Hey, hier ist jemand zu KI, Name Strauss.");
    expect(isPersonaId("empfang")).toBe(true);
    expect(isPersonaId("chef")).toBe(false);
    expect(() => parseComposeInput({})).toThrow(/personaId/);
  });
});
