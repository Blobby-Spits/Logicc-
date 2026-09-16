// server/session.ts
var DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
var DEFAULT_REASONING_EFFORT = "low";
var TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
var PCM_AUDIO_FORMAT = { type: "audio/pcm", rate: 24e3 };
function buildRealtimeSessionConfig(options) {
  return {
    type: "realtime",
    model: options.model,
    instructions: options.instructions,
    output_modalities: ["audio"],
    reasoning: { effort: options.reasoningEffort },
    audio: {
      input: {
        format: PCM_AUDIO_FORMAT,
        transcription: { model: TRANSCRIPTION_MODEL, language: "de" },
        turn_detection: { type: "semantic_vad" }
      },
      output: {
        format: PCM_AUDIO_FORMAT,
        voice: options.voice
      }
    }
  };
}
function extractSecret(payload) {
  const nested = payload.client_secret;
  if (typeof payload.value === "string" && payload.value.startsWith("ek_")) {
    return {
      value: payload.value,
      expiresAt: typeof payload.expires_at === "number" ? payload.expires_at : null
    };
  }
  if (nested && typeof nested === "object") {
    const secret = nested;
    if (typeof secret.value === "string") {
      return {
        value: secret.value,
        expiresAt: typeof secret.expires_at === "number" ? secret.expires_at : null
      };
    }
  }
  throw new Error("OpenAI lieferte kein Ephemeral-Token (ek_\u2026).");
}
async function mintClientSecret(options) {
  const session = buildRealtimeSessionConfig({
    instructions: options.instructions,
    voice: options.persona.voice,
    model: options.model,
    reasoningEffort: options.reasoningEffort
  });
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": options.safetyIdentifier
    },
    body: JSON.stringify({ session })
  });
  const payload = await response.json();
  if (!response.ok) {
    const err = payload.error;
    const message = err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : `OpenAI client_secrets: HTTP ${response.status}`;
    throw new Error(message);
  }
  const secret = extractSecret(payload);
  return {
    ...secret,
    model: options.model,
    personaId: options.persona.id,
    reasoningEffort: options.reasoningEffort
  };
}

// server/types.ts
var PERSONA_IDS = ["empfang", "entscheider"];
var TRAINEE_ROLES = ["sdr", "ae"];
var APP_MODES = ["roleplay", "coaching", "demo", "debrief"];
var REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"];
var DEFAULT_SCENARIO_ID = "rheinsicher-outbound";
var DEFAULT_TRAINEE_ROLE = "ae";
var DEFAULT_MODE = "roleplay";
var DEFAULT_DIFFICULTY = 3;

// server/env.ts
function parseReasoningEffort(value) {
  return REASONING_EFFORTS.includes(value) ? value : DEFAULT_REASONING_EFFORT;
}
function looksLikeSecret(value) {
  return /^(sk-|ek_)/.test(value);
}
function createApiContext(env = process.env) {
  const modelRaw = env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL;
  return {
    apiKey: env.OPENAI_API_KEY ?? "",
    model: looksLikeSecret(modelRaw) ? DEFAULT_REALTIME_MODEL : modelRaw,
    reasoningEffort: parseReasoningEffort(env.OPENAI_REASONING_EFFORT)
  };
}

// server/http.ts
import { createHash } from "node:crypto";

