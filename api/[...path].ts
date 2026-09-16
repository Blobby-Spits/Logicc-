import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendNode, vercelFetch } from "../server/vercel-handler.ts";

export const config = { maxDuration: 10 };

export function GET(request: Request): Promise<Response> {
  return vercelFetch(request);
}

export function POST(request: Request): Promise<Response> {
  return vercelFetch(request);
}

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return sendNode(req, res, "/api/health");
}
