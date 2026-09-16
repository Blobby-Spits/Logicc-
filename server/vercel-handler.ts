import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApiContext } from "./env.ts";
import { handleApiRequest, parseJsonBody, resolveApiPathname, type ApiResult } from "./http.ts";

export interface VercelApiInput {
  method: string;
  url: string | undefined;
  body: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export function urlFromVercelRequest(input: {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
}): string {
  if (input.url) return input.url;
  const path = input.query?.path;
  if (Array.isArray(path) && path.length > 0) return `/api/${path.join("/")}`;
  if (typeof path === "string" && path.length > 0) return `/api/${path}`;
  return "/api";
}

export async function handleVercelApi(input: VercelApiInput): Promise<ApiResult> {
  const method = (input.method || "GET").toUpperCase();
  const pathname = resolveApiPathname(urlFromVercelRequest(input));
  const body = method === "POST" || method === "PUT" || method === "PATCH" ? parseJsonBody(input.body) : {};
  return handleApiRequest(method, pathname, body, createApiContext());
}

export async function vercelFetch(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();
  let body: unknown = {};
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    body = parseJsonBody(await request.text());
  }
  const result = await handleApiRequest(method, resolveApiPathname(request.url), body, createApiContext());
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function sendNode(req: VercelRequest, res: VercelResponse, fallbackPath: string): Promise<void> {
  try {
    const result = await handleVercelApi({
      method: req.method ?? "GET",
      url: req.url ?? fallbackPath,
      body: req.body,
      query: req.query,
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anfrage ungültig.";
    res.status(400);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({ error: message });
  }
}
