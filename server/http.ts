import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { buildCatalog } from "./catalog.ts";
import { composeSession, parseComposeInput } from "./compose.ts";
import { mintClientSecret } from "./session.ts";
import type { ReasoningEffort } from "./types.ts";

export interface ApiContext {
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}

export interface ApiResult {
  status: number;
  body: unknown;
}

function safetyIdentifier(): string {
  return createHash("sha256").update("logicc-call-trainer:localhost-ae").digest("hex").slice(0, 32);
}

export async function handleApiRequest(
  method: string,
  pathname: string,
  body: unknown,
  ctx: ApiContext,
): Promise<ApiResult> {
  if (method === "GET" && pathname === "/api/health") {
    return {
      status: 200,
      body: {
        ok: true,
        hasApiKey: Boolean(ctx.apiKey),
        model: ctx.model,
        reasoningEffort: ctx.reasoningEffort,
      },
    };
  }

  if (method === "GET" && (pathname === "/api/catalog" || pathname === "/api/personas")) {
    return { status: 200, body: buildCatalog() };
  }

  if (method === "POST" && pathname === "/api/compose") {
    try {
      const input = parseComposeInput(body);
      const flags = body && typeof body === "object" ? (body as { opening?: boolean; transfer?: boolean }) : {};
      const composed = composeSession(input, {
        opening: Boolean(flags.opening),
        transfer: Boolean(flags.transfer),
      });
      return { status: 200, body: composed };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Compose fehlgeschlagen.";
      const status = message.includes("personaId") ? 400 : 500;
      return { status, body: { error: message } };
    }
  }

  if (method === "POST" && pathname === "/api/session") {
    let composed;
    try {
      composed = composeSession(parseComposeInput(body), { opening: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ungültige Session-Anfrage.";
      return { status: 400, body: { error: message } };
    }

    if (!ctx.apiKey) {
      return {
        status: 503,
        body: {
          error:
            "OPENAI_API_KEY fehlt. Lokal: .env.example nach .env.local kopieren und npm run dev neu starten. Auf Vercel: OPENAI_API_KEY in den Projekt-Umgebungsvariablen (Production und Preview) setzen und neu deployen.",
        },
      };
    }

    try {
      const secret = await mintClientSecret({
        apiKey: ctx.apiKey,
        model: ctx.model,
        reasoningEffort: ctx.reasoningEffort,
        persona: composed.persona,
        instructions: composed.instructions,
        safetyIdentifier: safetyIdentifier(),
      });
      return {
        status: 200,
        body: {
          ...secret,
          instructions: composed.instructions,
          preview: composed.preview,
          cue: composed.cue,
          persona: composed.persona,
          scenario: composed.scenario,
          mode: composed.mode,
          traineeRole: composed.traineeRole,
          difficulty: composed.difficulty,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token konnte nicht erzeugt werden.";
      return { status: 502, body: { error: message } };
    }
  }

  return { status: 404, body: { error: "Unbekannte Route." } };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON ungültig"));
      }
    });
    req.on("error", reject);
  });
}

export function parseJsonBody(raw: unknown): unknown {
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed) as unknown;
  }
  return raw;
}

export function resolveApiPathname(url: string | undefined): string {
  const raw = url ?? "/";
  let pathname: string;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      pathname = raw.split("?")[0] ?? "/";
    }
  } else {
    pathname = raw.split("?")[0] ?? "/";
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) return pathname;
  return pathname === "/" ? "/api" : `/api${pathname}`;
}

export function createApiMiddleware(ctx: ApiContext) {
  return async function logiccApi(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    const pathname = resolveApiPathname(req.url);
    if (!pathname.startsWith("/api/")) {
      next();
      return;
    }

    try {
      const method = req.method ?? "GET";
      const body = method === "POST" || method === "PUT" ? await readBody(req) : {};
      const result = await handleApiRequest(method, pathname, body, ctx);
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const message = error instanceof Error ? error.message : "Anfrage ungültig.";
      res.end(JSON.stringify({ error: message }));
    }
  };
}