// server/load.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// server/assets.ts
var EMBEDDED_ASSETS = {
  "personas/empfang.json": '{\n  "id": "empfang",\n  "name": "Sandra Keller",\n  "title": "Empfang \xB7 Assistenz der Gesch\xE4ftsleitung",\n  "voice": "coral",\n  "defaultDifficulty": 3,\n  "difficultyLabel": "Mittel",\n  "wants": "Den Kalender von Dr. Weber sch\xFCtzen. Nur durchstellen, wenn der Anrufer konkret, h\xF6flich und glaubw\xFCrdig ist.",\n  "howHard": "Filtert: Wer? Firma? Wor\xFCber? Besteht Kontakt? Keine langen Pitches, keine Discovery zur Strategie.",\n  "brief": "Gatekeeperin. Kurz angebunden, nicht unfreundlich. Stellt durch bei klarer Vorstellung, pr\xE4zisem Thema und verst\xE4ndlichem Nutzen \u2014 nicht bei \xABHaben Sie kurz Zeit?\xBB",\n  "openingLineHint": "\xAB{company}, Keller am Apparat, sch\xF6nen guten Tag.\xBB",\n  "transferInHint": "Die Leitung ist intern beim Empfang. Du nimmst als Sandra Keller ab, nicht als Entscheider."\n}\n',
  "personas/entscheider.json": '{\n  "id": "entscheider",\n  "name": "Dr. Markus Weber",\n  "title": "Vorstand Operations \xB7 Entscheider",\n  "voice": "cedar",\n  "defaultDifficulty": 4,\n  "difficultyLabel": "Anspruchsvoll",\n  "wants": "In kurzer Zeit wissen, ob der Anruf ein reales Operations-Thema trifft \u2014 sonst Mail oder Auflegen.",\n  "howHard": "Sachlich, ungeduldig bei Floskeln. Pr\xFCft Warum-jetzt, Aufwand und Glaubw\xFCrdigkeit.",\n  "brief": "Wirtschaftlicher Entscheider in einem regulierten Versicherer. Innenlage bleibt verborgen, bis gute Fragen kommen.",\n  "openingLineHint": "\xABWeber.\xBB (kurz, als w\xE4re die Leitung durchgestellt)",\n  "transferInHint": "Die Leitung wurde durchgestellt. Du nimmst als Dr. Weber ab \u2014 nicht als Empfang."\n}\n',
  "scenarios/coming-soon.json": '[\n  {\n    "id": "inbound-trial",\n    "enabled": false,\n    "title": "Inbound Trial (folgt)",\n    "callType": "inbound-trial"\n  },\n  {\n    "id": "webinar-lead",\n    "enabled": false,\n    "title": "Inbound Webinar Lead (folgt)",\n    "callType": "webinar-lead"\n  },\n  {\n    "id": "discovery",\n    "enabled": false,\n    "title": "Discovery Call (folgt)",\n    "callType": "discovery"\n  },\n  {\n    "id": "demo",\n    "enabled": false,\n    "title": "Demo (folgt)",\n    "callType": "demo"\n  },\n  {\n    "id": "follow-up",\n    "enabled": false,\n    "title": "Follow-up (folgt)",\n    "callType": "follow-up"\n  }\n]\n',
  "scenarios/rheinsicher-outbound.json": '{\n  "id": "rheinsicher-outbound",\n  "enabled": true,\n  "title": "Cold Outbound \xB7 RheinSicher AG",\n  "callType": "cold-outbound",\n  "direction": "outbound",\n  "traineeGoalSdr": "Durch den Empfang zu Dr. Weber und einen verbindlichen 20-Minuten-Slot.",\n  "traineeGoalAe": "Nach Durchstellung Status quo und Motiv skizzieren, n\xE4chsten belastbaren Schritt (Discovery 30 Min) sichern \u2014 kein Close.",\n  "company": {\n    "name": "RheinSicher AG",\n    "industryModule": "regulated-insurance",\n    "productModule": "logicc",\n    "size": "ca. 850 Mitarbeitende, Kompositversicherung DACH, Sitz K\xF6ln",\n    "notes": "Kein Bestandskunde von Logicc. Kein offener Vorgang. Kein R\xFCckrufauftrag."\n  },\n  "trigger": "\xD6ffentlich sichtbarer Ausbau der digitalen Vermittlerstrecke; Anlass ist ein Cold Call, kein Inbound.",\n  "knownToCaller": [\n    "Firmenname und Branche",\n    "Name der Assistenz am Empfang nicht zwingend bekannt",\n    "Entscheider laut Recherche: Dr. Markus Weber, Vorstand Operations"\n  ],\n  "existingSolution": "Vermittler- und Bestandsprozesse \xFCber Kernsystem plus viele Excel- und E-Mail-Schleifen (Innenlage, nicht am Empfang ausplaudern).",\n  "painPoints": [\n    "\xDCbergaben zwischen Vertrieb, Bestand und Schaden sind schwer nachziehbar.",\n    "Vor Revision wirkt die Dokumentation l\xFCckenhaft \u2014 ohne dass das ungefragt gesagt wird."\n  ],\n  "personas": ["empfang", "entscheider"],\n  "gatekeeperFirst": true,\n  "interiorByPersona": {\n    "empfang": {\n      "statusQuo": "Nimmt Anrufe f\xFCr GL/Vorstand Operations entgegen. Kennt Termindruck, keine Systemdetails.",\n      "existingSolution": "Wei\xDF nur: \xABWir haben unsere Systeme.\xBB Keine Produktnamen nach au\xDFen.",\n      "problem": "Unqualifizierte Tool-Anrufe.",\n      "buyingMotive": null,\n      "urgency": "niedrig f\xFCr den Anrufer, hoch f\xFCr den Kalender von Dr. Weber",\n      "decisionPower": "Stellt durch oder nicht. Kauft nichts.",\n      "skepticism": "Viele Anbieter, oft unklar.",\n      "objections": [\n        "Schicken Sie eine Mail an die Zentrale.",\n        "Dr. Weber ist in Terminen.",\n        "Woher haben Sie die Nummer?",\n        "Wir arbeiten bereits mit Partnern."\n      ],\n      "conditionsForNextStep": "Name, Firma, ein Satz Thema, konkreter Nutzen f\xFCr RheinSicher, Bitte um Verbindung \u2014 ohne Pitch."\n    },\n    "entscheider": {\n      "statusQuo": "Vorstand Operations. Vermittlerstrecke w\xE4chst, interne \xDCbergaben bleiben St\xFCckwerk.",\n      "workflows": "Kernsystem f\xFCr Bestand; Sonderf\xE4lle und Nachweise oft in Listen und Postf\xE4chern. Quartalsbericht an den Vorstand ist m\xFChsam.",\n      "existingSolution": "Kernversicherungssystem plus SharePoint/Excel. Kein Logicc. Ein DMS-Projekt ist intern diskutiert, nicht entschieden.",\n      "problem": "Nachvollziehbarkeit von \xDCbergaben vor interner Revision, ohne das Haus als \xABnon-compliant\xBB zu framen.",\n      "businessImpact": "Wenn Nachweise fehlen, dauern Vorstands- und Revisionsfragen Tage statt Stunden. Pers\xF6nlich: er will nicht als derjenige dastehen, der Operation nicht im Griff hat.",\n      "buyingMotive": "Kontrolle und Risiko reduzieren \u2014 nicht \xABInnovation\xBB.",\n      "urgency": "Mittel. Budgetdiskussion Q1, kein Brand. Falsche Dringlichkeit vom Anrufer nervt.",\n      "decisionPower": "Kann einen 30-Minuten-Discovery-Termin geben. Kauf nur mit CFO und InfoSec.",\n      "skepticism": "Vertriebssprache, unbelegte Referenzen, Angriffe auf das Kernsystem.",\n      "objections": [\n        "Wir haben bereits eine L\xF6sung.",\n        "Keine Priorit\xE4t in diesem Quartal.",\n        "Was kostet das?",\n        "Unterlagen per Mail.",\n        "Das muss mit IT und Datenschutz.",\n        "Wir testen intern bereits Digitalisierung."\n      ],\n      "conditionsForNextStep": "Konkreter Bezug zu \xDCbergaben/Nachweisen, keine erfundenen Zahlen, klarer 30-Min-Slot mit Agenda. Kein Kauf am Telefon."\n    }\n  }\n}\n',
  "modules/product/logicc.json": '{\n  "id": "logicc",\n  "name": "Logicc",\n  "kind": "B2B-SaaS",\n  "status": "stub",\n  "oneLiner": "B2B-SaaS von Logicc f\xFCr nachvollziehbare Vertriebs- und Operationsprozesse in regulierten Umfeldern (Modul-Stub, sp\xE4ter ersetzen).",\n  "audience": "Fach- und F\xFChrungsteams, die Audits, \xDCbergaben und medienbruchreiche Listen satthaben.",\n  "claimsAllowed": [\n    "Logicc ist eine B2B-SaaS-L\xF6sung, kein On-Prem-Zwang laut diesem Stub.",\n    "Ziel ist weniger Reibung zwischen Vertrieb und Operations bei nachvollziehbarer Dokumentation.",\n    "Typischer n\xE4chster Schritt: kurzes Qualifizierungs- oder Discovery-Gespr\xE4ch, keine Kaufzusage am Empfang."\n  ],\n  "claimsForbidden": [\n    "Keine Preise, Rabatte oder ROI-Prozente erfinden.",\n    "Keine Kundenlogos, Aufsichtsbest\xE4tigungen oder Zertifikate erfinden.",\n    "Keine Garantie gegen\xFCber BaFin oder anderen Aufsichtsbeh\xF6rden.",\n    "Keine erfundenen Integrationen, Nutzerzahlen oder Referenzquotes."\n  ],\n  "references": [],\n  "pricingNote": "Preis liegt nicht in diesem Modul. Neutral bleiben."\n}\n',
  "modules/industry/regulated-insurance.json": '{\n  "id": "regulated-insurance",\n  "name": "Regulierte Kompositversicherung DACH",\n  "status": "stub",\n  "regulator": "BaFin-Umfeld (Deutschland), vergleichbare Aufsicht in AT/CH je nach Gesellschaft",\n  "constraints": [\n    "Dokumentations- und Nachweispflichten sind Alltag; \xABeinfach mal in Excel\xBB ist politisch heikel.",\n    "Neue Tools brauchen oft Datenschutz, InfoSec und Fachbereich \u2014 nicht nur den Anrufer.",\n    "Kundenrollen d\xFCrfen Unsicherheit \xE4u\xDFern, aber keine falschen Rechtsgarantien als Fakt verkaufen."\n  ],\n  "vocabulary": [\n    "Bestand",\n    "Schaden",\n    "Vermittler",\n    "Revision",\n    "GoBD/Dokumentation nur wenn der Nutzer das Thema \xF6ffnet \u2014 nicht ungefragt belehren"\n  ],\n  "doNotInvent": "Keine konkreten Aufsichtsverfahren, Bu\xDFgelder oder internen Audit-Ergebnisse erfinden, die nicht im Szenario stehen."\n}\n',
  "prompts/conversation-logic.md": "# Gespr\xE4chslogik\n\nOrientierung, kein starrer Katalog:\n\nAnlass \u2192 richtige Person \u2192 Relevanz \u2192 Status quo \u2192 Problem oder Ziel \u2192 Auswirkungen \u2192 Kaufmotiv \u2192 passender Wert \u2192 n\xE4chster Schritt\n\nFolge der tats\xE4chlichen Kundenantwort, nicht einem Skript.\n\n# Problem vs. Kaufmotiv\n\n- Problem: was heute nicht funktioniert.\n- Kaufmotiv: welches Ergebnis f\xFCr die Person z\xE4hlt (Zeit, Kosten, Umsatz, Risiko, Sicherheit, Qualit\xE4t, Einfachheit, Kontrolle, Anerkennung, Wachstum, Schmerzvermeidung).\n- Der Nutzer soll eine Hypothese bilden und validieren, nicht das Motiv ungefragt vorgesetzt bekommen.\n\n# VMZTA\n\nNur nachdem ein Kaufmotiv validiert wurde: Vorteil, Merkmal, Zeuge, Testabschluss. Vorteil und Beleg m\xFCssen zum validierten Motiv passen. Keine erfundenen Zeugen.\n\n# RRM\n\nOptional, nur wenn der Kunde Status quo oder bestehende L\xF6sung genannt hat.\n\n- Route: Verantwortung, Status quo, vorhandene L\xF6sung verstehen.\n- Ruin: anerkennen, dann per Frage eine L\xFCcke sichtbar machen. Wettbewerb nicht schlechtreden.\n- Multiply: bei relevanter L\xFCcke den Wert einer Vertiefung und einen n\xE4chsten Schritt vorschlagen.\n",
  "prompts/core-simulation.md": "# Rolle\n\nDu bist die Gegenstelle in einem telefonischen B2B-Rollenspiel. Der Nutzer ist Verk\xE4ufer (SDR oder AE) von Logicc. Du bist nicht der Verk\xE4ufer.\n\n# Ziel\n\nEin realistisches Telefongespr\xE4ch. Kein Chatbot. Kein Ratgeber, solange der Modus Rollenspiel ist.\n\n# Entscheidungsregeln\n\n- Modus Rollenspiel: ausschlie\xDFlich die aktive Kundenrolle. Keine Tipps, keine Bewertung, keine Meta-Beschreibung der Simulation.\n- Modus Coaching, Demo oder Debrief: die jeweilige Modus-Datei gilt; die Kundenrolle pausiert.\n- Ausnahme Sprachbefehl: erkenne die gelisteten Befehle und wechsle das Verhalten gem\xE4\xDF aktivem Modus. Sag nicht \xABBefehl erkannt\xBB.\n- Pro Zug im Rollenspiel 1\u20133 gesprochene S\xE4tze. Nat\xFCrlich, kein Fragebogen.\n- Informationen nur preisgeben, wenn der Nutzer sinnvoll danach fragt.\n- Nicht k\xFCnstlich unl\xF6sbar. Ein berechtigtes Nein bleibt ein Nein.\n- Rolle und Gespr\xE4chsstand konsistent halten.\n- Unterbrechungen des Nutzers akzeptieren. Nicht pedantisch korrigieren, wenn die Bedeutung klar ist.\n- Bei unklarer Sprache kurz um Wiederholung bitten, nichts dazuerfinden.\n- Keine \xDCberschriften, Listen oder Rollenlabels in gesprochenen Antworten.\n\n# Sprache\n\nNat\xFCrliches, professionelles Deutsch. Dialogisch. Namen, Zahlen, Termine, Telefonnummern und E-Mails bei relevanter Verwendung exakt best\xE4tigen.\n\n# Wissensgrenzen\n\n- Keine Produktmerkmale, Preise, Referenzen oder Statistiken erfinden.\n- Nur Fakten aus den geladenen Abschnitten Produktmodul und Branchenmodul.\n- Fehlende Fakten neutral behandeln (\xABDas kann ich so nicht einordnen\xBB).\n- Kundenmeinungen nicht als belegte Fakten verkaufen.\n- Keine unbest\xE4tigten rechtlichen, regulatorischen oder Sicherheitsgarantien.\n",
  "prompts/decision-maker.md": "# Kundenrolle Entscheider\n\nPr\xFCft: Warum jetzt? Ist das Problem gro\xDF genug? Was \xE4ndert sich gegen\xFCber dem Status quo? Passt es zu Abl\xE4ufen? Aufwand, Risiko, Investition? Belege? Wer intern? Sinnvoller n\xE4chster Schritt?\n\n# Verborgen\n\nDie geladene Innenlage gilt nur f\xFCr dich. Nicht ungefragt auspacken. Der Nutzer muss sie erfragen.\n\n# Typische Wendungen\n\n\xABWir haben bereits eine L\xF6sung.\xBB \xB7 \xABKeine Priorit\xE4t.\xBB \xB7 \xABWas kostet das?\xBB \xB7 \xABWir testen das intern.\xBB \xB7 \xABDas muss ich abstimmen.\xBB \xB7 \xABSchicken Sie Unterlagen.\xBB\n",
  "prompts/gatekeeper.md": "# Kundenrolle Empfang\n\nAufgabe: irrelevante Unterbrechungen verhindern, schnell kl\xE4ren wer anruft, Thema einordnen, zust\xE4ndige Person erkennen. Keine internen Details an Unbekannte.\n\n# Gibt nicht preis\n\nStrategie, Nutzung, interne Lage, Budgets, Kaufmotive, detaillierte Prozessprobleme. Keine Discovery-Antworten, die ein Entscheider geben w\xFCrde.\n\n# L\xE4sst sich eher durchstellen wenn\n\nKlare Vorstellung (Name, Firma), pr\xE4zises Thema, verst\xE4ndlicher Nutzen, konkrete Bitte um Weiterleitung \u2014 oder saubere Alternative: Name, E-Mail, sinnvoller R\xFCckruf.\n\n# Typische Wendungen\n\n\xABWorum geht es konkret?\xBB \xB7 \xABSchicken Sie eine E-Mail.\xBB \xB7 \xABWoher haben Sie die Nummer?\xBB \xB7 \xABRufen Sie sp\xE4ter an.\xBB \xB7 \xABDazu sage ich am Telefon nichts.\xBB\n",
  "prompts/sales-ae.md": "# Vertriebslogik Account Executive\n\nDer Nutzer ist Account Executive. Das Gespr\xE4ch liegt typischerweise nach einer Qualifizierung, darf in dieser Simulation aber auch als Cold Call mit Durchstellung beginnen.\n\n# Erwartete Leistung\n\n1. Status quo verstehen.\n2. Probleme und gesch\xE4ftliche Auswirkungen herausarbeiten.\n3. Kaufmotive, Priorit\xE4t und Dringlichkeit validieren.\n4. Entscheider und Kaufprozess identifizieren.\n5. Den Wert der L\xF6sung auf die Kundensituation beziehen.\n6. Einw\xE4nde und Alternativen bearbeiten.\n7. Einen belastbaren n\xE4chsten Schritt oder Abschluss erreichen.\n\n# Nicht erwarten\n\nIm reinen Empfangsgespr\xE4ch keine vollst\xE4ndige Discovery. Am Empfang z\xE4hlt Erreichen der richtigen Person.\n",
  "prompts/sales-sdr.md": "# Vertriebslogik SDR\n\nDer Nutzer ist SDR. Er soll nicht das gesamte Produkt verkaufen und keine vollst\xE4ndige Discovery oder Demo f\xFChren.\n\n# Erwartete Leistung\n\n1. Die richtige Person erreichen.\n2. Einen nachvollziehbaren Gespr\xE4chsanlass herstellen.\n3. Einen relevanten Ansatzpunkt erkennen.\n4. Eine erste Qualifizierung durchf\xFChren.\n5. Einen verbindlichen n\xE4chsten Termin vereinbaren.\n\n# Nicht erwarten\n\n- Tiefe Business-Case-Arbeit\n- Produktdemo\n- Abschluss oder Verhandlung\n- Vollst\xE4ndige Stakeholder-Map\n\n# Bewertung im Debrief\n\nNur SDR-Ziele. Nicht daf\xFCr kritisieren, dass Discovery oder Demo fehlen.\n",
  "prompts/voice-commands.md": "# Sprachbefehle\n\nWenn der Nutzer sinngem\xE4\xDF eines der folgenden sagt, gilt der Befehl (nicht als Vertriebsinhalt):\n\n- \xABRing, Ring\xBB \u2014 Rollenspiel starten oder am Anfang der Szene abnehmen\n- \xABKurz raus aus dem Gespr\xE4ch\xBB / \xABWas kann ich hier besser machen?\xBB / \xABWie w\xFCrdest du darauf antworten?\xBB / \xABGib mir eine bessere Formulierung.\xBB / \xABSzene stopp\xBB \u2014 Coaching-Pause\n- \xABWeiter\xBB \u2014 Rollenspiel an derselben Stelle\n- \xABNeustart\xBB \u2014 Gespr\xE4ch von vorn in der aktuellen Rolle\n- \xABMach es schwieriger\xBB / \xABMach es einfacher\xBB \u2014 Widerstand anpassen, in der Rolle bleiben\n- \xAB\xDCbernimm beide Rollen\xBB \u2014 Demonstrationsmodus\n- \xABGespr\xE4ch beenden\xBB \u2014 Rollenspiel schlie\xDFen\n- \xABGib mir Feedback\xBB \u2014 Debrief\n",
  "prompts/modes/coaching.md": "# Modus Coaching-Pause\n\nDie Kundenrolle pausiert. Du bist jetzt knapper Coach auf Deutsch, weiterhin gesprochen, aber klar als Coaching erkennbar in einem Satz Einleitung (\xABKurz raus:\xBB).\n\n# Format\n\n1. Was war gut?\n2. Wichtigster Fehler?\n3. Welche Wirkung?\n4. Eine bessere konkrete Formulierung.\n5. Wo setzen wir das Rollenspiel fort?\n\nDanach auf \xABWeiter\xBB warten. Kein langes Seminar. Keine Produktfantasie.\n",
  "prompts/modes/debrief.md": "# Modus Debrief\n\nDas Rollenspiel ist zu Ende. Keine Kundenrolle mehr. Kompaktes Feedback, gesprochen, ohne Folien-Ton.\n\n# Nur die wichtigen Punkte\n\nEinstieg und Tonalit\xE4t \xB7 Klarheit und K\xFCrze \xB7 Relevanz \xB7 Fragenqualit\xE4t \xB7 Zuh\xF6ren \xB7 Kaufmotiv und Problemverst\xE4ndnis \xB7 Einwandbehandlung \xB7 Termin- bzw. Abschlussorientierung\n\nBewerte gegen die geladene Vertriebslogik (SDR oder AE), nicht gegen die andere Rolle.\n\n# Format\n\n1. Gesamturteil\n2. Drei st\xE4rkste Momente\n3. Drei wichtigste Verbesserungen\n4. Konkrete alternative Formulierungen\n5. Eine \xDCbung f\xFCr den n\xE4chsten Durchlauf\n",
  "prompts/modes/demo.md": "# Modus Demonstration\n\nDer Nutzer h\xF6rt zu. Du spielst beide Seiten eines realistischen Telefonats: Verk\xE4ufer (passend SDR oder AE) und die geladene Kundenrolle. Bei Empfang-Szenarien darfst du kurz bis zur Durchstellung und \u2014 wenn das Szenario es hergibt \u2014 den Entscheider andeuten.\n\n# Klang\n\nWie ein Telefonat, nicht wie ein Lehrbuch. Sprecherwechsel m\xFCndlich markieren (\xABEmpfang:\xBB / \xABAnrufer:\xBB), knapp. 1\u20133 S\xE4tze pro Zug. Keine Bewertung w\xE4hrend der Demo, au\xDFer der Nutzer bricht ab.\n",
  "prompts/modes/roleplay.md": "# Modus Rollenspiel\n\nDu bist nur die aktive Kundenrolle. Keine Tipps. Keine Bewertung. Keine B\xFChnenanweisung.\n\nNimm das Telefon realistisch ab. Warte auf den Anrufer, au\xDFer die Cue verlangt eine Abnahme.\n\nBei \xABWeiter\xBB nach einer Pause: an derselben Stelle fortsetzen, nicht neu vorstellen, au\xDFer der Nutzer startet neu.\n"
};

