export const TRANSFER_TOOL_NAME = "transfer_to_entscheider";
export const TRANSFER_STATUS_COPY = "Weiterleitung an Entscheider…";
export const DEFAULT_HANDOFF =
  "Hey, hier ist jemand, der kurz mit dir sprechen möchte.";

export const TRANSFER_TOOL = {
  type: "function" as const,
  name: TRANSFER_TOOL_NAME,
  description:
    "Internen Anruf an den Entscheider durchstellen. Nur aufrufen, wenn der Empfang wirklich verbindet — nicht beim Überlegen oder bei einer Mail-Absage. handoff: genau ein Satz für den Entscheider (Thema/Nutzen plus Name des Anrufers, falls bekannt). Kein Transkript.",
  parameters: {
    type: "object" as const,
    properties: {
      handoff: {
        type: "string" as const,
        description:
          "Ein Satz, den der Empfang intern dem Entscheider sagt, z. B. «Hey, hier ist jemand zu KI in der Kanzlei / Kosten sparen — Name Strauss.»",
      },
    },
    required: ["handoff"],
  },
};

const TOPIC_HINTS: Array<[RegExp, string]> = [
  [/\bki\b.{0,40}kanzlei|kanzlei.{0,40}\bki\b/i, "KI in der Kanzlei"],
  [/kosten\s*spar|günstiger werden|kosten senken/i, "Kosten sparen"],
  [/produktiver|produktivität/i, "produktiver"],
  [/übergab|nachweis|revision/i, "Übergaben und Nachweise"],
  [/vermittler/i, "Vermittlerstrecke"],
];

export function clampHandoff(text: string, max = 220): string {
  const trimmed = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["«»„”']+|["«»„”']+$/g, "");
  if (!trimmed) return "";
  const first = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  if (first.length <= max) return first;
  const sliced = first.slice(0, max).replace(/\s+\S*$/, "");
  return (sliced || first.slice(0, max)).trim();
}

export function looksLikeTransferSpeech(text: string): boolean {
  const n = text
    .toLowerCase()
    .replaceAll(/[.,!?;:«»"'„”]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (!n) return false;
  return (
    /ich stelle (sie |ihn |das gespr[aä]ch )?(jetzt )?durch/.test(n) ||
    /ich stelle durch/.test(n) ||
    /ich verbinde (sie|dich|sie einmal|sie gleich|sie jetzt)/.test(n) ||
    /verbinde sie mit/.test(n) ||
    /ich (gebe|leite) (sie|dich|das gespr[aä]ch) weiter/.test(n) ||
    /ich hole (jetzt )?(herrn|frau|dr |doktor)/.test(n) ||
    /einen moment.{0,48}(durch|verbinde|weiter)/.test(n) ||
    /bleib(en)? sie (kurz )?dran/.test(n) ||
    /stelle sie (zu|zu herrn|zu frau|zu dr)/.test(n)
  );
}

export function extractCallerName(text: string): string | null {
  const n = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:mein name ist|ich hei(?:ß|ss|s)e|hier ist|hier spricht)\s+([a-zäöüß][a-zäöüß\-']+)(?:\s+([a-zäöüß][a-zäöüß\-']+))?(?=\s|$|,|\.|von|bei|aus)/i,
    /ich bin\s+([a-zäöüß][a-zäöüß\-']+)(?:\s+([a-zäöüß][a-zäöüß\-']+))?(?=\s+von|\s+bei|,|\.|$)/i,
  ];
  for (const pattern of patterns) {
    const match = n.match(pattern);
    if (!match?.[1]) continue;
    const stop = /^(von|bei|aus|der|die|das|ein|eine|logicc|rheinsicher)$/i;
    const tokens = [match[1], match[2]].filter((token): token is string => Boolean(token) && !stop.test(token));
    if (tokens.length === 0) continue;
    return tokens.map(capitalizeName).join(" ");
  }
  return null;
}

export function extractBenefit(text: string): string | null {
  const hits: string[] = [];
  for (const [pattern, label] of TOPIC_HINTS) {
    if (pattern.test(text)) hits.push(label);
  }
  if (hits.length > 0) return hits.join(" / ");
  const about = text.match(/(?:es geht um|zum thema|wegen|bez[üu]glich)\s+([^.,;]{8,80})/i);
  if (about?.[1]) return about[1].replace(/\s+/g, " ").trim();
  return null;
}

export function extractProof(text: string): string | null {
  const match = text.match(
    /(?:ca\.?\s*|rund\s*|etwa\s*|~)?\s*(\d[\d.\s]{0,8})\s*(kanzleien|kunden|unternehmen|versicherer)/i,
  );
  if (!match?.[1] || !match[2]) return null;
  const number = match[1].replace(/\s+/g, "").trim();
  return `~${number} ${match[2]} als Kunden`;
}

export function buildHandoffSentence(turns: Array<{ role: string; text: string }>): string {
  const userText = turns
    .filter((turn) => turn.role === "user" && turn.text.trim() && turn.text !== "…")
    .map((turn) => turn.text)
    .join(" ");
  const name = extractCallerName(userText);
  const benefit = extractBenefit(userText);
  const proof = extractProof(userText);
  const nameBit = name ? `, Name ${name}` : "";
  const proofBit = proof ? ` — sagt ${proof}` : "";
  if (benefit) {
    return clampHandoff(`Hey, hier ist jemand zu ${benefit}${proofBit}${nameBit}.`);
  }
  if (name) {
    return clampHandoff(`Hey, hier ist jemand für dich am Apparat, Name ${name}.`);
  }
  return DEFAULT_HANDOFF;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** `null` = kein Transfer-Tool-Event. Leerer String = Tool erkannt, Handoff fehlt → Template nutzen. */
export function extractTransferHandoff(event: Record<string, unknown>): string | null {
  const type = String(event.type ?? "");
  const item = isRecord(event.item) ? event.item : null;
  const name =
    (typeof event.name === "string" && event.name) || (typeof item?.name === "string" && item.name) || "";
  if (name !== TRANSFER_TOOL_NAME) return null;
  const relevant =
    type === "response.function_call_arguments.done" ||
    type === "response.output_item.done" ||
    type === "conversation.item.done" ||
    type === "conversation.item.added" ||
    type.includes("function_call");
  if (!relevant) return null;
  const raw =
    (typeof event.arguments === "string" && event.arguments) ||
    (typeof item?.arguments === "string" && item.arguments) ||
    "";
  if (!raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw) as { handoff?: unknown };
    if (typeof parsed.handoff === "string") return clampHandoff(parsed.handoff);
  } catch {
    return clampHandoff(raw);
  }
  return "";
}

function capitalizeName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
