import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const outfile = fileURLToPath(new URL("../api/_handler.js", import.meta.url));
await mkdir(dirname(outfile), { recursive: true });

await esbuild.build({
  absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
  entryPoints: ["server/vercel-handler.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "info",
  legalComments: "none",
});
