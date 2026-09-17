import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMBEDDED_ASSETS } from "../server/assets.ts";
import { parseJsonBody, resolveApiPathname, isLocalApiRequest } from "../server/http.ts";
import { createApiContext, parseReasoningEffort } from "../server/env.ts";
import { resolveDataRoot } from "../server/load.ts";
import { handleVercelApi, urlFromVercelRequest } from "../server/vercel-handler.ts";

describe("vercel api adapter", () => {
  it("normalisiert Pathnames für Catch-all und volle URLs", () => {
    expect(resolveApiPathname("/api/health")).toBe("/api/health");
    expect(resolveApiPathname("/api/health?x=1")).toBe("/api/health");
    expect(resolveApiPathname("https://example.vercel.app/api/catalog")).toBe("/api/catalog");
    expect(resolveApiPathname("/session")).toBe("/api/session");
    expect(resolveApiPathname("/compose/")).toBe("/api/compose");
    expect(isLocalApiRequest("/api/health")).toBe(true);
    expect(isLocalApiRequest("/api/compose?x=1")).toBe(true);
    expect(isLocalApiRequest("/src/main.ts")).toBe(false);
    expect(isLocalApiRequest("/src/styles.css")).toBe(false);
    expect(isLocalApiRequest("/")).toBe(false);
  });

  it("rekonstruiert die URL aus dem Catch-all-Query", () => {
    expect(urlFromVercelRequest({ url: "/api/health" })).toBe("/api/health");
    expect(urlFromVercelRequest({ query: { path: ["catalog"] } })).toBe("/api/catalog");
    expect(urlFromVercelRequest({ query: { path: "compose" } })).toBe("/api/compose");
  });

  it("parst JSON-Bodies von Vercel-Helpers", () => {
    expect(parseJsonBody("")).toEqual({});
    expect(parseJsonBody('{"personaId":"empfang"}')).toEqual({ personaId: "empfang" });
    expect(parseJsonBody({ personaId: "entscheider" })).toEqual({ personaId: "entscheider" });
  });

  it("liest Env für Hobby-Deployments", () => {
    expect(parseReasoningEffort("medium")).toBe("medium");
    expect(parseReasoningEffort("nope")).toBe("low");
    const ctx = createApiContext({
      OPENAI_API_KEY: "sk-test",
      OPENAI_REALTIME_MODEL: "gpt-realtime-2",
      OPENAI_REASONING_EFFORT: "low",
    });
    expect(ctx.apiKey).toBe("sk-test");
    expect(ctx.model).toBe("gpt-realtime-2");
    expect(ctx.reasoningEffort).toBe("low");
    const leaked = createApiContext({
      OPENAI_API_KEY: "sk-test",
      OPENAI_REALTIME_MODEL: "sk-should-not-become-model",
    });
    expect(leaked.model).toBe("gpt-realtime-2");
  });

  it("findet Prompt-Dateien über process.cwd()", () => {
    const root = resolveDataRoot();
    expect(existsSync(join(root, "personas", "empfang.json"))).toBe(true);
    expect(existsSync(join(root, "prompts", "core-simulation.md"))).toBe(true);
  });

  it("spiegelt Disk-Dateien in EMBEDDED_ASSETS", () => {
    expect(Object.keys(EMBEDDED_ASSETS).length).toBeGreaterThan(10);
    for (const [rel, content] of Object.entries(EMBEDDED_ASSETS)) {
      expect(content).toBe(readFileSync(join(process.cwd(), rel), "utf8"));
    }
  });

  it("bedient health über den Vercel-Adapter", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await handleVercelApi({ method: "GET", url: "/api/health", body: {} });
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, hasApiKey: false });
  });

  it("liefert JSON über den Web-Handler", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { vercelFetch } = await import("../server/vercel-handler.ts");
    const health = await vercelFetch(new Request("https://logicc-peach.vercel.app/api/health"));
    const catalog = await vercelFetch(new Request("https://logicc-peach.vercel.app/api/catalog"));
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    expect(health.status).toBe(200);
    expect(health.headers.get("content-type")).toMatch(/json/);
    const healthBody = (await health.json()) as { ok: boolean; hasApiKey: boolean };
    expect(healthBody).toMatchObject({ ok: true, hasApiKey: false });
    expect(catalog.status).toBe(200);
    const catalogBody = (await catalog.json()) as { personas: unknown[] };
    expect(catalogBody.personas).toHaveLength(2);
  });
});
