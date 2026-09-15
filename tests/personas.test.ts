import { describe, expect, it } from "vitest";
import { composeInstructions, isPersonaId, loadAllPersonas, loadPersona } from "../server/personas.ts";

describe("personas", () => {
  it("lädt Empfang und Entscheider mit unterschiedlichen Instruktionen", () => {
    const { context, personas } = loadAllPersonas();
    expect(personas.map((p) => p.id)).toEqual(["empfang", "entscheider"]);
    expect(personas[0]?.name).toBe("Sandra Keller");
    expect(personas[1]?.name).toBe("Dr. Markus Weber");
    expect(personas[0]?.instructions).not.toBe(personas[1]?.instructions);
    expect(context.userRole.company).toBe("Logicc");
  });

  it("komponiert Szenario-Rahmen in den Systemprompt", () => {
    const empfang = loadPersona("empfang");
    const composed = composeInstructions(empfang, {
      id: "x",
      locale: "de-DE",
      userRole: {
        company: "Logicc",
        title: "Account Executive",
        task: "Cold Call",
        offeringPlaceholder: "Testangebot",
        valueHypothesis: "Testhypothese",
      },
      prospect: {
        company: "Nordwerk Industrie GmbH",
        industry: "Maschinenbau",
        size: "420",
        painPlaceholder: "Listen",
      },
      callRules: ["Sprich Deutsch."],
    });
    expect(composed).toContain("Sandra Keller");
    expect(composed).toContain("Testangebot");
    expect(composed).toContain("Sprich Deutsch.");
  });

  it("erkennt nur gültige Rollen-IDs", () => {
    expect(isPersonaId("empfang")).toBe(true);
    expect(isPersonaId("entscheider")).toBe(true);
    expect(isPersonaId("chef")).toBe(false);
  });
});