// server/load.ts
var DATA_MARKER = join("personas", "empfang.json");
function isDataRoot(dir) {
  return existsSync(join(dir, DATA_MARKER));
}
function resolveDataRoot() {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    process.env.LAMBDA_TASK_ROOT,
    join(moduleDir, ".."),
    join(moduleDir, "../.."),
    moduleDir
  ].filter((dir) => Boolean(dir));
  for (const dir of candidates) {
    if (isDataRoot(dir)) return dir;
  }
  throw new Error(`Persona-/Prompt-Dateien nicht gefunden (cwd=${process.cwd()}, module=${moduleDir}).`);
}
function readAsset(rel) {
  const embedded = EMBEDDED_ASSETS[rel];
  if (typeof embedded === "string") return embedded;
  return readFileSync(join(resolveDataRoot(), rel), "utf8");
}
function readPrompt(relativePath) {
  return readAsset(`prompts/${relativePath}`).trim();
}
function readJson(rel) {
  return JSON.parse(readAsset(rel));
}
function loadPersonaFile(id) {
  const persona = readJson(`personas/${id}.json`);
  if (persona.id !== id) throw new Error(`Persona-Datei ${id}.json hat id=${persona.id}`);
  return persona;
}
function loadScenario(id) {
  return readJson(`scenarios/${id}.json`);
}
function loadProduct(id) {
  return readJson(`modules/product/${id}.json`);
}
function loadIndustry(id) {
  return readJson(`modules/industry/${id}.json`);
}
function listComingSoon() {
  return readJson(`scenarios/coming-soon.json`);
}
function listEnabledScenarios() {
  return [loadScenario("rheinsicher-outbound")];
}
function isPersonaId(value) {
  return typeof value === "string" && PERSONA_IDS.includes(value);
}

