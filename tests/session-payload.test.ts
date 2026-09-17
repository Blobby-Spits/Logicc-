import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../server/http.ts";
import { composeSession } from "../server/compose.ts";
import { buildRealtimeSessionConfig, toolsForPersona } from "../server/session.ts";
import { TRANSFER_TOOL_NAME } from "../shared/handoff.ts";

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
    expect(session.audio.input.format).toEqual({ type: "audio/pcm", rate: 24000 });
    expect(session.audio.output.format).toEqual({ type: "audio/pcm", rate: 24000 });
    expect(session.audio.output.format.rate).toBe(24000);
    const clientSecretsBody = JSON.parse(JSON.stringify({ session })) as {
      session: { audio: { output: { format: { type: string; rate: number } } } };
    };
    expect(clientSecretsBody.session.audio.output.format.rate).toBe(24000);
  });

  it("nutzt cedar für den Entscheider und eine andere Stimme für den Empfang", () => {
    const empfang = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "empfang",
      traineeRole: "ae",
      difficulty: 3,
      mode: "roleplay",
    });
    const composed = composeSession({
      scenarioId: "rheinsicher-outbound",
      personaId: "entscheider",
      traineeRole: "ae",
      difficulty: 3,
      mode: "roleplay",
    });
    expect(empfang.persona.voice).toBe("coral");
    expect(composed.persona.voice).toBe("cedar");
    expect(composed.persona.voice).not.toBe(empfang.persona.voice);
  });

  it("hängt das Durchstell-Tool nur an Empfang-Sessions", () => {
    const empfang = buildRealtimeSessionConfig({
      instructions: "test",
      voice: "coral",
      model: "gpt-realtime-2",
      reasoningEffort: "low",
      tools: toolsForPersona("empfang"),
    });
    const entscheider = buildRealtimeSessionConfig({
      instructions: "test",
      voice: "cedar",
      model: "gpt-realtime-2",
      reasoningEffort: "low",
      tools: toolsForPersona("entscheider"),
    });
    expect(empfang.audio.output.voice).toBe("coral");
    expect(entscheider.audio.output.voice).toBe("cedar");
    expect(empfang.tools?.[0]?.name).toBe(TRANSFER_TOOL_NAME);
    expect(empfang.tool_choice).toBe("auto");
    expect(entscheider.tools).toBeUndefined();
  });

  it("gibt dem Entscheider nur den Handoff-Satz, kein Empfangs-Transkript", () => {
    const handoff = "Hey, hier ist jemand zu KI in der Kanzlei / Kosten sparen, Name Strauss.";
    const composed = composeSession(
      {
        scenarioId: "rheinsicher-outbound",
        personaId: "entscheider",
        traineeRole: "ae",
        difficulty: 4,
        mode: "roleplay",
        handoff,
      },
      { transfer: true },
    );
    expect(composed.instructions).toContain("# Interne Übergabe");
    expect(composed.instructions).toContain(handoff);
    expect(composed.instructions).toContain("kein Transkript");
    expect(composed.cue).toContain(handoff);
    expect(composed.cue).toMatch(/Weber/);
    expect(composed.instructions).not.toContain("GANZES EMPFANGSGESPRÄCH");
    expect(composed.handoff).toBe(handoff);
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

  it("komponiert Entscheider-Transfer nur mit Handoff", async () => {
    const result = await handleApiRequest(
      "POST",
      "/api/compose",
      {
        personaId: "entscheider",
        scenarioId: "rheinsicher-outbound",
        transfer: true,
        handoff: "Hey, hier ist jemand zu KI in der Kanzlei, Name Strauss.",
        transcript: "GANZES EMPFANGSGESPRÄCH bitte nicht an den Entscheider geben.",
      },
      ctx,
    );
    expect(result.status).toBe(200);
    const body = result.body as { instructions: string; cue: string; persona: { voice: string } };
    expect(body.persona.voice).toBe("cedar");
    expect(body.instructions).toContain("Name Strauss");
    expect(body.instructions).not.toContain("GANZES EMPFANGSGESPRÄCH");
    expect(body.cue).toMatch(/Du weißt intern nur/);
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
