import type { Plugin } from "vite";
import { createApiMiddleware, type ApiContext } from "./http.ts";

export function logiccApiPlugin(ctx: ApiContext): Plugin {
  const middleware = createApiMiddleware(ctx);
  return {
    name: "logicc-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