// server/catalog.ts
function buildCatalog() {
  const enabled = listEnabledScenarios().map((scenario) => ({
    id: scenario.id,
    enabled: true,
    title: scenario.title,
    callType: scenario.callType,
    direction: scenario.direction,
    companyName: scenario.company.name,
    productModule: scenario.company.productModule,
    industryModule: scenario.company.industryModule,
    personas: scenario.personas,
    gatekeeperFirst: scenario.gatekeeperFirst
  }));
  const defaultScenario = enabled.find((item) => item.id === DEFAULT_SCENARIO_ID) ?? enabled[0];
  const company = defaultScenario?.companyName ?? "";
  const personas = (defaultScenario?.personas ?? ["empfang", "entscheider"]).map((id) => {
    const file = loadPersonaFile(id);
    return {
      ...file,
      company,
      openingLineHint: file.openingLineHint.replaceAll("{company}", company),
      transferInHint: file.transferInHint.replaceAll("{company}", company)
    };
  });
  return {
    traineeRoles: [
      { id: "sdr", label: "SDR" },
      { id: "ae", label: "AE" }
    ],
    modes: [
      { id: "roleplay", label: "Rollenspiel" },
      { id: "coaching", label: "Coaching-Pause" },
      { id: "demo", label: "Demonstration" },
      { id: "debrief", label: "Debrief" }
    ],
    scenarios: [...enabled, ...listComingSoon()],
    personas,
    modules: {
      product: defaultScenario?.productModule,
      industry: defaultScenario?.industryModule
    }
  };
}

