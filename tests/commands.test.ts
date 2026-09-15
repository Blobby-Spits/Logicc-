import { describe, expect, it } from "vitest";
import { detectVoiceCommand } from "../shared/commands.ts";

describe("voice commands", () => {
  it("erkennt die Kernbefehle", () => {
    expect(detectVoiceCommand("Ring, Ring!")).toBe("start");
    expect(detectVoiceCommand("Kurz raus aus dem Gespräch")).toBe("coaching");
    expect(detectVoiceCommand("Was kann ich hier besser machen?")).toBe("coaching");
    expect(detectVoiceCommand("Szene stopp")).toBe("coaching");
    expect(detectVoiceCommand("Weiter")).toBe("resume");
    expect(detectVoiceCommand("Neustart")).toBe("restart");
    expect(detectVoiceCommand("Mach es schwieriger")).toBe("harder");
    expect(detectVoiceCommand("Mach es einfacher")).toBe("easier");
    expect(detectVoiceCommand("Übernimm beide Rollen")).toBe("demo");
    expect(detectVoiceCommand("Gespräch beenden")).toBe("end");
    expect(detectVoiceCommand("Gib mir Feedback")).toBe("debrief");
  });

  it("ignoriert normalen Vertriebstext", () => {
    expect(detectVoiceCommand("Wenn wir weiter zusammenarbeiten, wäre ein Termin sinnvoll.")).toBeNull();
    expect(detectVoiceCommand("Guten Tag, hier ist Müller von Logicc.")).toBeNull();
  });
});
