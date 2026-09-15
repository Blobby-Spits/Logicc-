export type VoiceCommand =
  | "start"
  | "coaching"
  | "resume"
  | "restart"
  | "harder"
  | "easier"
  | "demo"
  | "end"
  | "debrief";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[.,!?;:«»"'„”]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

const COACHING_PHRASES = [
  "kurz raus aus dem gesprach",
  "kurz raus aus dem gespräch",
  "kurz raus",
  "szene stopp",
  "was kann ich hier besser machen",
  "wie wurdest du darauf antworten",
  "wie würdest du darauf antworten",
  "gib mir eine bessere formulierung",
  "bessere formulierung",
];

export function detectVoiceCommand(text: string): VoiceCommand | null {
  const n = normalize(text);
  if (!n) return null;
  if (n === "ring ring" || n.startsWith("ring ring") || n === "klingeling" || n === "klingel klingel") {
    return "start";
  }
  if (COACHING_PHRASES.some((phrase) => n === phrase || n.startsWith(phrase))) return "coaching";
  if (n === "weiter" || n === "weiter im gesprach" || n === "weiter im gespräch") return "resume";
  if (n === "neustart" || n.startsWith("neu starten")) return "restart";
  if (n.startsWith("mach es schwieriger") || n === "schwieriger") return "harder";
  if (n.startsWith("mach es einfacher") || n === "einfacher") return "easier";
  if (n.includes("ubernimm beide") || n.includes("übernimm beide") || n === "demonstration") return "demo";
  if (n === "gesprach beenden" || n === "gespräch beenden" || n === "auflegen") return "end";
  if (n === "gib mir feedback" || n === "debrief" || n === "feedback bitte") return "debrief";
  return null;
}
