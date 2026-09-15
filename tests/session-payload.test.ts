import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../server/http.ts";
import { loadPersona } from "../server/personas.ts";
import { buildRealtimeSessionConfig } from "../server/session.ts";

describe("session payload", () => {
  it("setzt GA-Sessionfelder für Realtime-Audio", () => {
    const persona = loadPersona("empfang");
    const session = buildRealtimeSessionConfig(persona, "gpt-realtime-2.1");
    expect(session.type).toBe("realtime");
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.output.voice).toBe("coral");
    expect(session.audio.input.turn_detection.type).toBe("semantic_vad");
    expect(session.instructions).toContain("Sandra Keller");
  });

  it("nutzt eine andere Stimme für den Entscheider", () => {
    const session = buildRealtimeSessionConfig(loadPersona("entscheider"), "gpt-realtime-2.1");
    expect(session.audio.output.voice).toBe("cedar");
    expect(session.instructions).toContain("Markus Weber");
  });
});

describe("api", () => {
  const ctx = { apiKey: "", model: "gpt-realtime-2.1" };

  it("meldet fehlenden API-Key ohne Geheimnis", async () => {
    const health = await handleApiRequest("GET", "/api/health", {}, ctx);
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ ok: true, hasApiKey: false });
  });

  it("liefert beide Personas", async () => {
    const result = await handleApiRequest("GET", "/api/personas", {}, ctx);
    expect(result.status).toBe(200);
    const body = result.body as { personas: Array<{ id: string }> };
    expect(body.personas).toHaveLength(2);
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