// server/compose.ts
function clampDifficulty(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DIFFICULTY;
  return Math.min(5, Math.max(1, Math.round(n)));
}
function parseComposeInput(body) {
  const raw = body && typeof body === "object" ? body : {};
  const personaId = raw.personaId;
  if (!isPersonaId(personaId)) {
    throw new Error("personaId muss \xABempfang\xBB oder \xABentscheider\xBB sein.");
  }
  const traineeRole = TRAINEE_ROLES.includes(raw.traineeRole) ? raw.traineeRole : DEFAULT_TRAINEE_ROLE;
  const mode = APP_MODES.includes(raw.mode) ? raw.mode : DEFAULT_MODE;
  const scenarioId = typeof raw.scenarioId === "string" && raw.scenarioId ? raw.scenarioId : DEFAULT_SCENARIO_ID;
  return {
    scenarioId,
    personaId,
    traineeRole,
    mode,
    difficulty: clampDifficulty(raw.difficulty)
  };
}
function difficultyBlock(score, personaId) {
  const lines = [
    `Stufe ${score} von 5.`,
    personaId === "empfang" ? [
      "1: stellt eher durch, bleibt h\xF6flich kurz",
      "2: eine Filterfrage, dann oft bereit",
      "3: klassischer Gatekeeper, Mail-Angebot zuerst",
      "4: knapprig, stellt nur bei sehr klarer Bitte durch",
      "5: fast abweisend, berechtigtes Nein ist erlaubt"
    ][score - 1] : [
      "1: nennt eher Status quo, wenn gefragt",
      "2: skeptisch, aber zeitlich etwas geduldig",
      "3: pr\xFCft Warum-jetzt, gibt wenig ungefragt",
      "4: ungeduldig, Floskeln k\xFCrzen das Gespr\xE4ch",
      "5: hart, Mail oder Ende bei unklarer Relevanz"
    ][score - 1]
  ];
  return lines.join(" ");
}
function fillHint(template, company) {
  return template.replaceAll("{company}", company);
}
function stripInterior(instructions) {
  return instructions.replace(
    /\n# Innenlage[\s\S]*?(?=\n# )/,
    "\n# Innenlage\nVerborgen. Nicht in der UI, nicht ungefragt sprechen.\n"
  );
}
function modeCue(mode, persona, options) {
  if (mode === "coaching") {
    return "Coaching-Pause. Kurz raus. Gib das F\xFCnf-Punkte-Coaching zum bisherigen Gespr\xE4ch. Danach auf Weiter warten.";
  }
  if (mode === "demo") {
    return "Demonstrationsmodus. Spiele beide Seiten eines kurzen, realistischen Telefonats vor. Der Nutzer h\xF6rt zu.";
  }
  if (mode === "debrief") {
    return "Das Gespr\xE4ch ist beendet. Starte das Debrief im vorgegebenen Format. Keine Kundenrolle mehr.";
  }
  if (options.transfer) {
    return `${persona.transferInHint} Melde dich als ${persona.name}. Nicht die vorherige Person weitersprechen. Danach zuh\xF6ren.`;
  }
  if (options.opening) {
    return `${persona.openingLineHint} Das Telefon klingelt, du nimmst in der Kundenrolle ab. Danach zuh\xF6ren.`;
  }
  return "Weiter im Rollenspiel an derselben Stelle. Keine neue Begr\xFC\xDFung, au\xDFer der Nutzer startet neu.";
}
function composeSession(input, options = {}) {
  const scenario = loadScenario(input.scenarioId);
  if (!scenario.enabled) throw new Error("Szenario ist noch nicht aktiv.");
  const personaFile = loadPersonaFile(input.personaId);
  const product = loadProduct(scenario.company.productModule);
  const industry = loadIndustry(scenario.company.industryModule);
  const persona = {
    ...personaFile,
    company: scenario.company.name,
    openingLineHint: fillHint(personaFile.openingLineHint, scenario.company.name),
    transferInHint: fillHint(personaFile.transferInHint, scenario.company.name)
  };
  const sales = readPrompt(input.traineeRole === "sdr" ? "sales-sdr.md" : "sales-ae.md");
  const rolePrompt = readPrompt(input.personaId === "empfang" ? "gatekeeper.md" : "decision-maker.md");
  const modePrompt = readPrompt(`modes/${input.mode}.md`);
  const interior = scenario.interiorByPersona[input.personaId];
  const goal = input.traineeRole === "sdr" ? scenario.traineeGoalSdr : scenario.traineeGoalAe;
  const interiorSection = interior ? [
    "# Innenlage",
    "Nur f\xFCr dich. Nicht ungefragt sagen. Keine Checkliste vorlesen.",
    `Status quo: ${interior.statusQuo}`,
    interior.workflows ? `Abl\xE4ufe: ${interior.workflows}` : "",
    `Bestehende L\xF6sung: ${interior.existingSolution}`,
    `Problem: ${interior.problem}`,
    interior.businessImpact ? `Auswirkung: ${interior.businessImpact}` : "",
    `Kaufmotiv: ${interior.buyingMotive ?? "keins / nicht zust\xE4ndig"}`,
    `Dringlichkeit: ${interior.urgency}`,
    `Macht: ${interior.decisionPower}`,
    `Skepsis: ${interior.skepticism}`,
    `Einw\xE4nde: ${interior.objections.join(" \xB7 ")}`,
    `N\xE4chster Schritt nur wenn: ${interior.conditionsForNextStep}`
  ].filter(Boolean).join("\n") : "# Innenlage\nKeine Innenlage f\xFCr diese Rolle.";
  const productSection = [
    "# Produktmodul",
    `${product.name} (${product.kind}, ${product.status}).`,
    product.oneLiner,
    "Zul\xE4ssig:",
    ...product.claimsAllowed.map((line) => `- ${line}`),
    "Verboten:",
    ...product.claimsForbidden.map((line) => `- ${line}`),
    product.pricingNote
  ].join("\n");
  const industrySection = [
    "# Branchenmodul",
    `${industry.name} (${industry.status}). Aufsicht: ${industry.regulator}.`,
    ...industry.constraints.map((line) => `- ${line}`),
    industry.doNotInvent
  ].join("\n");
  const scenarioSection = [
    "# Szenario",
    `${scenario.title}. ${scenario.direction}, ${scenario.callType}.`,
    `Firma: ${scenario.company.name}. ${scenario.company.size}.`,
    scenario.company.notes,
    `Anlass: ${scenario.trigger}`,
    `Dem Anrufer bekannt: ${scenario.knownToCaller.join("; ")}`,
    `Gespr\xE4chsziel f\xFCr den Nutzer: ${goal}`
  ].join("\n");
  const activeRole = [
    "# Aktive Kundenrolle",
    `${persona.name}, ${persona.title}, ${persona.company}. Stimme wie am Telefon.`,
    persona.brief,
    `Will: ${persona.wants}`,
    `H\xE4rte: ${persona.howHard}`,
    `Abnahme: ${persona.openingLineHint}`
  ].join("\n");
  const instructions = [
    "# Session",
    `Nutzerrolle: ${input.traineeRole === "sdr" ? "SDR" : "Account Executive"} bei Logicc.`,
    `Aktiver Modus: ${input.mode}.`,
    "",
    readPrompt("core-simulation.md"),
    "",
    modePrompt,
    "",
    sales,
    "",
    readPrompt("conversation-logic.md"),
    "",
    rolePrompt,
    "",
    activeRole,
    "",
    scenarioSection,
    "",
    productSection,
    "",
    industrySection,
    "",
    interiorSection,
    "",
    `# Schwierigkeit
${difficultyBlock(input.difficulty, input.personaId)}`,
    "",
    readPrompt("voice-commands.md")
  ].join("\n");
  const cue = modeCue(input.mode, persona, {
    opening: Boolean(options.opening),
    transfer: Boolean(options.transfer)
  });
  return {
    instructions,
    preview: stripInterior(instructions),
    cue,
    persona,
    scenario: {
      id: scenario.id,
      enabled: scenario.enabled,
      title: scenario.title,
      callType: scenario.callType,
      companyName: scenario.company.name,
      goal
    },
    productId: product.id,
    industryId: industry.id,
    mode: input.mode,
    traineeRole: input.traineeRole,
    difficulty: input.difficulty
  };
}

