import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { isPersonaId, loadAllPersonas, loadPersona } from "./personas.ts";
import { mintClientSecret } from "./session.ts";

export interface ApiContext {
  apiKey: string;
  model: string;
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
      },
    };
  }

  if (method === "GET" && pathname === "/api/personas") {
    const { context, personas } = loadAllPersonas();
    return {
      status: 200,
      body: {
        context: {
          id: context.id,
          locale: context.locale,
          userRole: context.userRole,
          prospect: context.prospect,
        },
        personas,
      },
    };
  }

  if (method === "POST" && pathname === "/api/session") {
    const personaId =
      body && typeof body === "object" && "personaId" in body ? (body as { personaId: unknown }).personaId : undefined;

    if (!isPersonaId(personaId)) {
      return {
        status: 400,
        body: { error: "personaId muss «empfang» oder «entscheider» sein." },
      };
    }

    if (!ctx.apiKey) {
      return {
        status: 503,
        body: {
          error:
            "OPENAI_API_KEY fehlt. Kopiere .env.example nach .env.local, trage den Key ein und starte npm run dev neu.",
        },
      };
    }

    try {
      const persona = loadPersona(personaId);
      const secret = await mintClientSecret({
        apiKey: ctx.apiKey,
        model: ctx.model,
        persona,
        safetyIdentifier: safetyIdentifier(),
      });
      return { status: 200, body: secret };
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

function pathnameOf(url: string | undefined): string {
  const path = (url ?? "/").split("?")[0] ?? "/";
  return path;
}

export function createApiMiddleware(ctx: ApiContext) {
  return async function logiccApi(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    const pathname = pathnameOf(req.url);
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
