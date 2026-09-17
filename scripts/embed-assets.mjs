import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function walk(relDir) {
  const abs = join(root, relDir);
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (entry.name.endsWith(".json") || entry.name.endsWith(".md")) out.push(rel);
  }
  return out;
}

const files = [...walk("personas"), ...walk("prompts"), ...walk("modules"), ...walk("scenarios")].sort();
const lines = files.map((rel) => `  ${JSON.stringify(rel)}: ${JSON.stringify(readFileSync(join(root, rel), "utf8"))},`);

writeFileSync(
  join(root, "server/assets.ts"),
  `/** Eingebettete Prompt-/JSON-Dateien für Vercel Functions (kein fs nötig). */\nexport const EMBEDDED_ASSETS: Record<string, string> = {\n${lines.join("\n")}\n};\n`,
);
