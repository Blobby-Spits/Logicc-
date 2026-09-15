import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../server/http.ts";
import { composeSession } from "../server/compose.ts";
import { buildRealtimeSessionConfig } from "../server/session.ts";

const ctx = { apiKey: "", model: "gpt-realtime-2", reasoningEffort: "low" as const };

describe("session payload", () => {
  it("setzt gpt-realtime-2 und reasoning.effort low", () => {
    const composed = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "empfang",
      traineeRole: "ae",
      difficulty: 3,
      mode: "roleplay",
    });
    const session = buildRealtimeSessionConfig({
      instructions: composed.instructions,
      voice: composed.persona.voice,
      model: "gpt-realtime-2",
      reasoningEffort: "low",
    });
    expect(session.type).toBe("realtime");
    expect(session.model).toBe("gpt-realtime-2");
    expect(session.reasoning.effort).toBe("low");
    expect(session.audio.output.voice).toBe("coral");
  });

  it("nutzt cedar für den Entscheider", () => {
    const composed = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "entscheider",
      traineeRole: "ae",
      difficulty: 3,
      mode: "roleplay",
    });
    expect(composed.persona.voice).toBe("cedar");
  });
});

describe("api", () => {
  it("meldet Modell und Reasoning ohne Key-Leak", async () => {
    const health = await handleApiRequest("GET", "/api/health", {}, ctx);
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ ok: true, hasApiKey: false, model: "gpt-realtime-2", reasoningEffort: "low" });
  });

  it("liefert Katalog mit Personas und Szenarien", async () => {
    const result = await handleApiRequest("GET", "/api/catalog", {}, ctx);
    expect(result.status).toBe(200);
    const body = result.body as { personas: unknown[]; scenarios: Array<{ enabled: boolean }> };
    expect(body.personas).toHaveLength(2);
    expect(body.scenarios.some((item) => item.enabled)).toBe(true);
  });

  it("komponiert ohne Token", async () => {
    const result = await handleApiRequest(
      "POST",
      "/api/compose",
      { personaId: "empfang", scenarioId: "rheinsicher-outbound", mode: "debrief" },
      ctx,
    );
    expect(result.status).toBe(200);
    const body = result.body as { instructions: string; preview: string };
    expect(body.instructions).toContain("Modus Debrief");
    expect(body.preview).not.toContain("Kontrolle und Risiko reduzieren");
  });

  it("lehnt unbekannte personaId ab", async () => {
    const result = await handleApiRequest("POST", "/api/session", { personaId: "praktikant" }, ctx);
    expect(result.status).toBe(400);
  });

  it("startet keine Session ohne Key", async () => {
    const result = await handleApiRequest("POST", "/api/session", { personaId: "empfang" }, ctx);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).toContain("OPENAI_API_KEY");
  });
});