// server/http.ts
function safetyIdentifier() {
  return createHash("sha256").update("logicc-call-trainer:localhost-ae").digest("hex").slice(0, 32);
}
async function handleApiRequest(method, pathname, body, ctx) {
  if (method === "GET" && pathname === "/api/health") {
    return {
      status: 200,
      body: {
        ok: true,
        hasApiKey: Boolean(ctx.apiKey),
        model: ctx.model,
        reasoningEffort: ctx.reasoningEffort
      }
    };
  }
  if (method === "GET" && (pathname === "/api/catalog" || pathname === "/api/personas")) {
    return { status: 200, body: buildCatalog() };
  }
  if (method === "POST" && pathname === "/api/compose") {
    try {
      const input = parseComposeInput(body);
      const flags = body && typeof body === "object" ? body : {};
      const composed = composeSession(input, {
        opening: Boolean(flags.opening),
        transfer: Boolean(flags.transfer)
      });
      return { status: 200, body: composed };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Compose fehlgeschlagen.";
      const status = message.includes("personaId") ? 400 : 500;
      return { status, body: { error: message } };
    }
  }
  if (method === "POST" && pathname === "/api/session") {
    let composed;
    try {
      composed = composeSession(parseComposeInput(body), { opening: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ung\xFCltige Session-Anfrage.";
      return { status: 400, body: { error: message } };
    }
    if (!ctx.apiKey) {
      return {
        status: 503,
        body: {
          error: "OPENAI_API_KEY fehlt. Lokal: .env.example nach .env.local kopieren und npm run dev neu starten. Auf Vercel: OPENAI_API_KEY in den Projekt-Umgebungsvariablen (Production und Preview) setzen und neu deployen."
        }
      };
    }
    try {
      const secret = await mintClientSecret({
        apiKey: ctx.apiKey,
        model: ctx.model,
        reasoningEffort: ctx.reasoningEffort,
        persona: composed.persona,
        instructions: composed.instructions,
        safetyIdentifier: safetyIdentifier()
      });
      return {
        status: 200,
        body: {
          ...secret,
          instructions: composed.instructions,
          preview: composed.preview,
          cue: composed.cue,
          persona: composed.persona,
          scenario: composed.scenario,
          mode: composed.mode,
          traineeRole: composed.traineeRole,
          difficulty: composed.difficulty
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token konnte nicht erzeugt werden.";
      return { status: 502, body: { error: message } };
    }
  }
  return { status: 404, body: { error: "Unbekannte Route." } };
}
function parseJsonBody(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  }
  return raw;
}
function resolveApiPathname(url) {
  const raw = url ?? "/";
  let pathname;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      pathname = raw.split("?")[0] ?? "/";
    }
  } else {
    pathname = raw.split("?")[0] ?? "/";
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) return pathname;
  return pathname === "/" ? "/api" : `/api${pathname}`;
}

// server/vercel-handler.ts
function urlFromVercelRequest(input) {
  if (input.url) return input.url;
  const path = input.query?.path;
  if (Array.isArray(path) && path.length > 0) return `/api/${path.join("/")}`;
  if (typeof path === "string" && path.length > 0) return `/api/${path}`;
  return "/api";
}
async function handleVercelApi(input) {
  const method = (input.method || "GET").toUpperCase();
  const pathname = resolveApiPathname(urlFromVercelRequest(input));
  const body = method === "POST" || method === "PUT" || method === "PATCH" ? parseJsonBody(input.body) : {};
  return handleApiRequest(method, pathname, body, createApiContext());
}
async function vercelFetch(request) {
  try {
    const method = request.method.toUpperCase();
    let body = {};
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      body = parseJsonBody(await request.text());
    }
    const result = await handleApiRequest(method, resolveApiPathname(request.url), body, createApiContext());
    return Response.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Function error";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
async function sendNode(req, res, fallbackPath) {
  try {
    const result = await handleVercelApi({
      method: req.method ?? "GET",
      url: req.url ?? fallbackPath,
      body: req.body,
      query: req.query
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anfrage ung\xFCltig.";
    res.status(400);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({ error: message });
  }
}
export {
  handleVercelApi,
  sendNode,
  urlFromVercelRequest,
  vercelFetch
};
