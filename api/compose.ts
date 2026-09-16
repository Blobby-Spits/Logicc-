import { vercelFetch } from "../server/vercel-handler.ts";

export const config = { maxDuration: 10 };

export default {
  fetch(request: Request): Promise<Response> {
    return vercelFetch(request);
  },
};
