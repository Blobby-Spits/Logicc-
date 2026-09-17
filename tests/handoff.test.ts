import { describe, expect, it } from "vitest";
import {
  buildHandoffSentence,
  clampHandoff,
  extractBenefit,
  extractCallerName,
  extractProof,
  extractTransferHandoff,
  looksLikeTransferSpeech,
  TRANSFER_TOOL,
  TRANSFER_TOOL_NAME,
} from "../shared/handoff.ts";

describe("handoff", () => {
  it("baut einen Satz aus Nutzen, Beleg und Namen", () => {
    const sentence = buildHandoffSentence([
      {
        role: "user",
        text: "Guten Tag, hier ist Strauss von Logicc. Es geht um KI in der Kanzlei, Kosten sparen und produktiver arbeiten — wir haben rund 970 Kanzleien.",
      },
    ]);
    expect(sentence).toMatch(/Hey, hier ist jemand zu/i);
    expect(sentence).toMatch(/KI in der Kanzlei/);
    expect(sentence).toMatch(/Kosten sparen/);
    expect(sentence).toMatch(/produktiver/);
    expect(sentence).toMatch(/970/);
    expect(sentence).toMatch(/Name Strauss/);
    expect(sentence.split(/(?<=[.!?])\s+/)).toHaveLength(1);
  });

  it("fällt ohne Transkript auf einen kurzen Standardsatz zurück", () => {
    expect(buildHandoffSentence([])).toBe("Hey, hier ist jemand, der kurz mit dir sprechen möchte.");
  });

  it("extrahiert Namen und Thema unabhängig voneinander", () => {
    expect(extractCallerName("Mein Name ist Lisa Strauss, ich rufe von Logicc an.")).toBe("Lisa Strauss");
    expect(extractBenefit("Wir helfen bei Übergaben und Nachweisen vor der Revision.")).toBe(
      "Übergaben und Nachweise",
    );
    expect(extractProof("ca. 970 Kanzleien arbeiten schon damit")).toMatch(/970/);
  });

  it("begrenzt den Handoff auf einen Satz", () => {
    const clamped = clampHandoff("Erster Satz. Zweiter Satz der nicht mit soll.");
    expect(clamped).toBe("Erster Satz.");
    expect(clampHandoff("  «Kurzer Nutzen.»  ")).toBe("Kurzer Nutzen.");
  });

  it("erkennt Durchstell-Formulierungen der Empfangsperson", () => {
    expect(looksLikeTransferSpeech("Einen Moment, ich stelle Sie durch zu Dr. Weber.")).toBe(true);
    expect(looksLikeTransferSpeech("Ich verbinde Sie mit Herrn Weber.")).toBe(true);
    expect(looksLikeTransferSpeech("Bleiben Sie kurz dran, ich hole Herrn Weber.")).toBe(true);
    expect(looksLikeTransferSpeech("Ich stelle Ihnen gerne Unterlagen zusammen.")).toBe(false);
    expect(looksLikeTransferSpeech("Schicken Sie uns bitte eine E-Mail.")).toBe(false);
  });

  it("liest den Handoff aus Realtime-Function-Call-Events", () => {
    expect(TRANSFER_TOOL.name).toBe(TRANSFER_TOOL_NAME);
    expect(
      extractTransferHandoff({
        type: "response.function_call_arguments.done",
        name: TRANSFER_TOOL_NAME,
        arguments: JSON.stringify({
          handoff: "Hey, hier ist jemand zu KI in der Kanzlei, Name Strauss.",
        }),
      }),
    ).toBe("Hey, hier ist jemand zu KI in der Kanzlei, Name Strauss.");
    expect(
      extractTransferHandoff({
        type: "response.output_item.done",
        item: {
          type: "function_call",
          name: TRANSFER_TOOL_NAME,
          arguments: '{"handoff":"Hey, hier ist jemand für dich am Apparat, Name Müller."}',
        },
      }),
    ).toMatch(/Müller/);
    expect(
      extractTransferHandoff({
        type: "response.function_call_arguments.done",
        name: "other_tool",
        arguments: '{"handoff":"nein"}',
      }),
    ).toBeNull();
  });
});
